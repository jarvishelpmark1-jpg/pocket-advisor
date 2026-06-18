import { describe, it, expect } from 'vitest'
import { findTransferPairs } from './reconcile'
import type { Transaction } from './types'

let nextId = 1
type TxnInput = {
  accountId: number
  amount: number
  date: string
  description?: string
  categoryId?: Transaction['categoryId']
  transferPairId?: number | null
}
function txn({ accountId, amount, date, description = 'x', categoryId = null, transferPairId = null }: TxnInput): Transaction {
  return {
    id: nextId++,
    accountId,
    amount,
    date: new Date(date),
    description,
    originalDescription: description,
    categoryId,
    confidence: 1,
    isReviewed: false,
    isRecurring: false,
    merchantName: null,
    notes: '',
    transferPairId,
    source: 'import',
    uploadId: 1,
    createdAt: new Date(date),
  }
}

describe('findTransferPairs', () => {
  it('pairs an outflow with an opposite-sign inflow in another account', () => {
    const a = txn({ accountId: 1, amount: -500, date: '2026-03-10', description: 'ONLINE TRANSFER TO SAVINGS' })
    const b = txn({ accountId: 2, amount: 500, date: '2026-03-11', description: 'TRANSFER FROM CHECKING' })
    const pairs = findTransferPairs([a, b])
    expect(pairs).toEqual([[a.id, b.id]])
  })

  it('matches a credit card payment (checking debit ↔ card credit)', () => {
    const pay = txn({ accountId: 1, amount: -300, date: '2026-03-15', description: 'CHASE CREDIT CARD PAYMENT' })
    const card = txn({ accountId: 9, amount: 300, date: '2026-03-15', description: 'PAYMENT THANK YOU' })
    expect(findTransferPairs([pay, card])).toEqual([[pay.id, card.id]])
  })

  it('does NOT pair same-amount income and expense without a transfer signal', () => {
    const paycheck = txn({ accountId: 1, amount: 2000, date: '2026-03-01', description: 'ACME CORP DEP' })
    const rent = txn({ accountId: 2, amount: -2000, date: '2026-03-03', description: 'GREENVILLE APTS' })
    expect(findTransferPairs([paycheck, rent])).toEqual([])
  })

  it('does not pair within the same account', () => {
    const out = txn({ accountId: 1, amount: -100, date: '2026-03-10', description: 'TRANSFER' })
    const inn = txn({ accountId: 1, amount: 100, date: '2026-03-10', description: 'TRANSFER' })
    expect(findTransferPairs([out, inn])).toEqual([])
  })

  it('does not pair outside the date window', () => {
    const out = txn({ accountId: 1, amount: -100, date: '2026-03-01', description: 'TRANSFER' })
    const inn = txn({ accountId: 2, amount: 100, date: '2026-03-20', description: 'TRANSFER' })
    expect(findTransferPairs([out, inn])).toEqual([])
  })

  it('skips ambiguous matches (more than one candidate inflow)', () => {
    const out = txn({ accountId: 1, amount: -100, date: '2026-03-10', description: 'TRANSFER' })
    const in1 = txn({ accountId: 2, amount: 100, date: '2026-03-10', description: 'TRANSFER' })
    const in2 = txn({ accountId: 3, amount: 100, date: '2026-03-11', description: 'TRANSFER' })
    expect(findTransferPairs([out, in1, in2])).toEqual([])
  })

  it('ignores transactions already in a pair', () => {
    const out = txn({ accountId: 1, amount: -100, date: '2026-03-10', description: 'TRANSFER', transferPairId: 999 })
    const inn = txn({ accountId: 2, amount: 100, date: '2026-03-10', description: 'TRANSFER' })
    expect(findTransferPairs([out, inn])).toEqual([])
  })
})
