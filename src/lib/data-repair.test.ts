import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, clearAllData } from './db'
import { removeSummaryRowTransactions } from './data-repair'
import type { Transaction } from './types'

function txn(over: Partial<Transaction>): Transaction {
  return {
    accountId: 1,
    date: new Date(2026, 0, 5),
    description: 'x',
    originalDescription: 'x',
    amount: -10,
    categoryId: null,
    confidence: 0.5,
    isReviewed: false,
    isRecurring: false,
    merchantName: null,
    notes: '',
    transferPairId: null,
    source: 'import',
    uploadId: 1,
    createdAt: new Date(2026, 0, 5),
    ...over,
  }
}

beforeEach(async () => {
  await clearAllData()
})

describe('removeSummaryRowTransactions', () => {
  it('removes summary rows that older parsers let in, and nothing else', async () => {
    await db.transactions.bulkAdd([
      txn({ description: 'Beginning balance as of 01/01/2026', amount: 32370 }),
      txn({ description: 'GUSTO PAYROLL', amount: 2000, isReviewed: true }),
      txn({ description: 'NEW BALANCE #123 BOSTON MA', amount: -129.99 }),
    ])

    const removed = await removeSummaryRowTransactions()
    expect(removed).toBe(1)

    const left = await db.transactions.toArray()
    expect(left.map((t) => t.description).sort()).toEqual([
      'GUSTO PAYROLL',
      'NEW BALANCE #123 BOSTON MA',
    ])
    expect(left.find((t) => t.description === 'GUSTO PAYROLL')?.isReviewed).toBe(true)
  })

  it('unpairs a transfer partner instead of leaving a dangling link', async () => {
    const goodId = (await db.transactions.add(txn({ description: 'TRANSFER IN', amount: 500 }))) as number
    const badId = (await db.transactions.add(
      txn({ description: 'Ending balance', amount: -500, transferPairId: goodId })
    )) as number
    await db.transactions.update(goodId, { transferPairId: badId })

    await removeSummaryRowTransactions()

    const survivor = await db.transactions.get(goodId)
    expect(survivor?.transferPairId).toBeNull()
  })

  it('is a no-op on clean data', async () => {
    await db.transactions.add(txn({ description: 'STARBUCKS' }))
    expect(await removeSummaryRowTransactions()).toBe(0)
    expect(await db.transactions.count()).toBe(1)
  })
})
