import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { getMonthlyTotals, getCategoryBreakdown, getIncomeBreakdown } from '../../lib/analytics'
import { getCategoryName } from '../../lib/categories'
import { formatCurrency } from '../../lib/formatters'
import { Card } from '../shared/Card'
import { ProgressBar } from '../shared/ProgressBar'

export function MoneyFlowCard({ month }: { month: string }) {
  const data = useLiveQuery(async () => {
    const [totals, spend, income] = await Promise.all([
      getMonthlyTotals(month),
      getCategoryBreakdown(month),
      getIncomeBreakdown(month),
    ])
    return { totals, spend, income }
  }, [month])

  if (!data) return null

  const { totals, spend, income } = data
  const isPositive = totals.netSavings >= 0

  return (
    <Card>
      <div className="grid grid-cols-2 gap-3">
        <Section
          label="Money In"
          total={totals.totalIncome}
          color="#10B981"
          icon={<ArrowDownLeft size={13} />}
          rows={income.slice(0, 3).map((r) => ({ name: r.source, amount: r.total }))}
        />
        <Section
          label="Money Out"
          total={totals.totalExpenses}
          color="#F43F5E"
          icon={<ArrowUpRight size={13} />}
          rows={spend.slice(0, 3).map((r) => ({ name: getCategoryName(r.categoryId), amount: r.total }))}
        />
      </div>

      <div className="border-t border-border mt-3 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-muted text-xs">
            Net {isPositive ? 'kept' : 'shortfall'}
            {totals.totalIncome > 0 && (
              <span className="text-text-muted/60"> · {totals.savingsRate.toFixed(0)}% of income</span>
            )}
          </span>
          <span className={`text-sm font-bold font-mono ${isPositive ? 'text-income' : 'text-expense'}`}>
            {isPositive ? '+' : ''}{formatCurrency(totals.netSavings)}
          </span>
        </div>
        {totals.totalIncome > 0 && (
          <ProgressBar
            value={totals.totalExpenses}
            max={totals.totalIncome}
            color={totals.totalExpenses > totals.totalIncome ? '#F43F5E' : '#10B981'}
            height={4}
          />
        )}
      </div>
    </Card>
  )
}

function Section({
  label,
  total,
  color,
  icon,
  rows,
}: {
  label: string
  total: number
  color: string
  icon: React.ReactNode
  rows: { name: string; amount: number }[]
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1" style={{ color }}>
        {icon}
        <span className="text-text-muted text-xs">{label}</span>
      </div>
      <span className="font-bold text-lg font-mono" style={{ color }}>
        {formatCurrency(total, true)}
      </span>
      <div className="mt-2 space-y-1">
        {rows.length === 0 ? (
          <p className="text-text-muted/50 text-[10px]">None this month</p>
        ) : (
          rows.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-2">
              <span className="text-text-secondary text-[10px] truncate">{r.name}</span>
              <span className="text-text-muted text-[10px] font-mono flex-shrink-0">{formatCurrency(r.amount, true)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
