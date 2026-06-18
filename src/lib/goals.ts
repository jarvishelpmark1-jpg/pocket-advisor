import { db } from './db'
import type { Goal, GoalKind } from './types'

export interface GoalProgress {
  pct: number
  remaining: number
  /** estimated months to target at the goal's monthly contribution, or null if unknowable */
  monthsToTarget: number | null
  isComplete: boolean
}

/** Pure: progress toward a goal's target. */
export function goalProgress(goal: Pick<Goal, 'target' | 'current' | 'monthlyContribution'>): GoalProgress {
  const pct = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0
  const remaining = Math.max(0, goal.target - goal.current)
  const monthsToTarget =
    remaining > 0 && goal.monthlyContribution > 0
      ? Math.ceil(remaining / goal.monthlyContribution)
      : remaining === 0
        ? 0
        : null
  return { pct, remaining, monthsToTarget, isComplete: remaining === 0 && goal.target > 0 }
}

/** Suggested emergency-fund target: a number of months of average expenses. */
export function suggestedEmergencyTarget(avgMonthlyExpenses: number, months = 4): number {
  return Math.round((avgMonthlyExpenses * months) / 100) * 100
}

export const GOAL_PRESETS: { kind: GoalKind; name: string; icon: string }[] = [
  { kind: 'house', name: 'House Down Payment', icon: 'Home' },
  { kind: 'emergency', name: 'Emergency Fund', icon: 'ShieldCheck' },
  { kind: 'savings', name: 'Savings Goal', icon: 'PiggyBank' },
  { kind: 'debt_payoff', name: 'Debt Payoff', icon: 'CreditCard' },
  { kind: 'custom', name: 'Custom Goal', icon: 'Target' },
]

export async function addGoal(input: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const now = new Date()
  const id = await db.goals.add({ ...input, createdAt: now, updatedAt: now })
  return id as number
}

export async function updateGoal(id: number, patch: Partial<Goal>): Promise<void> {
  await db.goals.update(id, { ...patch, updatedAt: new Date() })
}

export async function deleteGoal(id: number): Promise<void> {
  await db.goals.delete(id)
}

export async function getGoals(): Promise<Goal[]> {
  return db.goals.toArray()
}
