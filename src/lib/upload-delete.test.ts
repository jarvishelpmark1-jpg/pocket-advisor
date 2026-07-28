import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
// pdf-parser pulls in pdfjs, which references DOM-only globals at import time
// and blows up under Node. These tests use CSV/OFX, so stub it out.
vi.mock('./pdf-parser', () => ({ parsePDF: vi.fn() }))
import { db, clearAllData } from './db'
import { processUpload } from './upload-processor'
import { deleteUpload } from './upload-delete'
import { hasUnsetBalance } from './data-health'
import type { AccountType } from './types'

type Txn = { type: 'DEBIT' | 'CREDIT'; date: string; amt: string; name: string }

function ofxFile(name: string, opts: { bal: string; dtasof: string; txns: Txn[] }): File {
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

function csvFile(name: string, rows: string[]): File {
  return new File([['Date,Description,Amount', ...rows].join('\n')], name, { type: 'text/csv' })
}

async function addAccount(type: AccountType, name = 'Test') {
  const now = new Date('2026-06-27')
  const id = await db.accounts.add({
    name,
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

describe('deleteUpload', () => {
  it('removes only the deleted upload and preserves other uploads and their review state', async () => {
    const id = await addAccount('checking')
    await processUpload(csvFile('march.csv', ['03/04/2026,STARBUCKS STORE 14442,-6.45']), id)
    const wrong = await processUpload(
      csvFile('joint.csv', ['04/01/2026,GUSTO PAYROLL,4250.00', '04/02/2026,TRADER JOES,-87.34']),
      id
    )

    // simulate the user having reviewed their earlier work
    await db.transactions
      .where('uploadId')
      .notEqual(wrong.transactions[0].uploadId)
      .modify({ isReviewed: true, categoryId: 'dining' })

    const wrongUploadId = wrong.transactions[0].uploadId
    const result = await deleteUpload(wrongUploadId)

    expect(result.removedTransactions).toBe(2)
    const remaining = await db.transactions.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].description).toBe('STARBUCKS STORE 14442')
    expect(remaining[0].isReviewed).toBe(true)
    expect(remaining[0].categoryId).toBe('dining')
    expect(await db.uploads.count()).toBe(1)
  })

  it('unpairs a transfer partner in another account instead of leaving a dangling link', async () => {
    const checking = await addAccount('checking', 'Checking')
    const card = await addAccount('credit', 'Card')

    await processUpload(
      csvFile('checking.csv', ['03/10/2026,ONLINE PAYMENT TO CREDIT CARD,-500.00']),
      checking
    )
    const cardUpload = await processUpload(
      // charges already signed negative so the liability sign-flip stays off
      csvFile('card.csv', [
        '03/05/2026,STORE A,-20.00',
        '03/06/2026,STORE B,-30.00',
        '03/11/2026,ONLINE PAYMENT THANK YOU,500.00',
      ]),
      card
    )

    const paired = await db.transactions.where('accountId').equals(checking).first()
    expect(paired?.transferPairId).not.toBeNull() // sanity: reconcile linked them

    const result = await deleteUpload(cardUpload.transactions[0].uploadId)
    expect(result.unpaired).toBe(1)

    const survivor = await db.transactions.where('accountId').equals(checking).first()
    expect(survivor?.transferPairId).toBeNull()
  })

  it('restores the exact previous anchor when deleting the statement that replaced it', async () => {
    const id = await addAccount('checking')
    await processUpload(
      ofxFile('jan.ofx', {
        bal: '1000.00',
        dtasof: '20260131',
        txns: [{ type: 'CREDIT', date: '20260105', amt: '100.00', name: 'Jan Dep' }],
      }),
      id
    )
    const feb = await processUpload(
      ofxFile('feb.ofx', {
        bal: '2000.00',
        dtasof: '20260228',
        txns: [{ type: 'CREDIT', date: '20260215', amt: '200.00', name: 'Feb Dep' }],
      }),
      id
    )

    const result = await deleteUpload(feb.transactions[0].uploadId)
    expect(result.anchorOutcome).toBe('restored')

    const account = await db.accounts.get(id)
    expect(account?.anchorBalance).toBe(1000)
    expect(account?.anchorDate.getTime()).toBe(new Date(2026, 0, 31).getTime())
    expect(account?.anchorSource).toBe('statement')
  })

  it('leaves the anchor alone when a newer statement has since replaced it', async () => {
    const id = await addAccount('checking')
    const jan = await processUpload(
      ofxFile('jan.ofx', {
        bal: '1000.00',
        dtasof: '20260131',
        txns: [{ type: 'CREDIT', date: '20260105', amt: '100.00', name: 'Jan Dep' }],
      }),
      id
    )
    await processUpload(
      ofxFile('feb.ofx', {
        bal: '2000.00',
        dtasof: '20260228',
        txns: [{ type: 'CREDIT', date: '20260215', amt: '200.00', name: 'Feb Dep' }],
      }),
      id
    )

    const result = await deleteUpload(jan.transactions[0].uploadId)
    expect(result.anchorOutcome).toBe('untouched')

    const account = await db.accounts.get(id)
    expect(account?.anchorBalance).toBe(2000)
  })

  it('resets a legacy-set anchor to flagged "never set" rather than keeping a wrong number', async () => {
    const id = await addAccount('checking')
    const r = await processUpload(
      ofxFile('bad.ofx', {
        bal: '5000.00',
        dtasof: '20260630',
        txns: [{ type: 'CREDIT', date: '20260615', amt: '100.00', name: 'Dep' }],
      }),
      id
    )
    // strip the undo bookkeeping to simulate an upload from before it existed
    const uploadId = r.transactions[0].uploadId
    await db.uploads
      .where('id')
      .equals(uploadId)
      .modify((u) => {
        delete u.anchorBefore
        delete u.anchorSet
      })

    const result = await deleteUpload(uploadId)
    expect(result.anchorOutcome).toBe('reset')

    const account = (await db.accounts.get(id))!
    expect(account.anchorSource).toBe('seed')
    expect(account.anchorBalance).toBe(0)
    // any remaining data on this account would now flag as unset, not pass as real
    expect(hasUnsetBalance(account, [{ date: new Date(2026, 5, 20) }])).toBe(true)
  })

  it('refreshes net-worth history so the deleted month is recomputed', async () => {
    const id = await addAccount('checking')
    await processUpload(
      ofxFile('jan.ofx', {
        bal: '1000.00',
        dtasof: '20260131',
        txns: [{ type: 'CREDIT', date: '20260105', amt: '100.00', name: 'Jan Dep' }],
      }),
      id
    )
    const feb = await processUpload(
      ofxFile('feb.ofx', {
        bal: '2000.00',
        dtasof: '20260228',
        txns: [{ type: 'CREDIT', date: '20260215', amt: '200.00', name: 'Feb Dep' }],
      }),
      id
    )
    await deleteUpload(feb.transactions[0].uploadId)

    const feb28 = await db.monthlySnapshots.where('month').equals('2026-02').first()
    expect(feb28?.netWorth).toBe(1000) // back to the January anchor, Feb activity gone
  })
})
