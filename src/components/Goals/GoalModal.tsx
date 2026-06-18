import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import { addGoal, updateGoal, deleteGoal, GOAL_PRESETS } from '../../lib/goals'
import type { Goal, GoalKind } from '../../lib/types'

export function GoalModal({
  goal,
  open,
  onClose,
}: {
  goal: Goal | null // null = creating
  open: boolean
  onClose: () => void
}) {
  const editing = goal != null
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? 'house')
  const [name, setName] = useState(goal?.name ?? '')
  const [target, setTarget] = useState(goal?.target ? String(goal.target) : '')
  const [current, setCurrent] = useState(goal?.current ? String(goal.current) : '')
  const [monthly, setMonthly] = useState(goal?.monthlyContribution ? String(goal.monthlyContribution) : '')

  const presetName = GOAL_PRESETS.find((p) => p.kind === kind)?.name ?? 'Goal'
  const targetNum = parseFloat(target)
  const canSave = !isNaN(targetNum) && targetNum > 0

  const handleSave = async () => {
    if (!canSave) return
    const payload = {
      kind,
      name: name.trim() || presetName,
      target: targetNum,
      current: parseFloat(current) || 0,
      monthlyContribution: parseFloat(monthly) || 0,
    }
    if (editing && goal?.id != null) await updateGoal(goal.id, payload)
    else await addGoal(payload)
    onClose()
  }

  const handleDelete = async () => {
    if (goal?.id != null) await deleteGoal(goal.id)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Goal' : 'New Goal'}>
      <div className="space-y-4">
        {!editing && (
          <div>
            <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">Type</label>
            <div className="grid grid-cols-3 gap-1.5">
              {GOAL_PRESETS.map((p) => (
                <button
                  key={p.kind}
                  onClick={() => setKind(p.kind)}
                  className={`px-2 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                    kind === p.kind
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'bg-bg-elevated text-text-muted border border-transparent'
                  }`}
                >
                  {p.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={presetName}
            className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm focus:border-accent focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">Target</label>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="50000"
              type="number"
              inputMode="decimal"
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
              autoFocus
            />
          </div>
          <div>
            <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">Saved so far</label>
            <input
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="0"
              type="number"
              inputMode="decimal"
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">
            Monthly contribution <span className="text-text-muted/50">(optional — shows your timeline)</span>
          </label>
          <input
            value={monthly}
            onChange={(e) => setMonthly(e.target.value)}
            placeholder="0"
            type="number"
            inputMode="decimal"
            className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
          />
        </div>

        <Button onClick={handleSave} fullWidth disabled={!canSave}>
          {editing ? 'Save Goal' : 'Add Goal'}
        </Button>

        {editing && (
          <Button variant="danger" onClick={handleDelete} fullWidth icon={<Trash2 size={14} />}>
            Delete Goal
          </Button>
        )}
      </div>
    </Modal>
  )
}
