import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { CategoryId } from '../lib/types'
import { startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { learnFromCorrection } from '../lib/classifier'
import { reconcileTransfers } from '../lib/reconcile'

export function useTransactions(month?: string) {
  return useLiveQuery(async () => {
    if (!month) return db.transactions.orderBy('date').reverse().limit(100).toArray()

    const start = startOfMonth(parseISO(month + '-01'))
    const end = endOfMonth(start)
    return db.transactions
      .where('date')
      .between(start, end, true, true)
      .reverse()
      .sortBy('date')
  }, [month])
}

export function useUnreviewedTransactions() {
  return useLiveQuery(() =>
    db.transactions
      .filter(t => !t.isReviewed)
      .sortBy('date')
  )
}

export function useReviewCount() {
  return useLiveQuery(() =>
    db.transactions
      .filter(t => !t.isReviewed)
      .count()
  )
}

export function useAccounts() {
  return useLiveQuery(() => db.accounts.toArray())
}

export function useUploads() {
  return useLiveQuery(() => db.uploads.orderBy('uploadedAt').reverse().toArray())
}

/**
 * Insert a hand-entered transaction (cash, Venmo, anything not on a
 * statement). `amount` is signed: positive for money in, negative for money
 * out. Marked reviewed (the user chose the category) and reconciled in case it
 * is the missing leg of a transfer.
 */
export async function addManualTransaction(input: {
  accountId: number
  date: Date
  description: string
  amount: number
  categoryId: CategoryId
}): Promise<number> {
  const now = new Date()
  const id = await db.transactions.add({
    accountId: input.accountId,
    date: input.date,
    description: input.description.trim(),
    originalDescription: input.description.trim(),
    amount: input.amount,
    categoryId: input.categoryId,
    confidence: 1,
    isReviewed: true,
    isRecurring: false,
    merchantName: null,
    notes: '',
    transferPairId: null,
    source: 'manual',
    uploadId: 0,
    createdAt: now,
  })
  await reconcileTransfers()
  return id as number
}

export async function updateTransactionCategory(
  id: number,
  categoryId: CategoryId,
  isReviewed = true
): Promise<number> {
  await db.transactions.update(id, { categoryId, isReviewed, confidence: 1.0 })

  const txn = await db.transactions.get(id)
  if (txn) {
    return learnFromCorrection(txn.description, categoryId)
  }
  return 0
}

export async function batchUpdateCategory(
  ids: number[],
  categoryId: CategoryId
): Promise<number> {
  let totalApplied = 0
  const firstTxn = ids.length > 0 ? await db.transactions.get(ids[0]) : null

  await db.transaction('rw', db.transactions, async () => {
    for (const id of ids) {
      await db.transactions.update(id, { categoryId, isReviewed: true, confidence: 1.0 })
    }
  })

  if (firstTxn) {
    totalApplied = await learnFromCorrection(firstTxn.description, categoryId)
  }

  return totalApplied
}
