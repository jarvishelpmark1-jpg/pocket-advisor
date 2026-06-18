import type { CategoryId } from './types'
import {
  getMonthKey,
  getMonthlyTotals,
  getCategoryBreakdown,
  getAccountBalances,
  detectRecurring,
  getTransactionsForMonth,
} from './analytics'
import { getCategoryName } from './categories'
import { formatCurrency } from './formatters'
import { subMonths } from 'date-fns'

export type InsightKind = 'win' | 'watch' | 'action' | 'fact'

export interface Insight {
  id: string
  kind: InsightKind
  title: string
  detail: string
  priority: number
  amount?: number
  category?: CategoryId
}

export interface InsightInput {
  income: number
  expenses: number
  net: number
  savingsRate: number
  /** trailing average income over the prior months (excludes current) */
  avgIncome: number
  avgExpenses: number
  prevSavingsRate: number
  /** spend this month by category */
  categoryNow: Record<string, number>
  /** trailing average spend by category (excludes current) */
  categoryAvg: Record<string, number>
  /** distinct income sources seen this month */
  incomeSources: number
  /** sum of liquid asset balances (checking/savings/money market) */
  liquidBalance: number
  /** total owed across credit + loan accounts */
  totalDebt: number
  /** estimated recurring/subscription spend per month */
  recurringMonthly: number
  recurringCount: number
  /** bank/card fees paid this month */
  fees: number
  hasHistory: boolean
}

const NEEDS_RUNWAY_MONTHS = 3
const TARGET_SAVINGS_RATE = 20

function pctChange(now: number, base: number): number {
  if (base <= 0) return 0
  return ((now - base) / base) * 100
}

/**
 * Pure rule engine: turns a month's financial snapshot into a ranked list of
 * highlights and next steps. Tuned to the household's priorities — income
 * growth first, then runway/house fund, then debt and spending leaks.
 * Kept pure (no IO) so it is fully unit-testable.
 */
