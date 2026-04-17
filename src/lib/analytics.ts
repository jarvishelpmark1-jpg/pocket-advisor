import { db } from './db'
import type { Transaction, RecurringTransaction, CategoryId, MonthlySnapshot } from './types'
import { format, subMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns'

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
    if (txn.categoryId === 'transfer' || txn.categoryId === 'atm_cash') continue

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
    if (txn.categoryId === 'transfer' || txn.categoryId === 'atm_cash') continue

    const cat = txn.categoryId || 'other'
    if (!breakdown[cat]) breakdown[cat] = { total: 0, count: 0 }
    breakdown[cat].total += Math.abs(txn.amount)
    breakdown[cat].count += 1
  }

  return Object.entries(breakdown)
    .map(([categoryId, data]) => ({ categoryId: categoryId as CategoryId, ...data }))
    .sort((a, b) => b.total - a.total)
}

export async function getTopMerchants(month: string, limit = 10) {
  const txns = await getTransactionsForMonth(month)
  const merchants: Record<string, { total: number; count: number }> = {}

  for (const txn of txns) {
    if (txn.amount >= 0) continue
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
    if (txn.amount >= 0 || txn.categoryId === 'transfer') continue
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
    if (txn.categoryId === 'transfer' || txn.categoryId === 'atm_cash') continue

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
  const accounts = await db.accounts.toArray()
  return accounts.reduce((sum, a) => {
    if (a.type === 'credit' || a.type === 'loan') return sum - Math.abs(a.balance)
    return sum + a.balance
  }, 0)
}

export async function saveMonthlySnapshot(month: string): Promise<void> {
  const totals = await getMonthlyTotals(month)
  const netWorth = await computeNetWorth()

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
    await db.monthlySnapshots.update(existing.id!, snapshot)
  } else {
    await db.monthlySnapshots.add(snapshot)
  }
}
