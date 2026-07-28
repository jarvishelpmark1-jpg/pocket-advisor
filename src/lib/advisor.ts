// The advisor: turns a stretch of real data into the briefing a good private
// banker would give across the table — what actually happened, what was strong,
// what's quietly working against you, and the single move that matters next.
// Pure prose generation (buildBriefing) is separated from IO (getBriefing) so
// the voice and judgment are fully unit-testable. Tone rules: talk like a
// person, lead with the story, numbers as evidence not decoration, ambition
// over austerity — never nag about lattes.

import { parseISO, format } from 'date-fns'
import { db } from './db'
import {
  getMonthKey,
  getMonthlyTotals,
  getAccountBalances,
  getNetWorthHistory,
  monthsOfData,
} from './analytics'
import { assessDataHealth } from './data-health'
import { getCategoryName } from './categories'
import { formatCurrency } from './formatters'
import { subMonths } from 'date-fns'
import type { CategoryId } from './types'

export type RangeKey = '3m' | '6m' | '12m' | 'all'

export const RANGE_LABELS: Record<RangeKey, string> = {
  '3m': 'the last three months',
  '6m': 'the last six months',
  '12m': 'the last year',
  all: 'everything you’ve given me',
}

export interface MonthRow {
  month: string
  income: number
  expenses: number
  net: number
  categories: Record<string, number>
}

export interface BriefingInput {
  rangeLabel: string
  /** oldest → newest; only months with any activity */
  months: MonthRow[]
  netWorthStart: number | null
  netWorthNow: number | null
  liquidBalance: number
  cardDebt: number
  loanDebt: number
  /** whole-range income by source, largest first */
  incomeSources: { source: string; total: number }[]
  houseFund?: { current: number; target: number; monthlyContribution: number }
  dataIssueCount: number
}

export interface AdvisorParagraph {
  id: string
  tone: 'caveat' | 'opening' | 'win' | 'watch' | 'move'
  text: string
  priority: number
}

const f = formatCurrency

function monthName(month: string): string {
  return format(parseISO(month + '-01'), 'MMMM')
}

/** How many body paragraphs the briefing keeps beyond opening/caveat/closing. */
const BODY_LIMIT = 4

