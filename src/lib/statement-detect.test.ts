import { describe, it, expect } from 'vitest'
import { detectStatementBalance } from './statement-detect'

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

  it('returns null when only a beginning balance is present', () => {
    expect(detectStatementBalance(lines('Beginning Balance $500.00'))).toBeNull()
  })

  it('returns null with no balance line at all', () => {
    expect(detectStatementBalance(lines('Thank you for banking with us'))).toBeNull()
  })
})
