import { db } from './db'
import type { Account, Transaction, RecurringTransaction, CategoryId, MonthlySnapshot } from './types'
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns'

export function isLiability(type: Account['type']): boolean {
  return type === 'credit' || type === 'loan'
}

/** Internal moves (transfers, ATM cash, matched transfer pairs) are not spend or income. */
function isInternalMove(txn: Transaction): boolean {
  return txn.transferPairId !== null || txn.categoryId === 'transfer' || txn.categoryId === 'atm_cash'
}

/**
 * Current balance derived from the account's anchor plus every transaction
 * dated after the anchor. For assets a deposit (+amount) raises the balance;
 * for liabilities a purchase (-amount) raises the amount owed and a payment
 * (+amount) lowers it. Returned in the account's natural terms (assets: cash
 * value, liabilities: amount owed as a positive number).
 */
export function deriveAccountBalance(account: Account, accountTxns: Transaction[]): number {
  const anchorTime = account.anchorDate.getTime()
  let delta = 0
  for (const t of accountTxns) {
    if (t.date.getTime() > anchorTime) delta += t.amount
  }
  return isLiability(account.type) ? account.anchorBalance - delta : account.anchorBalance + delta
}

/**
 * Balance as of an arbitrary date. Replays transactions forward from the anchor
 * to `asOf`, or rewinds back when `asOf` precedes the anchor. Generalizes
 * deriveAccountBalance (the as-of-now case) so net worth can be reconstructed
 * for past month-ends. Manual assets have no transactions, so they hold their
 * anchor value across every date.
 */
export function deriveBalanceAsOf(account: Account, accountTxns: Transaction[], asOf: Date): number {
  const anchorTime = account.anchorDate.getTime()
  const asOfTime = asOf.getTime()
  let delta = 0
  for (const t of accountTxns) {
    const tt = t.date.getTime()
    if (tt > anchorTime && tt <= asOfTime) delta += t.amount       // anchor → asOf
    else if (tt <= anchorTime && tt > asOfTime) delta -= t.amount  // rewind asOf → anchor
  }
  return isLiability(account.type) ? account.anchorBalance - delta : account.anchorBalance + delta
}

/** Signed contribution of an account to net worth (liabilities subtract). */
export function netWorthContribution(account: Account, currentBalance: number): number {
  return isLiability(account.type) ? -currentBalance : currentBalance
}

export interface AccountBalance {
  account: Account
  current: number
  contribution: number
}

/** Current balances for every account, derived from anchors + transactions. */
export async function getAccountBalances(): Promise<AccountBalance[]> {
  const [accounts, txns] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
  ])

  const byAccount = new Map<number, Transaction[]>()
  for (const t of txns) {
    const arr = byAccount.get(t.accountId)
    if (arr) arr.push(t)
    else byAccount.set(t.accountId, [t])
  }

  return accounts.map((account) => {
    const current = deriveAccountBalance(account, byAccount.get(account.id!) ?? [])
    return { account, current, contribution: netWorthContribution(account, current) }
  })
}

export function getMonthKey(date: Date): string {
  return format(date, 'yyyy-MM')
}

export async function getTransactionsForMonth(month: string): Promise<Transaction[]> {
  const start = startOfMonth(parseISO(month + '-01'))
  const end = endOfMonth(start)
  return db.transactions
    .where('date')
    .between(start, end, true, true)
    .toArray()
}

export async function getMonthlyTotals(month: string) {
  const txns = await getTransactionsForMonth(month)

  let totalIncome = 0
  let totalExpenses = 0
  const categoryTotals: Record<string, number> = {}

  for (const txn of txns) {
    if (isInternalMove(txn)) continue

    if (txn.amount > 0) {
      totalIncome += txn.amount
    } else {
      totalExpenses += Math.abs(txn.amount)
      const cat = txn.categoryId || 'other'
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Math.abs(txn.amount)
    }
  }

  const netSavings = totalIncome - totalExpenses
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

  return { totalIncome, totalExpenses, netSavings, savingsRate, categoryTotals }
}