export function buildBriefing(input: BriefingInput): AdvisorParagraph[] {
  const out: AdvisorParagraph[] = []
  const body: AdvisorParagraph[] = []
  const { months } = input

  const totalIncome = months.reduce((s, m) => s + m.income, 0)
  const totalNet = months.reduce((s, m) => s + m.net, 0)
  const avgExpenses = months.length > 0 ? months.reduce((s, m) => s + m.expenses, 0) / months.length : 0
  const keepRate = totalIncome > 0 ? (totalNet / totalIncome) * 100 : 0

  // --- caveat: honesty before advice ---
  if (input.dataIssueCount > 0) {
    out.push({
      id: 'caveat',
      tone: 'caveat',
      priority: 1000,
      text:
        `Before we talk numbers — ${input.dataIssueCount === 1 ? 'one of your accounts is' : `${input.dataIssueCount} of your accounts are`} behind on data, ` +
        `so I’m reading a partial picture. The story below is only as good as the statements behind it; the Home warnings will show you what to fix.`,
    })
  }

  // --- opening: the story of the period ---
  if (input.netWorthStart !== null && input.netWorthNow !== null && months.length >= 2) {
    const delta = input.netWorthNow - input.netWorthStart
    if (delta >= 0) {
      const savedShare = totalNet > 0 ? Math.min(totalNet, delta) : 0
      const attribution =
        totalNet > 0
          ? `Roughly ${f(savedShare)} of that is cash you kept; the rest is debt you paid down and value you’ve added.`
          : `Your months ran about break-even, so nearly all of it came from paying down debt and the assets you’ve added — quiet progress, but real.`
      out.push({
        id: 'opening',
        tone: 'opening',
        priority: 900,
        text: `Here’s the story of ${input.rangeLabel}: your net worth moved from ${f(input.netWorthStart)} to ${f(input.netWorthNow)} — ${f(delta)} in the right direction. ${attribution}`,
      })
    } else {
      const spentDown = totalNet < 0 ? ` You spent ${f(Math.abs(totalNet))} more than you earned across the stretch — that’s the lever, and it’s in your hands.` : ''
      out.push({
        id: 'opening',
        tone: 'opening',
        priority: 900,
        text: `Straight talk about ${input.rangeLabel}: net worth slipped ${f(Math.abs(delta))}, from ${f(input.netWorthStart)} to ${f(input.netWorthNow)}.${spentDown} Nothing here is fatal — but let’s not look away from it either.`,
      })
    }
  } else if (months.length > 0) {
    out.push({
      id: 'opening',
      tone: 'opening',
      priority: 900,
      text: `Here’s what I can see over ${input.rangeLabel}: ${f(totalIncome)} came in, ${f(totalIncome - totalNet)} went out. Give me a few more months of statements and I’ll tell you a much richer story.`,
    })
  }

  // --- keep rate: the wedge that builds wealth ---
  if (months.length >= 2 && totalIncome > 0) {
    const best = months.reduce((a, b) => (b.net > a.net ? b : a))
    const worst = months.reduce((a, b) => (b.net < a.net ? b : a))
    const bestWorst =
      best.net > 0 && worst.net < 0
        ? ` ${monthName(best.month)} was your best month (${f(best.net)} kept); ${monthName(worst.month)} went ${f(Math.abs(worst.net))} backwards — worth remembering what that month bought.`
        : ''
    if (keepRate >= 20) {
      body.push({
        id: 'keep-rate',
        tone: 'win',
        priority: 80,
        text: `You kept ${keepRate.toFixed(0)}% of everything you earned — ${f(totalNet)}. That’s a genuinely strong rate; wealth gets built at exactly this tempo.${bestWorst}`,
      })
    } else if (keepRate >= 5) {
      body.push({
        id: 'keep-rate',
        tone: 'win',
        priority: 70,
        text: `You kept ${keepRate.toFixed(0)}% of what you earned (${f(totalNet)}). Solid foundation — the next tier is 20%, and at your income that’s about ${f(Math.max(0, (0.2 * totalIncome - totalNet) / Math.max(1, months.length)))} more per month.${bestWorst}`,
      })
    } else {
      body.push({
        id: 'keep-rate',
        tone: 'watch',
        priority: 85,
        text: `Across ${input.rangeLabel} you kept ${keepRate.toFixed(0)}% of your income — essentially break-even. Nothing compounds until there’s a wedge between what comes in and what goes out. That wedge is the whole game.${bestWorst}`,
      })
    }
  }

  // --- the income engine (your stated #1 priority) ---
  if (months.length >= 4) {
    const half = Math.floor(months.length / 2)
    const firstHalf = months.slice(0, half).reduce((s, m) => s + m.income, 0) / half
    const secondHalf = months.slice(half).reduce((s, m) => s + m.income, 0) / (months.length - half)
    if (firstHalf > 0) {
      const growth = ((secondHalf - firstHalf) / firstHalf) * 100
      if (growth >= 8) {
        body.push({
          id: 'income-growth',
          tone: 'win',
          priority: 88,
          text: `The income side — your growth engine — ran ${growth.toFixed(0)}% hotter in the back half of this stretch. That matters more than any spending line on this page. Whatever you did there, do it again, bigger.`,
        })
      } else if (growth <= -8) {
        body.push({
          id: 'income-decline',
          tone: 'watch',
          priority: 90,
          text: `Income ran ${Math.abs(growth).toFixed(0)}% lighter in the back half of the period. You’re heading into a one-growth-engine season as a household — protecting and growing that engine outranks every spending decision below.`,
        })
      }
    }
  }
  const topSource = input.incomeSources[0]
  if (topSource && totalIncome > 0) {
    const share = (topSource.total / totalIncome) * 100
    if (share >= 70) {
      body.push({
        id: 'income-concentration',
        tone: 'watch',
        priority: 66,
        text: `${share.toFixed(0)}% of every dollar that came in traced to one source (${topSource.source}). While it’s steady, fine — but a second stream is still the cheapest insurance you can buy, and you’ve said yourself that’s the goal.`,
      })
    } else if (input.incomeSources.length >= 3) {
      body.push({
        id: 'income-diversified',
        tone: 'win',
        priority: 55,
        text: `Money arrived from ${input.incomeSources.length} different sources this period. That’s the diversification you’ve been building toward — it shows.`,
      })
    }
  }

  // --- runway (security buys aggression) ---
  if (avgExpenses > 0) {
    const runway = input.liquidBalance / avgExpenses
    if (runway < 6) {
      body.push({
        id: 'runway',
        tone: 'move',
        priority: 75,
        text: `You’re holding ${f(input.liquidBalance)} liquid — about ${runway.toFixed(1)} month${runway >= 1.05 ? 's' : ''} of life at your burn rate (${f(avgExpenses)}/mo). With the family growing I want you at six months: ${f(Math.max(0, 6 * avgExpenses - input.liquidBalance))} more, parked in high-yield savings, then forget it exists.`,
      })
    } else {
      body.push({
        id: 'runway',
        tone: 'win',
        priority: 50,
        text: `Cash cushion: about ${Math.floor(runway)} months of expenses in reserve. That kind of security is what lets you be aggressive everywhere else.`,
      })
    }
  }

  // --- card debt: the guaranteed-return problem ---
  if (input.cardDebt > 250) {
    const monthlyDrag = (input.cardDebt * 0.22) / 12
    body.push({
      id: 'card-debt',
      tone: 'move',
      priority: 92,
      text: `The cards are carrying ${f(input.cardDebt)}. At typical card rates that’s roughly ${f(monthlyDrag)} a month working against you — killing it is the highest guaranteed return available to you anywhere. It comes ahead of the house fund; the math isn’t close.`,
    })
  }

  // --- house fund ---
  if (input.houseFund && input.houseFund.target > 0) {
    const { current, target, monthlyContribution } = input.houseFund
    const remaining = Math.max(0, target - current)
    const pct = Math.min(100, (current / target) * 100)
    if (remaining <= 0) {
      body.push({
        id: 'house-funded',
        tone: 'win',
        priority: 89,
        text: `The house down payment is funded — ${f(target)}, done. That’s the big rock. Time to go shopping.`,
      })
    } else {
      const eta = monthlyContribution > 0 ? ` at ${f(monthlyContribution)}/mo you’re roughly ${Math.ceil(remaining / monthlyContribution)} months out` : ' set a monthly contribution and I’ll give you a date'
      body.push({
        id: 'house-progress',
        tone: 'move',
        priority: 65,
        text: `House fund: ${pct.toFixed(0)}% of the way to ${f(target)} — ${f(remaining)} to go;${eta}.`,
      })
    }
  }

  // --- one drifting category, named without nagging ---
  if (months.length >= 4) {
    const half = Math.floor(months.length / 2)
    const catAvg = (rows: MonthRow[], cat: string) =>
      rows.reduce((s, m) => s + (m.categories[cat] ?? 0), 0) / rows.length
    const cats = new Set(months.flatMap((m) => Object.keys(m.categories)))
    let drift: { cat: string; from: number; to: number } | null = null
    for (const cat of cats) {
      if (cat === 'debt_payment' || cat === 'savings_investment') continue
      const from = catAvg(months.slice(0, half), cat)
      const to = catAvg(months.slice(half), cat)
      if (from >= 75 && to - from >= 60 && to / from >= 1.25) {
        if (!drift || to - from > drift.to - drift.from) drift = { cat, from, to }
      }
    }
    if (drift) {
      body.push({
        id: `drift-${drift.cat}`,
        tone: 'watch',
        priority: 60,
        text: `One pattern worth naming: ${getCategoryName(drift.cat as CategoryId).toLowerCase()} has drifted from about ${f(drift.from)}/mo to ${f(drift.to)}/mo. If that’s deliberate, fine — money is for living. If it snuck up on you, that’s ${f((drift.to - drift.from) * 12)} a year walking away quietly.`,
      })
    }
  }

  // --- the single move (a good advisor always ends with one) ---
  let move: string
  if (input.cardDebt > 250) {
    move = `every spare dollar goes at the ${f(input.cardDebt)} on the cards until they’re gone — it’s a guaranteed ~20% return and it frees your whole cash flow`
  } else if (avgExpenses > 0 && input.liquidBalance / avgExpenses < 6) {
    const gap = 6 * avgExpenses - input.liquidBalance
    move = `set an automatic monthly transfer toward your six-month cushion (${f(gap)} to go) — automation, not willpower`
  } else if (totalNet > 0 && months.length > 0) {
    move = `sweep ${f(Math.round(totalNet / months.length / 25) * 25)} into the house fund on the 1st of every month, automatically — you’ve proven you can keep it, now make it un-spendable`
  } else {
    move = `open the income side: one price increase, one new client, one new stream. At break-even, a dollar earned is worth more than a dollar trimmed`
  }
  out.push({
    id: 'closing-move',
    tone: 'move',
    priority: -1,
    text: `If I could have you do exactly one thing in the next 30 days: ${move}. Everything else on this page is commentary.`,
  })

  const rankedBody = body.sort((a, b) => b.priority - a.priority).slice(0, BODY_LIMIT)
  return [...out.filter((p) => p.priority >= 900), ...rankedBody, ...out.filter((p) => p.priority < 0)]
    .sort((a, b) => b.priority - a.priority)
}

