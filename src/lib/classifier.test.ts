import { describe, it, expect } from 'vitest'
import { cleanForClassification } from './classifier'

describe('cleanForClassification', () => {
  it('strips POS DEBIT prefixes', () => {
    expect(cleanForClassification('POS DEBIT WALMART GROCERY')).toBe('WALMART GROCERY')
    expect(cleanForClassification('POS PURCHASE STARBUCKS')).toBe('STARBUCKS')
  })

  it('strips DEBIT CARD PURCHASE prefix', () => {
    expect(cleanForClassification('DEBIT CARD PURCHASE CHIPOTLE')).toBe('CHIPOTLE')
  })

  it('strips VISA/MASTERCARD prefixes', () => {
    expect(cleanForClassification('VISA DEBIT AMAZON.COM')).toBe('AMAZON.COM')
    expect(cleanForClassification('MASTERCARD DEBIT TARGET')).toBe('TARGET')
  })

  it('strips CHECK CARD PURCHASE prefix', () => {
    expect(cleanForClassification('CHECK CRD PURCHASE WHOLE FOODS')).toBe('WHOLE FOODS')
  })

  it('strips RECURRING DEBIT prefix', () => {
    expect(cleanForClassification('RECURRING DEBIT NETFLIX.COM')).toBe('NETFLIX.COM')
    expect(cleanForClassification('RECURRING PAYMENT SPOTIFY')).toBe('SPOTIFY')
  })

  it('strips ACH prefixes', () => {
    expect(cleanForClassification('ACH DEBIT GEICO INSURANCE')).toBe('GEICO INSURANCE')
    expect(cleanForClassification('ACH PAYMENT ADP PAYROLL')).toBe('ADP PAYROLL')
  })

  it('strips ELECTRONIC prefixes', () => {
    expect(cleanForClassification('ELECTRONIC DEBIT TMOBILE')).toBe('TMOBILE')
  })

  it('strips dates in MM/DD format', () => {
    expect(cleanForClassification('WALMART 04/15')).toBe('WALMART')
  })

  it('strips dates in YYYY-MM-DD format', () => {
    expect(cleanForClassification('WALMART 2024-04-15')).toBe('WALMART')
  })

  it('strips card/reference numbers', () => {
    expect(cleanForClassification('WALMART CARD 1234')).toBe('WALMART')
    expect(cleanForClassification('STARBUCKS REF#98765')).toBe('STARBUCKS')
  })

  it('strips masked card numbers like XXXX1234', () => {
    expect(cleanForClassification('WALMART XXXX4321')).toBe('WALMART')
  })

  it('strips long digit sequences', () => {
    expect(cleanForClassification('WALMART 1234567890')).toBe('WALMART')
  })

  it('strips city/state suffixes', () => {
    expect(cleanForClassification('WALMART BENTONVILLE AR')).toBe('WALMART')
  })

  it('strips country suffixes', () => {
    expect(cleanForClassification('AMAZON.COM US')).toBe('AMAZON.COM')
  })

  it('strips store numbers', () => {
    expect(cleanForClassification('TARGET STORE 5678')).toBe('TARGET')
    expect(cleanForClassification('WALMART STORE #1234')).toBe('WALMART STORE')
  })

  it('strips Square (SQ*) prefix', () => {
    expect(cleanForClassification('SQ *LOCAL COFFEE SHOP')).toBe('LOCAL COFFEE SHOP')
  })

  it('strips Toast (TST*) prefix', () => {
    expect(cleanForClassification('TST* BURGER JOINT')).toBe('BURGER JOINT')
  })

  it('strips Shopify (SP*) prefix', () => {
    expect(cleanForClassification('SP * ONLINE STORE')).toBe('ONLINE STORE')
  })

  it('strips PayPal (PP*) prefix', () => {
    expect(cleanForClassification('PP*UBER EATS')).toBe('UBER EATS')
  })

  it('normalizes whitespace', () => {
    expect(cleanForClassification('WALMART   GROCERY   STORE')).toBe('WALMART GROCERY STORE')
  })

  it('handles combined noise', () => {
    const messy = 'POS DEBIT VISA SQ *LOCAL CAFE 04/15 CARD 9876 AUSTIN TX 78701'
    const result = cleanForClassification(messy)
    expect(result).toContain('LOCAL CAFE')
    expect(result).not.toMatch(/\d{4,}/)
    expect(result).not.toContain('POS DEBIT')
  })
})
