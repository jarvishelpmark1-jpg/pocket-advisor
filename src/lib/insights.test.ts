import { describe, it, expect } from 'vitest'
import { buildInsights, type InsightInput, type Insight } from './insights'

// Neutral baseline that triggers NO rules; tests override only what they probe.
function input(over: Partial<InsightInput> = {}): InsightInput {
  return {
    income: 5000,
    expenses: 5000,
    net: 0,
    savingsRate: 0,
    avgIncome: 5000,
    avgExpenses: 5000,
    prevSavingsRate: 0,
    categoryNow: {},
    categoryAvg: {},
    incomeSources: 2,
    liquidBalance: 20000, // 4 months runway → no runway insight
    totalDebt: 0,
    recurringMonthly: 0,
    recurringCount: 0,
    fees: 0,
    hasHistory: true,
    ...over,
  }
}

const ids = (list: Insight[]) => list.map((i) => i.id)
const byId = (list: Insight[], id: string) => list.find((i) => i.id === id)

describe('buildInsights', () => {
  it('returns nothing for a flat, unremarkable month', () => {
    expect(buildInsights(input())).toEqual([])
  })

  it('celebrates rising income', () => {
    const r = buildInsights(input({ income: 6000, avgIncome: 5000 }))
    const i = byId(r, 'income-up')
    expect(i?.kind).toBe('win')
    expect(i?.detail).toContain('20%')
  })

  it('flags an income dip', () => {
    expect(ids(buildInsights(input({ income: 4000, avgIncome: 5000 })))).toContain('income-down')
  })

  it('nudges toward a second income stream when there is only one source', () => {
    expect(ids(buildInsights(input({ income: 5000, incomeSources: 1 })))).toContain('income-single-source')
  })

  it('warns on negative cash flow', () => {
    const r = buildInsights(input({ income: 4000, expenses: 4300, net: -300 }))
    expect(byId(r, 'negative-cashflow')?.kind).toBe('watch')
  })

  it('on a surplus, both celebrates and suggests moving money to the house fund', () => {
    const r = buildInsights(input({ income: 5800, expenses: 5000, net: 800, avgIncome: 5800, savingsRate: 14 }))
    expect(ids(r)).toContain('positive-cashflow')
    expect(byId(r, 'move-to-house-fund')?.amount).toBe(650)
  })

  it('flags a thin emergency cushion', () => {
    const r = buildInsights(input({ liquidBalance: 4000, avgExpenses: 4000 })) // 1 month
    expect(ids(r)).toContain('thin-runway')
  })

  it('surfaces only the single biggest spending spike', () => {
    const r = buildInsights(
      input({
        categoryNow: { dining: 300, groceries: 210 },
        categoryAvg: { dining: 150, groceries: 200 },
      })
    )
    const spikes = ids(r).filter((id) => id.startsWith('spike-'))
    expect(spikes).toEqual(['spike-dining'])
  })

  it('prompts paying down outstanding debt', () => {
    expect(ids(buildInsights(input({ totalDebt: 5000 })))).toContain('debt-outstanding')
  })

  it('calls out avoidable fees', () => {
    expect(ids(buildInsights(input({ fees: 35 })))).toContain('fees')
  })

  it('ranks income growth above lower-priority facts', () => {
    const r = buildInsights(input({ income: 6000, avgIncome: 5000, recurringMonthly: 120, recurringCount: 4 }))
    expect(r[0].id).toBe('income-up')
  })
})