export function buildInsights(input: InsightInput): Insight[] {
  const out: Insight[] = []
  const f = formatCurrency

  // --- INCOME (top priority: growth + diversification) ---
  if (input.hasHistory && input.avgIncome > 0) {
    const change = pctChange(input.income, input.avgIncome)
    if (change >= 8) {
      out.push({
        id: 'income-up',
        kind: 'win',
        title: 'Income is climbing',
        detail: `You brought in ${f(input.income)} — up ${change.toFixed(0)}% vs your recent average. Keep the momentum.`,
        amount: input.income - input.avgIncome,
        priority: 95,
      })
    } else if (change <= -12) {
      out.push({
        id: 'income-down',
        kind: 'watch',
        title: 'Income dipped this month',
        detail: `Income was ${f(input.income)}, down ${Math.abs(change).toFixed(0)}% from your average. Worth a look if it wasn't expected.`,
        amount: input.avgIncome - input.income,
        priority: 88,
      })
    }
  }

  if (input.income > 0 && input.incomeSources <= 1) {
    out.push({
      id: 'income-single-source',
      kind: 'action',
      title: 'One income source this month',
      detail: `All of this month's income traced to a single source. A second stream is the fastest way to de-risk while NP school is in progress.`,
      priority: 80,
    })
  } else if (input.incomeSources >= 3) {
    out.push({
      id: 'income-diversified',
      kind: 'win',
      title: `${input.incomeSources} income streams`,
      detail: `Money came in from ${input.incomeSources} sources this month — exactly the diversification you're aiming for.`,
      priority: 62,
    })
  }

  // --- CASH FLOW ---
  if (input.net < 0) {
    out.push({
      id: 'negative-cashflow',
      kind: 'watch',
      title: 'You spent more than you made',
      detail: `This month went ${f(Math.abs(input.net))} into the red. Covering the gap from savings is fine occasionally, but not the trend you want.`,
      amount: input.net,
      priority: 90,
    })
  } else if (input.net > 0) {
    out.push({
      id: 'positive-cashflow',
      kind: 'win',
      title: 'You kept money this month',
      detail: `You held onto ${f(input.net)} (${input.savingsRate.toFixed(0)}% of income). That's house-fund fuel.`,
      amount: input.net,
      priority: 70,
    })
  }

  // --- NEXT STEP: put the surplus to work toward the house ---
  if (input.net > 0) {
    const moveable = Math.max(0, Math.round((input.net * 0.8) / 25) * 25)
    if (moveable >= 50) {
      out.push({
        id: 'move-to-house-fund',
        kind: 'action',
        title: 'Move this toward the house',
        detail: `You can sweep about ${f(moveable)} into savings/your house fund this month without touching your buffer.`,
        amount: moveable,
        priority: 84,
      })
    }
  }

  // --- RUNWAY / EMERGENCY FUND (security for kids on the way) ---
  if (input.avgExpenses > 0) {
    const months = input.liquidBalance / input.avgExpenses
    if (months < NEEDS_RUNWAY_MONTHS) {
      out.push({
        id: 'thin-runway',
        kind: 'action',
        title: 'Build your cushion',
        detail: `Your liquid savings cover about ${months.toFixed(1)} month${months >= 1.05 ? 's' : ''} of expenses. Aim for 3–6 before the house and kids stretch things.`,
        priority: 82,
      })
    } else if (months >= 6) {
      out.push({
        id: 'solid-runway',
        kind: 'win',
        title: 'Strong safety net',
        detail: `You've got roughly ${months.toFixed(0)} months of expenses in reserve — a real cushion heading into a bigger house.`,
        priority: 55,
      })
    }
  }

  // --- SPENDING LEAKS (only the biggest mover, no nagging) ---
  if (input.hasHistory) {
    let worst: { cat: string; delta: number; pct: number } | null = null
    for (const [cat, now] of Object.entries(input.categoryNow)) {
      const avg = input.categoryAvg[cat] ?? 0
      if (avg < 50) continue
      const delta = now - avg
      const pct = pctChange(now, avg)
      if (delta >= 75 && pct >= 35 && (!worst || delta > worst.delta)) {
        worst = { cat, delta, pct }
      }
    }
    if (worst) {
      out.push({
        id: `spike-${worst.cat}`,
        kind: 'watch',
        title: `${getCategoryName(worst.cat as CategoryId)} ran hot`,
        detail: `You spent ${f(input.categoryNow[worst.cat])} on ${getCategoryName(worst.cat as CategoryId).toLowerCase()} — ${worst.pct.toFixed(0)}% (${f(worst.delta)}) above your usual.`,
        amount: worst.delta,
        category: worst.cat as CategoryId,
        priority: 74,
      })
    }
  }

  // --- DEBT ---
  if (input.totalDebt > 0) {
    out.push({
      id: 'debt-outstanding',
      kind: 'action',
      title: 'Chip at the debt',
      detail: `You owe ${f(input.totalDebt)} across cards and loans. Throwing extra at the highest-rate balance first saves the most interest.`,
      amount: input.totalDebt,
      priority: 68,
    })
  }

  // --- SUBSCRIPTIONS ---
  if (input.recurringMonthly >= 50 && input.recurringCount >= 3) {
    out.push({
      id: 'recurring-spend',
      kind: 'fact',
      title: `${input.recurringCount} recurring charges`,
      detail: `Subscriptions and recurring bills run about ${f(input.recurringMonthly)}/month. Cancelling one or two is found money toward the house.`,
      amount: input.recurringMonthly,
      priority: 50,
    })
  }

  // --- FEES (avoidable) ---
  if (input.fees > 0) {
    out.push({
      id: 'fees',
      kind: 'action',
      title: 'You paid avoidable fees',
      detail: `${f(input.fees)} in bank/card fees this month — usually a quick call or autopay setting away from zero.`,
      amount: input.fees,
      priority: 60,
    })
  }

  // --- WIN: improving savings rate ---
  if (input.hasHistory && input.savingsRate - input.prevSavingsRate >= 5 && input.savingsRate > 0) {
    out.push({
      id: 'savings-improving',
      kind: 'win',
      title: 'Saving more than last month',
      detail: `Your savings rate rose to ${input.savingsRate.toFixed(0)}% from ${input.prevSavingsRate.toFixed(0)}%. Trending the right way.`,
      priority: 58,
    })
  }

  return out.sort((a, b) => b.priority - a.priority)
}

