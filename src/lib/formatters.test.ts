import { describe, it, expect } from 'vitest'
import { formatCurrency, formatPercent, cleanDescription, formatNumber } from './formatters'

describe('formatCurrency', () => {
  it('formats positive amounts', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('formats negative amounts', () => {
    expect(formatCurrency(-50.99)).toBe('-$50.99')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('rounds to two decimal places', () => {
    expect(formatCurrency(10.999)).toBe('$11.00')
  })

  it('uses compact notation for large amounts', () => {
    const result = formatCurrency(1500, true)
    expect(result).toMatch(/\$1\.5K/i)
  })

  it('does not use compact for small amounts even when compact=true', () => {
    expect(formatCurrency(500, true)).toBe('$500.00')
  })
})

describe('formatPercent', () => {
  it('formats positive with plus sign', () => {
    expect(formatPercent(12.34)).toBe('+12.3%')
  })

  it('formats negative without plus sign', () => {
    expect(formatPercent(-5.67)).toBe('-5.7%')
  })

  it('formats zero with plus sign', () => {
    expect(formatPercent(0)).toBe('+0.0%')
  })
})

describe('formatNumber', () => {
  it('formats with comma separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('formats small numbers unchanged', () => {
    expect(formatNumber(42)).toBe('42')
  })
})

describe('cleanDescription', () => {
  it('strips long digit sequences and collapses spaces', () => {
    expect(cleanDescription('WALMART 1234567890 PURCHASE')).toBe('WALMART PURCHASE')
  })

  it('collapses multiple spaces', () => {
    expect(cleanDescription('WALMART   GROCERY')).toBe('WALMART GROCERY')
  })

  it('strips asterisks and hashes', () => {
    expect(cleanDescription('SQ**LOCAL CAFE##123')).toBe('SQLOCAL CAFE123')
  })

  it('truncates to 50 characters', () => {
    const long = 'A'.repeat(100)
    expect(cleanDescription(long).length).toBe(50)
  })

  it('trims whitespace', () => {
    expect(cleanDescription('  WALMART  ')).toBe('WALMART')
  })
})
