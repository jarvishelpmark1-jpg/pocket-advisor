import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Home, ShieldCheck, PiggyBank, CreditCard, Target, Plus, Check } from 'lucide-react'
import { getGoals, goalProgress } from '../../lib/goals'
import { formatCurrency } from '../../lib/formatters'
import { Card } from '../shared/Card'
import { ProgressBar } from '../shared/ProgressBar'
import { GoalModal } from './GoalModal'
import type { Goal, GoalKind } from '../../lib/types'

const ICONS: Record<GoalKind, typeof Home> = {
  house: Home,
  emergency: ShieldCheck,
  savings: PiggyBank,
  debt_payoff: CreditCard,
  custom: Target,
}

export function GoalsCard() {
  const goals = useLiveQuery(() => getGoals())
  const [editing, setEditing] = useState<Goal | null>(null)
  const [adding, setAdding] = useState(false)

  if (goals === undefined) return null

  return (
    <>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-text-primary text-sm font-semibold">Goals</h3>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-accent text-[11px] font-medium"
            aria-label="Add goal"
          >
            <Plus size={13} />
            Add
          </button>
        </div>

        {goals.length === 0 ? (
          <button
            onClick={() => setAdding(true)}
            className="w-full text-left py-2 text-text-muted text-xs"
          >
            Set a house-fund or emergency-fund target and the dashboard will track your progress and timeline.
          </button>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => {
              const Icon = ICONS[goal.kind]
              const p = goalProgress(goal)
              return (
                <button key={goal.id} onClick={() => setEditing(goal)} className="w-full text-left">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-lg bg-accent/15 text-accent flex items-center justify-center flex-shrink-0">
                      {p.isComplete ? <Check size={13} /> : <Icon size={13} />}
                    </div>
                    <span className="text-text-primary text-xs font-medium flex-1 truncate">{goal.name}</span>
                    <span className="text-text-secondary text-[11px] font-mono">
                      {formatCurrency(goal.current, true)} / {formatCurrency(goal.target, true)}
                    </span>
                  </div>
                  <ProgressBar value={goal.current} max={goal.target} color={p.isComplete ? '#10B981' : '#6366F1'} height={5} />
                  <p className="text-text-muted text-[10px] mt-1">
                    {p.isComplete
                      ? 'Goal reached 🎉'
                      : p.monthsToTarget != null
                        ? `${formatCurrency(p.remaining, true)} to go · ~${p.monthsToTarget} mo at current pace`
                        : `${formatCurrency(p.remaining, true)} to go`}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {adding && <GoalModal key="new-goal" goal={null} open onClose={() => setAdding(false)} />}
      {editing && <GoalModal key={editing.id} goal={editing} open onClose={() => setEditing(null)} />}
    </>
  )
}
