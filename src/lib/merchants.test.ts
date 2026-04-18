import { describe, it, expect } from 'vitest'
import { matchMerchant } from './merchants'

describe('matchMerchant', () => {
  it('matches common grocery stores', () => {
    expect(matchMerchant('WALMART SUPERCENTER')?.category).toBe('groceries')
    expect(matchMerchant('KROGER #1234')?.category).toBe('groceries')
    expect(matchMerchant('COSTCO WHOLESALE')?.category).toBe('groceries')
    expect(matchMerchant('ALDI FOODS')?.category).toBe('groceries')
    expect(matchMerchant('TRADER JOES')?.category).toBe('groceries')
    expect(matchMerchant('WHOLE FOODS MKT')?.category).toBe('groceries')
    expect(matchMerchant('PUBLIX SUPER')?.category).toBe('groceries')
  })

  it('matches restaurants and fast food', () => {
    expect(matchMerchant('MCDONALDS F1234')?.category).toBe('dining')
    expect(matchMerchant('STARBUCKS COFFEE')?.category).toBe('dining')
    expect(matchMerchant('CHICK-FIL-A')?.category).toBe('dining')
    expect(matchMerchant('CHIPOTLE ONLINE')?.category).toBe('dining')
  })

  it('returns merchant name', () => {
    expect(matchMerchant('STARBUCKS #12345')?.name).toBe('Starbucks')
    expect(matchMerchant('WALMART NEIGHBORHOOD')?.name).toBe('Walmart')
    expect(matchMerchant('MCDONALDS')?.name).toBe("McDonald's")
  })

  it('matches subscriptions', () => {
    expect(matchMerchant('NETFLIX.COM')?.category).toBe('subscriptions')
    expect(matchMerchant('SPOTIFY USA')?.category).toBe('subscriptions')
    expect(matchMerchant('APPLE.COM/BILL')?.category).toBe('subscriptions')
  })

  it('matches gas stations', () => {
    expect(matchMerchant('SHELL OIL')?.category).toBe('transportation')
    expect(matchMerchant('EXXON MOBIL')?.category).toBe('transportation')
    expect(matchMerchant('CHEVRON STATION')?.category).toBe('transportation')
  })

  it('matches ride-share and transport', () => {
    expect(matchMerchant('UBER TRIP')?.category).toBe('transportation')
    expect(matchMerchant('LYFT RIDE')?.category).toBe('transportation')
  })

  it('returns null for unrecognized descriptions', () => {
    expect(matchMerchant('RANDOM UNKNOWN STORE 12345')).toBeNull()
    expect(matchMerchant('XYZZY CORPORATION')).toBeNull()
  })

  it('matches case-insensitively', () => {
    expect(matchMerchant('walmart')?.name).toBe('Walmart')
    expect(matchMerchant('WALMART')?.name).toBe('Walmart')
    expect(matchMerchant('Walmart')?.name).toBe('Walmart')
  })

  it('distinguishes Costco from Costco Gas', () => {
    expect(matchMerchant('COSTCO GAS')?.category).toBe('transportation')
    expect(matchMerchant('COSTCO WHOLESALE')?.category).toBe('groceries')
  })
})
