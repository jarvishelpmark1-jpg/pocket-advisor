import Dexie, { type EntityTable } from 'dexie'
import type { Account, Transaction, Upload, UserRule, MonthlySnapshot } from './types'

const db = new Dexie('PocketAdvisor') as Dexie & {
  accounts: EntityTable<Account, 'id'>
  transactions: EntityTable<Transaction, 'id'>
  uploads: EntityTable<Upload, 'id'>
  userRules: EntityTable<UserRule, 'id'>
  monthlySnapshots: EntityTable<MonthlySnapshot, 'id'>
}

db.version(1).stores({
  accounts: '++id, name, type, institution',
  transactions: '++id, accountId, date, categoryId, isReviewed, uploadId, merchantName, [accountId+date+amount+description]',
  uploads: '++id, accountId, uploadedAt',
  userRules: '++id, pattern, categoryId',
  monthlySnapshots: '++id, &month',
})

// v2: balances become derived from an anchor; transactions gain transfer
// pairing + a source. Backfill legacy rows so existing data keeps working.
db.version(2).stores({
  accounts: '++id, name, type, institution',
  transactions: '++id, accountId, date, categoryId, isReviewed, uploadId, merchantName, transferPairId, source, [accountId+date+amount+description]',
  uploads: '++id, accountId, uploadedAt',
  userRules: '++id, pattern, categoryId',
  monthlySnapshots: '++id, &month',
}).upgrade(async (tx) => {
  await tx.table('accounts').toCollection().modify((a: Record<string, unknown>) => {
    // The old `balance` was treated as the current balance; anchor it as of
    // creation so derived balance starts equal to it and tracks new activity.
    if (a.anchorBalance === undefined) a.anchorBalance = (a.balance as number) ?? 0
    if (a.anchorDate === undefined) a.anchorDate = (a.createdAt as Date) ?? new Date()
    delete a.balance
  })
  await tx.table('transactions').toCollection().modify((t: Record<string, unknown>) => {
    if (t.transferPairId === undefined) t.transferPairId = null
    if (t.source === undefined) t.source = 'import'
  })
})

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.accounts, db.transactions, db.uploads, db.userRules, db.monthlySnapshots], async () => {
    await db.accounts.clear()
    await db.transactions.clear()
    await db.uploads.clear()
    await db.userRules.clear()
    await db.monthlySnapshots.clear()
  })
}

export { db }