/** Assemble the month's snapshot from stored data and run the rule engine. */
export async function getInsights(month: string): Promise<Insight[]> {
  const totals = await getMonthlyTotals(month)

  // trailing 3 months (excluding the current month) for baselines
  const base = new Date(month + '-01')
  const priorKeys = [1, 2, 3].map((i) => getMonthKey(subMonths(base, i)))
  const priorTotals = await Promise.all(priorKeys.map((m) => getMonthlyTotals(m)))
  const priorBreakdowns = await Promise.all(priorKeys.map((m) => getCategoryBreakdown(m)))

  const withIncome = priorTotals.filter((t) => t.totalIncome > 0 || t.totalExpenses > 0)
  const hasHistory = withIncome.length > 0
  const avgIncome = hasHistory ? withIncome.reduce((s, t) => s + t.totalIncome, 0) / withIncome.length : 0
  const avgExpenses = hasHistory ? withIncome.reduce((s, t) => s + t.totalExpenses, 0) / withIncome.length : 0
  const prevSavingsRate = priorTotals[0]?.savingsRate ?? 0

  // per-category trailing average
  const categoryAvg: Record<string, number> = {}
  for (const breakdown of priorBreakdowns) {
    for (const row of breakdown) {
      categoryAvg[row.categoryId] = (categoryAvg[row.categoryId] ?? 0) + row.total
    }
  }
  const divisor = Math.max(1, priorBreakdowns.length)
  for (const k of Object.keys(categoryAvg)) categoryAvg[k] /= divisor

  // balances
  const balances = await getAccountBalances()
  const liquidBalance = balances
    .filter((b) => ['checking', 'savings', 'money_market'].includes(b.account.type))
    .reduce((s, b) => s + b.current, 0)
  const totalDebt = balances
    .filter((b) => b.account.type === 'credit' || b.account.type === 'loan')
    .reduce((s, b) => s + b.current, 0)

  // income source count this month
  const monthTxns = await getTransactionsForMonth(month)
  const incomeKeys = new Set<string>()
  for (const t of monthTxns) {
    if (t.amount > 0 && t.transferPairId === null && t.categoryId !== 'transfer') {
      incomeKeys.add(t.merchantName || t.categoryId || t.description.slice(0, 16))
    }
  }

  // recurring
  const recurring = await detectRecurring()
  const freqToMonthly: Record<string, number> = { weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 1 / 3, annual: 1 / 12 }
  const recurringMonthly = recurring.reduce((s, r) => s + r.averageAmount * (freqToMonthly[r.frequency] ?? 1), 0)

  const fees = totals.categoryTotals['fees'] ?? 0

  return buildInsights({
    income: totals.totalIncome,
    expenses: totals.totalExpenses,
    net: totals.netSavings,
    savingsRate: totals.savingsRate,
    avgIncome,
    avgExpenses,
    prevSavingsRate,
    categoryNow: totals.categoryTotals,
    categoryAvg,
    incomeSources: incomeKeys.size,
    liquidBalance,
    totalDebt,
    recurringMonthly,
    recurringCount: recurring.length,
    fees,
    hasHistory,
  })
}

export const _internal = { TARGET_SAVINGS_RATE, NEEDS_RUNWAY_MONTHS }
