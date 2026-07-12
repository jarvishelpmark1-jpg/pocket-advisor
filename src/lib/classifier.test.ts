import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { cleanForClassification, classifyTransaction } from './classifier'

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

describe('real-statement regressions (2026-07-11)', () => {
  const t = (description: string, amount: number) => ({ date: new Date(2026, 4, 10), description, amount })

  it('classifies a payroll deposit from a medical employer as income, not healthcare', async () => {
    const r = await classifyTransaction(t('L E COX MEDICAL DES:PAYROLL ID: INDN:KATHERINE VIAFARA QUIN CO', 821.87))
    expect(r.categoryId).toBe('income_salary')
  })

  it('does not match AVIS inside DAVIS SUPPLY', async () => {
    const r = await classifyTransaction(t('2270 - DAVIS SUPPLY EDMOND OK', -648.30))
    expect(r.categoryId).not.toBe('travel')
    expect(r.categoryId).toBe('shopping') // SUPPLY keyword
  })

  it('does not match 7-11 inside a phone number', async () => {
    const r = await classifyTransaction(t('SP AQUABLU MOSAICS 180-09711442 FL', -2272.60))
    expect(r.categoryId).not.toBe('transportation')
  })

  it('classifies T-Mobile as utilities, not the Exxon/Mobil pattern', async () => {
    const r = await classifyTransaction(t('T-MOBILE AUTOPAY', -85.00))
    expect(r.categoryId).toBe('utilities')
  })

  it('does not match TIRE inside RETIREMENT or ATM inside TREATMENT', async () => {
    const a = await classifyTransaction(t('VANGUARD RETIREMENT CONTRIBUTION', -500))
    expect(a.categoryId).not.toBe('auto')
    const b = await classifyTransaction(t('SPINAL TREATMENT CENTER', -120))
    expect(b.categoryId).not.toBe('atm_cash')
  })

  it('covers the merchants from the real card statement', async () => {
    expect((await classifyTransaction(t('BWI SANITATION 877-2941000 MO', -92.65))).categoryId).toBe('utilities')
    expect((await classifyTransaction(t('CITYUTILITIESOFS DES:CITYUTIL ID:CITYUTILITIESOF', -244.62))).categoryId).toBe('utilities')
    expect((await classifyTransaction(t('MENARDS 3344 SPRINGFIELD MO', -24.97))).categoryId).toBe('shopping')
    expect((await classifyTransaction(t('MAVERIK #5193 SPRINGFIELD MO', -42.00))).categoryId).toBe('transportation')
    expect((await classifyTransaction(t('DNH*GODADDY 480-505-8855 AZ', -23.19))).categoryId).toBe('subscriptions')
    expect((await classifyTransaction(t('MISSOURI TILE SPRINGFIELD MO', -1266.48))).categoryId).toBe('shopping')
    expect((await classifyTransaction(t('Arndt CPA 141-7882900 MO', -650))).categoryId).toBe('fees')
    expect((await classifyTransaction(t('WAL-MART #2221 SPRINGFIELD MO', -25.37))).categoryId).toBe('groceries')
  })

  it('treats supply houses as purchases, not utility bills', async () => {
    expect((await classifyTransaction(t("LOYD'S ELECTRIC SUPPLY SPRINGFIELD MO", -153.65))).categoryId).toBe('shopping')
    expect((await classifyTransaction(t('OG&E ELECTRIC SERVICES OK', -140.22))).categoryId).toBe('utilities')
  })

  it('does not misread hospitality, premium tiers, or Southwest Grill', async () => {
    expect((await classifyTransaction(t('TST* HOGSALT HOSPITALITY CHICAGO IL', -84.00))).categoryId).not.toBe('healthcare')
    expect((await classifyTransaction(t('LINKEDIN PREMIUM SUBSCRIPTION', -39.99))).categoryId).not.toBe('insurance')
    expect((await classifyTransaction(t('MOES SOUTHWEST GRILL #123', -12.40))).categoryId).toBe('dining')
  })
})

describe('real-backup regressions (2026-07-12)', () => {
  const t = (description: string, amount: number) => ({ date: new Date(2026, 5, 10), description, amount })

  it('codes brokerage ACH moves as transfers, not salary', async () => {
    const r = await classifyTransaction(t('INTERACTIVE BROK DES:ACH TRANSF ID:REQ :XXXXXXXXX INDN:ZACH ROBERT GAGNON CO', 1600))
    expect(r.categoryId).toBe('transfer')
    const out = await classifyTransaction(t('FIDELITY DES:ACH TRANSF', -2000))
    expect(out.categoryId).toBe('transfer')
  })

  it('codes Apple Daily Cash as cashback, not generic income', async () => {
    expect((await classifyTransaction(t('Daily Cash Deposit', 4.52))).categoryId).toBe('income_refund')
    expect((await classifyTransaction(t('DAILY CASH ADJUSTMENT', 0.61))).categoryId).toBe('income_refund')
  })
})