/** Assemble the range's data and run the advisor. */
export async function getBriefing(range: RangeKey): Promise<AdvisorParagraph[]> {
  const monthsBack =
    range === 'all' ? Math.min(60, await monthsOfData()) : { '3m': 3, '6m': 6, '12m': 12 }[range]

  const now = new Date()
  const keys = Array.from({ length: monthsBack }, (_, i) => getMonthKey(subMonths(now, monthsBack - 1 - i)))
  const totalsList = await Promise.all(keys.map((k) => getMonthlyTotals(k)))
  const months: MonthRow[] = keys
    .map((month, i) => ({
      month,
      income: totalsList[i].totalIncome,
      expenses: totalsList[i].totalExpenses,
      net: totalsList[i].netSavings,
      categories: totalsList[i].categoryTotals,
    }))
    .filter((m) => m.income > 0 || m.expenses > 0)

  const history = await getNetWorthHistory(monthsBack)
  const balances = await getAccountBalances()
  const liquidBalance = balances
    .filter((b) => ['checking', 'savings', 'money_market'].includes(b.account.type))
    .reduce((s, b) => s + b.current, 0)
  const cardDebt = balances
    .filter((b) => b.account.type === 'credit')
    .reduce((s, b) => s + Math.max(0, b.current), 0)
  const loanDebt = balances
    .filter((b) => b.account.type === 'loan')
    .reduce((s, b) => s + Math.max(0, b.current), 0)

  // Income by source across the whole range, straight from the ledger.
  const rangeStart = parseISO(keys[0] + '-01')
  const txns = await db.transactions.where('date').above(rangeStart).toArray()
  const bySource = new Map<string, number>()
  for (const t of txns) {
    if (t.amount <= 0 || t.transferPairId !== null || t.categoryId === 'transfer' || t.categoryId === 'atm_cash') continue
    const source = t.merchantName || 'Other income'
    bySource.set(source, (bySource.get(source) ?? 0) + t.amount)
  }
  const incomeSources = [...bySource.entries()]
    .map(([source, total]) => ({ source, total }))
    .sort((a, b) => b.total - a.total)

  const goals = await db.goals.toArray()
  const house = goals.find((g) => g.kind === 'house')
  const dataIssueCount = (await assessDataHealth()).length

  return buildBriefing({
    rangeLabel: RANGE_LABELS[range],
    months,
    netWorthStart: history.length >= 2 ? history[0].netWorth : null,
    netWorthNow: history.length >= 2 ? history[history.length - 1].netWorth : null,
    liquidBalance,
    cardDebt,
    loanDebt,
    incomeSources,
    houseFund: house
      ? { current: house.current, target: house.target, monthlyContribution: house.monthlyContribution }
      : undefined,
    dataIssueCount,
  })
}
