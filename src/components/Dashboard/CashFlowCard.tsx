import { useState, useEffect } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { getMonthlyTotals } from '../../lib/analytics'
import { formatCurrency } from '../../lib/formatters'
import { Card, CardHeader } from '../shared/Card'
import { ProgressBar } from '../shared/ProgressBar'

export function CashFlowCard({ month }: { month: string }) {
  const [data, setData] = useState({ totalIncome: 0, totalExpenses: 0, netSavings: 0, savingsRate: 0 })

  useEffect(() => {
    getMonthlyTotals(month).then(setData)
  }, [month])

  const { totalIncome, totalExpenses, netSavings } = data
  const isPositive = netSavings >= 0

  return (
    <Card>
      <CardHeader title="Cash Flow" />
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowDownRight size={14} className="text-income" />
            <span className="text-text-muted text-xs">Income</span>
          </div>
          <span className="text-income font-semibold text-lg font-mono">
            {formatCurrency(totalIncome, true)}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowUpRight size={14} className="text-expense" />
            <span className="text-text-muted text-xs">Expenses</span>
          </div>
          <span className="text-expense font-semibold text-lg font-mono">
            {formatCurrency(totalExpenses, true)}
          </span>
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-text-muted text-xs">Net</span>
          <span className={`text-sm font-semibold font-mono ${isPositive ? 'text-income' : 'text-expense'}`}>
            {isPositive ? '+' : ''}{formatCurrency(netSavings)}
          </span>
        </div>
        {totalIncome > 0 && (
          <ProgressBar
            value={totalExpenses}
            max={totalIncome}
            color={totalExpenses > totalIncome ? '#F43F5E' : '#6366F1'}
            height={4}
          />
        )}
      </div>
    </Card>
  )
}
