import { useState } from 'react'
import { format, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { getMonthKey } from '../../lib/analytics'
import { formatMonthLong } from '../../lib/formatters'
import { SpendingTrends } from './SpendingTrends'
import { NeedsWantsChart } from './NeedsWantsChart'
import { TopMerchants } from './TopMerchants'
import { RecurringExpenses } from './RecurringExpenses'
import { DailyVelocity } from './DailyVelocity'
import { EmptyState } from '../shared/EmptyState'

export function AnalyticsPage() {
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date()))
  const txnCount = useLiveQuery(() => db.transactions.count())

  const prevMonth = () => {
    const d = new Date(currentMonth + '-01')
    setCurrentMonth(getMonthKey(subMonths(d, 1)))
  }
  const nextMonth = () => {
    const d = new Date(currentMonth + '-01')
    const next = getMonthKey(new Date(d.getFullYear(), d.getMonth() + 1, 1))
    if (next <= getMonthKey(new Date())) setCurrentMonth(next)
  }
  const isCurrentMonth = currentMonth === getMonthKey(new Date())

  if (txnCount === 0) {
    return (
      <div className="min-h-full flex flex-col">
        <div className="px-4 pt-14 pb-4">
          <h1 className="text-text-primary text-lg font-bold">Insights</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<BarChart3 size={28} />}
            title="No Data Yet"
            description="Upload your first statement to unlock deep financial insights."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full pb-4">
      <div className="px-4 pt-14 pb-2">
        <h1 className="text-text-primary text-lg font-bold">Insights</h1>
        <p className="text-text-muted text-xs mt-0.5">Deep analysis of your spending</p>
      </div>

      <div className="px-4 mb-4 flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted">
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-text-primary font-semibold text-sm">{formatMonthLong(currentMonth)}</h2>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted disabled:opacity-20"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="px-4 space-y-3">
        <NeedsWantsChart month={currentMonth} />
        <DailyVelocity month={currentMonth} />
        <SpendingTrends month={currentMonth} />
        <TopMerchants month={currentMonth} />
        <RecurringExpenses />
      </div>
    </div>
  )
}
