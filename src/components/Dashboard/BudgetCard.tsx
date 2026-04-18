import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { getSettings } from '../../lib/settings'
import { getMonthlyTotals } from '../../lib/analytics'
import { getCategoryName, getCategoryColor } from '../../lib/categories'
import { formatCurrency } from '../../lib/formatters'
import { Card, CardHeader } from '../shared/Card'
import { ProgressBar } from '../shared/ProgressBar'
import type { CategoryId } from '../../lib/types'

export function BudgetCard({ month }: { month: string }) {
  const navigate = useNavigate()
  const settings = getSettings()
  const [totals, setTotals] = useState({ totalExpenses: 0, categoryTotals: {} as Record<string, number> })

  useEffect(() => {
    getMonthlyTotals(month).then(setTotals)
  }, [month])

  if (!settings.monthlyBudget && Object.keys(settings.budgets).length === 0) return null

  const { totalExpenses, categoryTotals } = totals
  const overBudget = settings.monthlyBudget > 0 && totalExpenses > settings.monthlyBudget
  const pct = settings.monthlyBudget > 0 ? (totalExpenses / settings.monthlyBudget) * 100 : 0
  const remaining = settings.monthlyBudget - totalExpenses

  const overBudgetCategories = Object.entries(settings.budgets)
    .filter(([catId, budget]) => {
      if (!budget) return false
      const spent = categoryTotals[catId] || 0
      return spent > budget
    })
    .map(([catId, budget]) => ({
      catId: catId as CategoryId,
      budget: budget!,
      spent: categoryTotals[catId] || 0,
    }))
    .sort((a, b) => (b.spent - b.budget) - (a.spent - a.budget))

  return (
    <Card>
      <CardHeader
        title="Budget"
        action={
          <button onClick={() => navigate('/settings')} className="text-accent text-[11px] font-medium">
            Edit
          </button>
        }
      />

      {settings.monthlyBudget > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-text-muted text-xs">
              {formatCurrency(totalExpenses)} of {formatCurrency(settings.monthlyBudget)}
            </span>
            <span className={`text-xs font-mono font-medium ${overBudget ? 'text-expense' : 'text-income'}`}>
              {overBudget ? 'Over by ' + formatCurrency(Math.abs(remaining)) : formatCurrency(remaining) + ' left'}
            </span>
          </div>
          <ProgressBar
            value={Math.min(pct, 100)}
            color={pct > 100 ? '#F43F5E' : pct > 80 ? '#F59E0B' : '#10B981'}
            height={6}
          />
        </div>
      )}

      {overBudgetCategories.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          {overBudgetCategories.slice(0, 3).map(({ catId, budget, spent }) => (
            <div key={catId} className="flex items-center gap-2">
              <AlertTriangle size={12} className="text-warning flex-shrink-0" />
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: getCategoryColor(catId) }}
              />
              <span className="text-text-secondary text-xs flex-1 truncate">{getCategoryName(catId)}</span>
              <span className="text-expense text-[11px] font-mono">
                {formatCurrency(spent)} / {formatCurrency(budget)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
