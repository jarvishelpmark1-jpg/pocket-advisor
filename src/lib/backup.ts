import { db } from './db'
import { getSettings } from './settings'

interface BackupData {
  version: 1
  exportedAt: string
  settings: ReturnType<typeof getSettings>
  accounts: unknown[]
  transactions: unknown[]
  uploads: unknown[]
  userRules: unknown[]
  goals?: unknown[]
}

export async function exportBackup(): Promise<string> {
  const [accounts, transactions, uploads, userRules, goals] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.uploads.toArray(),
    db.userRules.toArray(),
    db.goals.toArray(),
  ])

  const backup: BackupData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: getSettings(),
    accounts,
    transactions,
    uploads,
    userRules,
    goals,
  }

  return JSON.stringify(backup, null, 2)
}

export async function importBackup(json: string): Promise<{ accounts: number; transactions: number }> {
  const data: BackupData = JSON.parse(json)
  if (data.version !== 1) throw new Error('Unsupported backup version')

  // Backups may predate the anchor-balance / transfer-pairing schema; normalize.
  const accounts = (data.accounts as Record<string, unknown>[] | undefined)?.map((a) => {
    const next = { ...a }
    if (next.anchorBalance === undefined) next.anchorBalance = (next.balance as number) ?? 0
    if (next.anchorDate === undefined) next.anchorDate = next.createdAt ?? new Date().toISOString()
    delete next.balance
    return next
  })
  const transactions = (data.transactions as Record<string, unknown>[] | undefined)?.map((t) => ({
    transferPairId: null,
    source: 'import',
    ...t,
  }))

  await db.transaction('rw', [db.accounts, db.transactions, db.uploads, db.userRules, db.monthlySnapshots, db.goals], async () => {
    await db.accounts.clear()
    await db.transactions.clear()
    await db.uploads.clear()
    await db.userRules.clear()
    await db.monthlySnapshots.clear()
    await db.goals.clear()

    if (accounts?.length) await db.accounts.bulkAdd(accounts as never[])
    if (transactions?.length) await db.transactions.bulkAdd(transactions as never[])
    if (data.uploads?.length) await db.uploads.bulkAdd(data.uploads as never[])
    if (data.userRules?.length) await db.userRules.bulkAdd(data.userRules as never[])
    if (data.goals?.length) await db.goals.bulkAdd(data.goals as never[])
  })

  return {
    accounts: data.accounts?.length ?? 0,
    transactions: data.transactions?.length ?? 0,
  }
}

export async function exportTransactionsCSV(): Promise<string> {
  const transactions = await db.transactions.orderBy('date').toArray()
  const headers = ['Date', 'Description', 'Amount', 'Category', 'Merchant', 'Account ID']
  const rows = transactions.map(t => [
    t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date,
    `"${(t.description || '').replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    t.categoryId || '',
    `"${(t.merchantName || '').replace(/"/g, '""')}"`,
    t.accountId,
  ])

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
