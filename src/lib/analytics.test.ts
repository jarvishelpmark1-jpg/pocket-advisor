import { describe, it, expect } from 'vitest'
import { deriveAccountBalance, netWorthContribution } from './analytics'
import type { Account, Transaction } from './types'

function account(over: Partial<Account> = {}): Account {
  const now = new Date('2026-01-01')
  return {
    id: 1,
    name: 'Test',
    type: 'checking',
    institution: '',
    anchorBalance: 0,
    anchorDate: now,
    color: '#000',
    createdAt: now,
    updatedAt: now,
    ...over,
  }
}

function txn(amount: number, date: string, over: Partial<Transaction> = {}): Transaction {
  return {
    accountId: 1,
    date: new Date(date),
    description: 'x',
    originalDescription: 'x',
    amount,
    categoryId: null,
    confidence: 1,
    isReviewed: true,
    isRecurring: false,
    merchantName: null,
    notes: '',
    transferPairId: null,
    source: 'import',
    uploadId: 0,
    createdAt: new Date(date),
    ...over,
  }
}

describe('deriveAccountBalance', () => {
  it('returns the anchor when there are no transactions', () => {
    expect(deriveAccountBalance(account({ anchorBalance: 1200 }), [])).toBe(1200)
  })

  it('adds deposits and subtracts spending for asset accounts', () => {
    const acct = account({ anchorBalance: 1000, anchorDate: new Date('2026-03-01') })
    const txns = [txn(500, '2026-03-05'), txn(-200, '2026-03-10')]
    expect(deriveAccountBalance(acct, txns)).toBe(1300)
  })

  it('ignores transactions on or before the anchor date', () => {
    const acct = account({ anchorBalance: 1000, anchorDate: new Date('2026-03-01') })
    // dated before the anchor — already baked into the anchor, must not double count
    const txns = [txn(-9999, '2026-02-15'), txn(50, '2026-03-02')]
    expect(deriveAccountBalance(acct, txns)).toBe(1050)
  })

  it('treats purchases as increasing and payments as decreasing amount owed for liabilities', () => {
    const card = account({ type: 'credit', anchorBalance: 500, anchorDate: new Date('2026-03-01') })
    // a -200 purchase raises the balance owed to 700; a +300 payment lowers it to 400
    const txns = [txn(-200, '2026-03-05'), txn(300, '2026-03-20')]
    expect(deriveAccountBalance(card, txns)).toBe(400)
  })
})

describe('netWorthContribution', () => {
  it('counts asset balances positively', () => {
    expect(netWorthContribution(account({ type: 'savings' }), 2500)).toBe(2500)
  })

  it('subtracts liability balances', () => {
    expect(netWorthContribution(account({ type: 'credit' }), 800)).toBe(-800)
    expect(netWorthContribution(account({ type: 'loan' }), 15000)).toBe(-15000)
  })
})
