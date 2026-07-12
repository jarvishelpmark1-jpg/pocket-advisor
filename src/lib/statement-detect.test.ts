import { describe, it, expect } from 'vitest'
import { detectStatementBalance, fixFutureDates } from './statement-detect'

const lines = (...texts: string[]) => texts.map((text) => ({ text }))

describe('detectStatementBalance', () => {
  it('prefers "New Balance" and ignores the previous balance', () => {
    const s = detectStatementBalance(lines('Previous Balance $100.00', 'New Balance $1,234.56'))
    expect(s?.endingBalance).toBe(1234.56)
  })

  it('reads the closing date from a statement period range', () => {
    const s = detectStatementBalance(
      lines('Statement Period 05/16/2026 - 06/15/2026', 'New Balance $50.00'),
    )
    expect(s?.endDate?.getMonth()).toBe(5) // June
    expect(s?.endDate?.getDate()).toBe(15)
  })

  it('falls back through tiers to ending/closing balance', () => {
    expect(detectStatementBalance(lines('Ending Balance 5,000.00'))?.endingBalance).toBe(5000)
    expect(detectStatementBalance(lines('Closing Balance $42.00'))?.endingBalance).toBe(42)
  })

  it('reads a textual close date off the balance line (Bank of America style)', () => {
    const s = detectStatementBalance(lines('Ending balance on June 8, 2026 $2,898.78'))
    expect(s?.endingBalance).toBe(2898.78)
    expect(s?.endDate?.getFullYear()).toBe(2026)
    expect(s?.endDate?.getMonth()).toBe(5) // June
    expect(s?.endDate?.getDate()).toBe(8)
  })

  it('reads the closing date from a textual statement period range', () => {
    const s = detectStatementBalance(
      lines('for May 8, 2026 to June 8, 2026', 'New Balance $50.00'),
    )
    expect(s?.endDate?.getMonth()).toBe(5) // June (the closing date, not May)
    expect(s?.endDate?.getDate()).toBe(8)
  })

  it('returns null when only a beginning balance is present', () => {
    expect(detectStatementBalance(lines('Beginning Balance $500.00'))).toBeNull()
  })

  it('returns null with no balance line at all', () => {
    expect(detectStatementBalance(lines('Thank you for banking with us'))).toBeNull()
  })
})

describe('fixFutureDates', () => {
  const txn = (date: Date, description = 'x') => ({ date, description, amount: -1 })

  it('pulls December rows on a Dec–Jan statement back to the prior year', () => {
    const close = new Date(2026, 0, 14) // Jan 14, 2026
    const fixed = fixFutureDates(
      [txn(new Date(2026, 11, 28)), txn(new Date(2026, 0, 3))], // 12/28 misparsed as 2026
      close,
    )
    expect(fixed[0].date).toEqual(new Date(2025, 11, 28))
    expect(fixed[1].date).toEqual(new Date(2026, 0, 3))
  })

  it('leaves dates within the grace window after the close alone', () => {
    const close = new Date(2026, 5, 8)
    const fixed = fixFutureDates([txn(new Date(2026, 5, 10))], close)
    expect(fixed[0].date).toEqual(new Date(2026, 5, 10))
  })

  it('uses today as the limit when the close date is unknown', () => {
    const now = new Date(2026, 6, 10)
    const fixed = fixFutureDates([txn(new Date(2026, 10, 3)), txn(new Date(2026, 5, 1))], null, now)
    expect(fixed[0].date).toEqual(new Date(2025, 10, 3))
    expect(fixed[1].date).toEqual(new Date(2026, 5, 1))
  })
})

describe('Apple Card statement (real layout, 2026-07-12)', () => {
  it('reads Total Balance and the textual as-of close date, skipping previous balances', () => {
    const s = detectStatementBalance(
      lines(
        'Your January Balance',
        'as of Jan 31, 2026',
        'Previous Monthly Balance $3,749.14',
        'Previous Total Balance $3,749.14',
        'Total Balance $1,272.22',
        'Total payments for this period -$3,749.14',
      ),
    )
    expect(s?.endingBalance).toBe(1272.22)
    expect(s?.endDate?.getFullYear()).toBe(2026)
    expect(s?.endDate?.getMonth()).toBe(0)
    expect(s?.endDate?.getDate()).toBe(31)
  })

  it('still prefers a bank "New Balance" over a generic total', () => {
    const s = detectStatementBalance(lines('Total Balance $999.99', 'New Balance $1,234.56'))
    expect(s?.endingBalance).toBe(1234.56)
  })
})