export async function getCategoryBreakdown(month: string) {
  const txns = await getTransactionsForMonth(month)
  const breakdown: Record<string, { total: number; count: number }> = {}

  for (const txn of txns) {
    if (txn.amount >= 0) continue
    if (isInternalMove(txn)) continue

    const cat = txn.categoryId || 'other'
    if (!breakdown[cat]) breakdown[cat] = { total: 0, count: 0 }
    breakdown[cat].total += Math.abs(txn.amount)
    breakdown[cat].count += 1
  }

  return Object.entries(breakdown)
    .map(([categoryId, data]) => ({ categoryId: categoryId as CategoryId, ...data }))
    .sort((a, b) => b.total - a.total)
}

export async function getIncomeBreakdown(month: string) {
  const txns = await getTransactionsForMonth(month)
  const breakdown: Record<string, { total: number; count: number }> = {}

  for (const txn of txns) {
    if (txn.amount <= 0) continue
    if (isInternalMove(txn)) continue

    const source = txn.merchantName || getIncomeSourceLabel(txn.categoryId)
    if (!breakdown[source]) breakdown[source] = { total: 0, count: 0 }
    breakdown[source].total += txn.amount
    breakdown[source].count += 1
  }

  return Object.entries(breakdown)
    .map(([source, data]) => ({ source, ...data }))
    .sort((a, b) => b.total - a.total)
}

function getIncomeSourceLabel(categoryId: CategoryId | null): string {
  switch (categoryId) {
    case 'income_salary': return 'Salary / Payroll'
    case 'income_freelance': return 'Freelance / Business'
    case 'income_interest': return 'Interest / Dividends'
    case 'income_refund': return 'Refunds'
    default: return 'Other Income'
  }
}

export async function getTopMerchants(month: string, limit = 10) {
  const txns = await getTransactionsForMonth(month)
  const merchants: Record<string, { total: number; count: number }> = {}

  for (const txn of txns) {
    if (txn.amount >= 0) continue
    if (isInternalMove(txn)) continue
    const name = txn.merchantName || txn.description.slice(0, 30)
    if (!merchants[name]) merchants[name] = { total: 0, count: 0 }
    merchants[name].total += Math.abs(txn.amount)
    merchants[name].count += 1
  }

  return Object.entries(merchants)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export async function getMonthlyTrend(monthsBack = 6) {
  const now = new Date()
  const months: { month: string; income: number; expenses: number; net: number }[] = []

  for (let i = monthsBack - 1; i >= 0; i--) {
    const date = subMonths(now, i)
    const monthKey = getMonthKey(date)
    const totals = await getMonthlyTotals(monthKey)
    months.push({
      month: monthKey,
      income: totals.totalIncome,
      expenses: totals.totalExpenses,
      net: totals.netSavings,
    })
  }

  return months
}

export async function detectRecurring(): Promise<RecurringTransaction[]> {
  const sixMonthsAgo = subMonths(new Date(), 6)
  const txns = await db.transactions
    .where('date')
    .above(sixMonthsAgo)
    .toArray()

  const merchantGroups: Record<string, Transaction[]> = {}

  for (const txn of txns) {
    if (txn.amount >= 0) continue
    const key = txn.merchantName || txn.description.slice(0, 20).toUpperCase()
    if (!merchantGroups[key]) merchantGroups[key] = []
    merchantGroups[key].push(txn)
  }

  const recurring: RecurringTransaction[] = []

  for (const [name, group] of Object.entries(merchantGroups)) {
    if (group.length < 2) continue

    const amounts = group.map(t => Math.abs(t.amount))
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const amountVariance = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.1)

    if (!amountVariance && group.length < 3) continue

    const dates = group.map(t => t.date.getTime()).sort()
    const gaps = []
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24))
    }
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length

    let frequency: RecurringTransaction['frequency']
    if (avgGap < 10) frequency = 'weekly'
    else if (avgGap < 21) frequency = 'biweekly'
    else if (avgGap < 45) frequency = 'monthly'
    else if (avgGap < 120) frequency = 'quarterly'
    else frequency = 'annual'

    if (amountVariance || group.length >= 3) {
      recurring.push({
        merchantName: name,
        categoryId: group[0].categoryId,
        averageAmount: avgAmount,
        frequency,
        lastSeen: new Date(Math.max(...dates)),
        count: group.length,
      })
    }
  }

  return recurring.sort((a, b) => b.averageAmount - a.averageAmount)
}

