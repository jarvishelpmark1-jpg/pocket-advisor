import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
// pdf-parser pulls in pdfjs, which references DOM-only globals at import time and
// blows up under Node. These tests exercise the OFX path, so stub it out.
vi.mock('./pdf-parser', () => ({ parsePDF: vi.fn() }))
import { db, clearAllData } from './db'
import { processUpload } from './upload-processor'
import { getAccountBalances } from './analytics'
import type { AccountType } from './types'

type Txn = { type: 'DEBIT' | 'CREDIT'; date: string; amt: string; name: string }

function ofxFile(
  name: string,
  opts: { bal: string; dtasof: string; txns: Txn[] },
): File {
  const trn = opts.txns
    .map(
      (t) =>
        `<STMTTRN><TRNTYPE>${t.type}<DTPOSTED>${t.date}<TRNAMT>${t.amt}<NAME>${t.name}</STMTTRN>`,
    )
    .join('\n')
  const content = `<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
${trn}
</BANKTRANLIST>
<LEDGERBAL><BALAMT>${opts.bal}<DTASOF>${opts.dtasof}</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`
  return new File([content], name, { type: 'text/plain' })
}

async function addAccount(type: AccountType) {
  const now = new Date('2026-06-27')
  const id = await db.accounts.add({
    name: 'Test',
    type,
    institution: '',
    anchorBalance: 0,
    anchorDate: now,
    color: '#000',
    createdAt: now,
    updatedAt: now,
  })
  return id as number
}

beforeEach(async () => {
  await clearAllData()
})

function csvFile(name: string, rows: string[]): File {
  return new File([['Date,Description,Amount', ...rows].join('\n')], name, { type: 'text/csv' })
}

describe('processUpload sign normalization', () => {
  it('flips signs on a credit card statement that prints charges as positive', async () => {
    const id = await addAccount('credit')
    const result = await processUpload(
      csvFile('amex.csv', [
        '03/02/2026,WHOLE FOODS MARKET,95.67',
        '03/03/2026,UBER EATS,42.30',
        '03/05/2026,DELTA AIR LINES,487.00',
        '03/10/2026,MOBILE PAYMENT - THANK YOU,-500.00',
      ]),
      id,
    )

    expect(result.total).toBe(4)
    const txns = await db.transactions.where('accountId').equals(id).toArray()
    const byDesc = Object.fromEntries(txns.map(t => [t.description, t.amount]))
    expect(byDesc['WHOLE FOODS MARKET']).toBe(-95.67) // charge = spend
    expect(byDesc['MOBILE PAYMENT - THANK YOU']).toBe(500) // payment = money in
  })

  it('leaves an already-signed credit card statement alone', async () => {
    const id = await addAccount('credit')
    await processUpload(
      csvFile('chase-card.csv', [
        '03/02/2026,TRADER JOES,-87.34',
        '03/03/2026,SHELL OIL,-48.72',
        '03/10/2026,AUTOMATIC PAYMENT,500.00',
      ]),
      id,
    )

    const txns = await db.transactions.where('accountId').equals(id).toArray()
    const byDesc = Object.fromEntries(txns.map(t => [t.description, t.amount]))
    expect(byDesc['TRADER JOES']).toBe(-87.34)
    expect(byDesc['AUTOMATIC PAYMENT']).toBe(500)
  })

  it('never flips signs on an asset account, even when deposits dominate', async () => {
    const id = await addAccount('checking')
    await processUpload(
      csvFile('savings.csv', [
        '03/01/2026,DIRECT DEPOSIT PAYROLL,2000.00',
        '03/15/2026,DIRECT DEPOSIT PAYROLL,2000.00',
        '03/20/2026,INTEREST PAID,4.10',
      ]),
      id,
    )

    const txns = await db.transactions.where('accountId').equals(id).toArray()
    expect(txns.every(t => t.amount > 0)).toBe(true)
  })
})

