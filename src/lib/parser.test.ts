import { describe, it, expect } from 'vitest'
import { parseCSV, parseOFX } from './parser'

describe('parseOFX statement balance', () => {
  const ofx = (balAmt: string) => `
<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260103<TRNAMT>-25.00<NAME>Coffee</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260105<TRNAMT>1000.00<NAME>Paycheck</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>${balAmt}<DTASOF>20260131</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`

  it('extracts the ledger balance and as-of date', () => {
    const { transactions, statement } = parseOFX(ofx('1975.00'))
    expect(transactions).toHaveLength(2)
    expect(statement?.endingBalance).toBe(1975)
    expect(statement?.endDate?.getFullYear()).toBe(2026)
    expect(statement?.endDate?.getMonth()).toBe(0) // January
    expect(statement?.endDate?.getDate()).toBe(31)
  })

  it('keeps a negative balance (amount owed) signed for liabilities', () => {
    const { statement } = parseOFX(ofx('-432.10'))
    expect(statement?.endingBalance).toBe(-432.1)
  })

  it('returns null statement when there is no LEDGERBAL', () => {
    const noBal = `<OFX><STMTTRN><DTPOSTED>20260103<TRNAMT>-25.00<NAME>X</STMTTRN></OFX>`
    expect(parseOFX(noBal).statement).toBeNull()
  })
})

describe('parseCSV statement balance', () => {
  it('takes the ending balance from the latest-dated row', () => {
    const csv = [
      'Date,Description,Amount,Balance',
      '01/05/2026,Paycheck,1000.00,2000.00',
      '01/10/2026,Coffee,-5.00,1995.00',
    ].join('\n')
    const { transactions, statement } = parseCSV(csv)
    expect(transactions).toHaveLength(2)
    expect(statement?.endingBalance).toBe(1995)
    expect(statement?.endDate?.getDate()).toBe(10)
  })

  it('picks the latest date even when rows are newest-first', () => {
    const csv = [
      'Date,Description,Amount,Running Balance',
      '01/10/2026,Coffee,-5.00,1995.00',
      '01/05/2026,Paycheck,1000.00,2000.00',
    ].join('\n')
    expect(parseCSV(csv).statement?.endingBalance).toBe(1995)
  })

  it('returns null statement when there is no balance column', () => {
    const csv = ['Date,Description,Amount', '01/05/2026,Paycheck,1000.00'].join('\n')
    expect(parseCSV(csv).statement).toBeNull()
  })
})

describe('parseCSV description column choice', () => {
  it('prefers the merchant Name column over a reference-number Memo (Elan/US Bank card CSV)', () => {
    const csv = [
      'Date,Transaction,Name,Memo,Amount',
      '2026-01-02,DEBIT,MENARDS 3344 SPRINGFIELD MO,24492156363800935383143; 05300;,-24.97',
      '2026-01-05,DEBIT,MAVERIK #5193 SPRINGFIELD MO,24492156363800935383144; 05542;,-42.00',
      '2026-01-15,CREDIT,PAYMENT THANK YOU,24492156363800935383145; 00000;,500.00',
    ].join('\n')
    const { transactions } = parseCSV(csv)
    expect(transactions).toHaveLength(3)
    expect(transactions[0].description).toBe('MENARDS 3344 SPRINGFIELD MO')
    expect(transactions[0].amount).toBe(-24.97)
    expect(transactions[2].description).toBe('PAYMENT THANK YOU')
    expect(transactions[2].amount).toBe(500)
  })

  it('still uses Memo when it is the only descriptive column', () => {
    const csv = [
      'Date,Memo,Amount',
      '01/02/2026,STARBUCKS STORE 14442,-6.45',
    ].join('\n')
    const { transactions } = parseCSV(csv)
    expect(transactions[0].description).toBe('STARBUCKS STORE 14442')
  })

  it('parses Apple Card style headers with Amount (USD)', () => {
    const csv = [
      'Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD)',
      '01/03/2026,01/04/2026,ACE HARDWARE,ACE HARDWARE,Shopping,Purchase,52.10',
    ].join('\n')
    const { transactions } = parseCSV(csv)
    expect(transactions).toHaveLength(1)
    expect(transactions[0].description).toBe('ACE HARDWARE')
    expect(transactions[0].amount).toBe(52.10)
  })
})
