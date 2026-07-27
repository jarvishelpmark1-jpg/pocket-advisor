import { describe, it, expect } from 'vitest'
import { hasUnsetBalance, assessAccounts } from './data-health'
import type { Account, Transaction } from './types'

const now = new Date(2026, 6, 12)

function account(over: Partial<Account>): Account {
  return {
    id: 1,
    name: 'Test',
    type: 'credit',
    institution: '',
    anchorBalance: 0,
    anchorDate: new Date(2026, 6, 11),
    color: '#000',
    createdAt: new Date(2026, 6, 11),
    updatedAt: new Date(2026, 6, 11),
    ...over,
  }
}

function txn(date: Date): Transaction {
  return {
    accountId: 1, date, description: 'x', originalDescription: 'x', amount: -5,
    categoryId: 'other', confidence: 0.5, isReviewed: true, isRecurring: false,
    merchantName: null, notes: '', transferPairId: null, source: 'import', uploadId: 1,
    createdAt: date,
  }
}

describe('hasUnsetBalance', () => {
  it('flags a seed-anchored account whose imports all predate the anchor', () => {
    const a = account({})
    const txns = [txn(new Date(2026, 0, 5)), txn(new Date(2026, 5, 1))]
    expect(hasUnsetBalance(a, txns)).toBe(true)
  })

  it('does not flag once a statement or manual edit re-anchored the account', () => {
    const a = account({ anchorBalance: 4482.99, anchorDate: new Date(2026, 4, 15) })
    expect(hasUnsetBalance(a, [txn(new Date(2026, 0, 5))])).toBe(false)
  })

  it('does not flag an account with a genuine zero balance and newer activity', () => {
    const a = account({})
    expect(hasUnsetBalance(a, [txn(new Date(2026, 6, 20))])).toBe(false)
  })

  it('flags a new-flow account still on its seed no matter when its activity is dated', () => {
    const a = account({ anchorSource: 'seed' })
    expect(hasUnsetBalance(a, [txn(new Date(2026, 6, 20))])).toBe(true)
  })

  it('trusts an explicitly-set balance even at zero', () => {
    const a = account({ anchorSource: 'manual' })
    expect(hasUnsetBalance(a, [txn(new Date(2026, 6, 20))])).toBe(false)
  })
})

describe('assessAccounts', () => {
  it('reports staleness with how far behind the data is', () => {
    const a = account({ anchorBalance: 100, anchorDate: new Date(2026, 2, 9) })
    const issues = assessAccounts([a], new Map([[1, [txn(new Date(2026, 2, 6))]]]), now)
    const stale = issues.find((i) => i.kind === 'stale')
    expect(stale?.daysBehind).toBeGreaterThan(120)
  })

  it('reports the largest internal gap', () => {
    const a = account({ anchorBalance: 100, anchorDate: new Date(2026, 6, 10) })
    const txns = [txn(new Date(2026, 0, 7)), txn(new Date(2026, 1, 6)), txn(new Date(2026, 6, 9))]
    const issues = assessAccounts([a], new Map([[1, txns]]), now)
    const gap = issues.find((i) => i.kind === 'gap')
    expect(gap?.gapStart?.getMonth()).toBe(1) // Feb 6 → Jul 9 is the biggest hole
  })

  it('is quiet for a healthy account', () => {
    const a = account({ anchorBalance: 100, anchorDate: new Date(2026, 6, 10) })
    const txns = [txn(new Date(2026, 6, 1)), txn(new Date(2026, 6, 9))]
    expect(assessAccounts([a], new Map([[1, txns]]), now)).toHaveLength(0)
  })
})