describe('processUpload duplicate handling', () => {
  it('keeps identical same-day transactions listed twice in one file', async () => {
    const id = await addAccount('checking')
    const result = await processUpload(
      csvFile('march.csv', [
        '03/04/2026,STARBUCKS STORE 14442,-6.45',
        '03/04/2026,STARBUCKS STORE 14442,-6.45',
      ]),
      id,
    )

    expect(result.total).toBe(2)
    expect(result.duplicatesSkipped).toBe(0)
  })

  it('skips every row when the same file is uploaded twice', async () => {
    const id = await addAccount('checking')
    const rows = [
      '03/04/2026,STARBUCKS STORE 14442,-6.45',
      '03/04/2026,STARBUCKS STORE 14442,-6.45',
      '03/05/2026,TRADER JOES,-87.34',
    ]
    await processUpload(csvFile('march.csv', rows), id)
    const again = await processUpload(csvFile('march.csv', rows), id)

    expect(again.total).toBe(0)
    expect(again.duplicatesSkipped).toBe(3)
    expect(await db.transactions.where('accountId').equals(id).count()).toBe(3)
  })
})

describe('processUpload re-anchoring', () => {
  it('adopts an asset statement balance on the first import (even if dated in the past)', async () => {
    const id = await addAccount('checking')
    const file = ofxFile('jan.ofx', {
      bal: '1975.00',
      dtasof: '20260131',
      txns: [
        { type: 'DEBIT', date: '20260103', amt: '-25.00', name: 'Coffee' },
        { type: 'CREDIT', date: '20260105', amt: '1000.00', name: 'Paycheck' },
      ],
    })

    const result = await processUpload(file, id)

    expect(result.anchorUpdated).toEqual({
      balance: 1975,
      date: new Date(2026, 0, 31),
      isLiability: false,
    })

    const account = await db.accounts.get(id)
    expect(account?.anchorBalance).toBe(1975)
    expect(account?.anchorDate.getTime()).toBe(new Date(2026, 0, 31).getTime())

    // statement txns are dated on/before the close, so they don't double-count
    const [bal] = await getAccountBalances()
    expect(bal.current).toBe(1975)
  })

  it('normalizes a credit card owed balance to a positive anchor', async () => {
    const id = await addAccount('credit')
    const file = ofxFile('card.ofx', {
      bal: '-432.10', // OFX reports owed as a negative ledger balance
      dtasof: '20260131',
      txns: [{ type: 'DEBIT', date: '20260110', amt: '-50.00', name: 'Store' }],
    })

    const result = await processUpload(file, id)

    expect(result.anchorUpdated?.balance).toBe(432.1)
    expect(result.anchorUpdated?.isLiability).toBe(true)

    const [bal] = await getAccountBalances()
    expect(bal.account.anchorBalance).toBe(432.1)
    expect(bal.contribution).toBe(-432.1) // liabilities subtract from net worth
  })

  it('does not let an older statement clobber a newer anchor', async () => {
    const id = await addAccount('checking')

    await processUpload(
      ofxFile('may.ofx', {
        bal: '5000.00',
        dtasof: '20260531',
        txns: [{ type: 'CREDIT', date: '20260515', amt: '200.00', name: 'May Dep' }],
      }),
      id,
    )

    const older = await processUpload(
      ofxFile('feb.ofx', {
        bal: '9999.00',
        dtasof: '20260228',
        txns: [{ type: 'CREDIT', date: '20260215', amt: '300.00', name: 'Feb Dep' }],
      }),
      id,
    )

    expect(older.anchorUpdated).toBeNull()
    const account = await db.accounts.get(id)
    expect(account?.anchorBalance).toBe(5000)
    expect(account?.anchorDate.getTime()).toBe(new Date(2026, 4, 31).getTime())
  })

  it('writes net-worth snapshots covering the statement month', async () => {
    const id = await addAccount('checking')
    await processUpload(
      ofxFile('jan.ofx', {
        bal: '1975.00',
        dtasof: '20260131',
        txns: [{ type: 'CREDIT', date: '20260105', amt: '1000.00', name: 'Paycheck' }],
      }),
      id,
    )

    const jan = await db.monthlySnapshots.where('month').equals('2026-01').first()
    expect(jan?.netWorth).toBe(1975)
    expect(await db.monthlySnapshots.count()).toBeGreaterThan(1)
  })
})
