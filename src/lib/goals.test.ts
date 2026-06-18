import { describe, it, expect } from 'vitest'
import { goalProgress, suggestedEmergencyTarget } from './goals'

describe('goalProgress', () => {
  it('computes percentage and remaining', () => {
    const p = goalProgress({ target: 50000, current: 20000, monthlyContribution: 0 })
    expect(p.pct).toBe(40)
    expect(p.remaining).toBe(30000)
    expect(p.isComplete).toBe(false)
  })

  it('estimates months to target from the monthly contribution', () => {
    const p = goalProgress({ target: 10000, current: 4000, monthlyContribution: 1000 })
    expect(p.monthsToTarget).toBe(6)
  })

  it('rounds months up to the next whole month', () => {
    const p = goalProgress({ target: 10000, current: 4500, monthlyContribution: 1000 })
    expect(p.monthsToTarget).toBe(6) // 5500/1000 = 5.5 -> 6
  })

  it('returns null months when no contribution is set', () => {
    expect(goalProgress({ target: 10000, current: 0, monthlyContribution: 0 }).monthsToTarget).toBeNull()
  })

  it('caps percentage at 100 and marks complete when funded', () => {
    const p = goalProgress({ target: 10000, current: 12000, monthlyContribution: 0 })
    expect(p.pct).toBe(100)
    expect(p.remaining).toBe(0)
    expect(p.isComplete).toBe(true)
    expect(p.monthsToTarget).toBe(0)
  })
})

describe('suggestedEmergencyTarget', () => {
  it('defaults to four months of expenses, rounded to hundreds', () => {
    expect(suggestedEmergencyTarget(4250)).toBe(17000)
  })

  it('respects a custom month count', () => {
    expect(suggestedEmergencyTarget(3000, 6)).toBe(18000)
  })
})
