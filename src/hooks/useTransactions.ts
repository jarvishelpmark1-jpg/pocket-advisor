import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { CategoryId } from '../lib/types'
import { startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { learnFromCorrection } from '../lib/classifier'

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
