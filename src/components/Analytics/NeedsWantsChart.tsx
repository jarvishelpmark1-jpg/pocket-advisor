import { useState, useEffect } from 'react'
import { getNeedsWantsSavings, getMonthlyTotals } from '../../lib/analytics'
import { formatCurrency, formatPercent } from '../../lib/formatters'
import { Card, CardHeader } from '../shared/Card'

export function NeedsWantsChart({ month }: { month: string }) {
  const [data, setData] = useState({ needs: 0, wants: 0, savings: 0 })
  const [income, setIncome] = useState(0)

  useEffect(() => {
    getNeedsWantsSavings(month).then(setData)
    getMonthlyTotals(month).then(d => setIncome(d.totalIncome))
  }, [month])

  const total = data.needs + data.wants + data.savings
  if (total === 0) return null

  const items = [
    { label: 'Needs', value: data.needs, target: 50, color: '#3B82F6' },
    { label: 'Wants', value: data.wants, target: 30, color: '#A855F7' },
    { label: 'Savings', value: data.savings, target: 20, color: '#10B981' },
  ]

  return (
    <Card>
      <CardHeader
        title="50 / 30 / 20 Rule"
        subtitle={income > 0 ? `Based on ${formatCurrency(income, true)} income` : undefined}
      />

      <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-bg-elevated mb-4">
        {items.map((item) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0
          return (
            <div
              key={item.label}
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: item.color }}
            />
          )
        })}
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const pct = income > 0 ? (item.value / income) * 100 : (total > 0 ? (item.value / total) * 100 : 0)
          const diff = pct - item.target
          const overBudget = diff > 5

          return (
            <div key={item.label} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-text-secondary text-xs flex-1">{item.label}</span>
              <span className="text-text-primary text-xs font-mono font-medium">{formatCurrency(item.value, true)}</span>
              <span className={`text-[10px] font-mono w-12 text-right ${overBudget ? 'text-expense' : 'text-text-muted'}`}>
                {pct.toFixed(0)}%
              </span>
              <span className="text-text-muted text-[10px] w-8 text-right">/{item.target}%</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