export async function getSpendingVelocity(month: string) {
  const txns = await getTransactionsForMonth(month)
  const dailySpend: Record<string, number> = {}

  for (const txn of txns) {
    if (txn.amount >= 0 || isInternalMove(txn)) continue
    const day = format(txn.date, 'yyyy-MM-dd')
    dailySpend[day] = (dailySpend[day] || 0) + Math.abs(txn.amount)
  }

  return Object.entries(dailySpend)
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getNeedsWantsSavings(month: string) {
  const txns = await getTransactionsForMonth(month)
  const totals = { needs: 0, wants: 0, savings: 0 }

  const NEEDS_CATEGORIES: CategoryId[] = [
    'housing', 'utilities', 'groceries', 'transportation', 'auto',
    'healthcare', 'insurance', 'education', 'debt_payment', 'fees',
    'kids_family',
  ]
  const SAVINGS_CATEGORIES: CategoryId[] = ['savings_investment']

  for (const txn of txns) {
    if (txn.amount >= 0) continue
    if (isInternalMove(txn)) continue

    const abs = Math.abs(txn.amount)
    if (SAVINGS_CATEGORIES.includes(txn.categoryId as CategoryId)) {
      totals.savings += abs
    } else if (NEEDS_CATEGORIES.includes(txn.categoryId as CategoryId)) {
      totals.needs += abs
    } else {
      totals.wants += abs
    }
  }

  return totals
}

export async function computeNetWorth(): Promise<number> {
  const balances = await getAccountBalances()
  return balances.reduce((sum, b) => sum + b.contribution, 0)
}

/** Net worth reconstructed as of a past (or current) date from anchors + transactions. */
export async function computeNetWorthAsOf(asOf: Date): Promise<number> {
  const [accounts, txns] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
  ])

  const byAccount = new Map<number, Transaction[]>()
  for (const t of txns) {
    const arr = byAccount.get(t.accountId)
    if (arr) arr.push(t)
    else byAccount.set(t.accountId, [t])
  }

  let total = 0
  for (const account of accounts) {
    const balance = deriveBalanceAsOf(account, byAccount.get(account.id!) ?? [], asOf)
    total += netWorthContribution(account, balance)
  }
  return total
}

/** Stored net-worth snapshots, oldest-first, for the net-worth-over-time chart. */
export async function getNetWorthHistory(monthsBack = 12): Promise<{ month: string; netWorth: number }[]> {
  const snapshots = await db.monthlySnapshots.toArray()
  return snapshots
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-monthsBack)
    .map((s) => ({ month: s.month, netWorth: s.netWorth }))
}

/**
 * Write/refresh net-worth snapshots for the trailing `monthsBack` months. Past
 * months are reconstructed as-of their month-end from anchors + transactions, so
 * the history chart is meaningful immediately rather than only going forward.
 * Idempotent (upsert by month); safe to call on every app start. No-op with no
 * accounts.
 */
export async function backfillNetWorthHistory(monthsBack = 12): Promise<void> {
  const accountCount = await db.accounts.count()
  if (accountCount === 0) return
  const now = new Date()
  for (let i = monthsBack - 1; i >= 0; i--) {
    await saveMonthlySnapshot(getMonthKey(subMonths(now, i)))
  }
}

export async function saveMonthlySnapshot(month: string): Promise<void> {
  const totals = await getMonthlyTotals(month)
  // Net worth as of the month's close (capped at now for the current month), so
  // each month records its own end-of-month position rather than today's.
  const now = new Date()
  const monthEnd = endOfMonth(parseISO(month + '-01'))
  const netWorth = await computeNetWorthAsOf(monthEnd.getTime() > now.getTime() ? now : monthEnd)

  const existing = await db.monthlySnapshots.where('month').equals(month).first()
  const snapshot: MonthlySnapshot = {
    month,
    totalIncome: totals.totalIncome,
    totalExpenses: totals.totalExpenses,
    totalSavings: totals.netSavings,
    savingsRate: totals.savingsRate,
    netWorth,
    categoryBreakdown: totals.categoryTotals,
    createdAt: new Date(),
  }

  if (existing) {
    await db.monthlySnapshots.update(existing.id!, {
      totalIncome: snapshot.totalIncome,
      totalExpenses: snapshot.totalExpenses,
      totalSavings: snapshot.totalSavings,
      savingsRate: snapshot.savingsRate,
      netWorth: snapshot.netWorth,
      categoryBreakdown: snapshot.categoryBreakdown,
      createdAt: snapshot.createdAt,
    })
  } else {
    await db.monthlySnapshots.add(snapshot)
  }
}
