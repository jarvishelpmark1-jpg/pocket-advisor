import { describe, it, expect } from 'vitest'
import { suggestSpokeImports } from './import-suggestions'
import type { Transaction } from './types'

let id = 1
function txn(over: { amount: number; description?: string; categoryId?: Transaction['categoryId']; transferPairId?: number | null; merchantName?: string | null }): Transaction {
  return {
    id: id++,
    accountId: 1,
    date: new Date('2026-03-10'),
    description: over.description ?? 'x',
    originalDescription: over.description ?? 'x',
    amount: over.amount,
    categoryId: over.categoryId ?? null,
    confidence: 1,
    isReviewed: true,
    isRecurring: false,
    merchantName: over.merchantName ?? null,
    notes: '',
    transferPairId: over.transferPairId ?? null,
    source: 'import',
    uploadId: 1,
    createdAt: new Date('2026-03-10'),
  }
}

describe('suggestSpokeImports', () => {
  it('surfaces card/loan payments ranked by total dollars', () => {
    const txns = [
      txn({ amount: -400, description: 'CHASE CREDIT CARD PAYMENT', categoryId: 'debt_payment' }),
      txn({ amount: -350, description: 'CHASE CREDIT CARD PAYMENT', categoryId: 'debt_payment' }),
      txn({ amount: -1800, description: 'WELLS FARGO MORTGAGE PAYMENT', categoryId: 'debt_payment' }),
      txn({ amount: -42, description: 'STARBUCKS', categoryId: 'dining' }),
    ]
    const s = suggestSpokeImports(txns)
    expect(s[0].label).toContain('WELLS')
    expect(s[0].total).toBe(1800)
    expect(s[1].total).toBe(750) // two Chase payments merged
    expect(s.find((x) => x.label.includes('STARBUCKS'))).toBeUndefined()
  })

  it('ignores transfers already matched to an imported account', () => {
    const txns = [
      txn({ amount: -500, description: 'ONLINE TRANSFER TO SAVINGS', categoryId: 'transfer', transferPairId: 99 }),
    ]
    expect(suggestSpokeImports(txns)).toEqual([])
  })

  it('filters out accounts already imported by label', () => {
    const txns = [txn({ amount: -400, description: 'AMEX PAYMENT', categoryId: 'debt_payment', merchantName: 'Amex' })]
    expect(suggestSpokeImports(txns, ['Amex Gold'])).toEqual([])
  })

  it('ignores regular spending', () => {
    const txns = [txn({ amount: -60, description: 'WHOLE FOODS', categoryId: 'groceries' })]
    expect(suggestSpokeImports(txns)).toEqual([])
  })
})
