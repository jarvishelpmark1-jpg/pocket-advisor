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

export { db }
