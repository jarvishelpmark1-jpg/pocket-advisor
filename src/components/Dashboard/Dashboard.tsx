import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subMonths, addMonths, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Settings, Upload } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { getMonthKey } from '../../lib/analytics'
import { formatMonthLong } from '../../lib/formatters'
import { NetWorthCard } from './NetWorthCard'
import { InsightsCard } from './InsightsCard'
import { MoneyFlowCard } from './MoneyFlowCard'
import { SpendingDonut } from './SpendingDonut'
import { SavingsRateCard } from './SavingsRateCard'
import { BudgetCard } from './BudgetCard'
import { RecentTransactions } from './RecentTransactions'
import { MonthlyTrendChart } from './MonthlyTrendChart'
import { QuickActions } from './QuickActions'
import { GoalsCard } from '../Goals/GoalsCard'
import { EmptyState } from '../shared/EmptyState'

export function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date()))
  const navigate = useNavigate()

  const txnCount = useLiveQuery(() => db.transactions.count())

  const prevMonth = () => {
    setCurrentMonth(getMonthKey(subMonths(parseISO(currentMonth + '-01'), 1)))
  }

  const nextMonth = () => {
    const next = getMonthKey(addMonths(parseISO(currentMonth + '-01'), 1))
    if (next <= getMonthKey(new Date())) setCurrentMonth(next)
  }

  const isCurrentMonth = currentMonth === getMonthKey(new Date())

  if (txnCount === 0) {
    return (
      <div className="min-h-full flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            icon={<Upload size={28} />}
            title="Welcome to Pocket Advisor"
            description="Upload a bank or credit card statement to get started — or add a transaction by hand to try it out."
            action={
              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={() => navigate('/upload')}
                  className="bg-accent text-white px-6 py-3 rounded-xl font-medium text-sm active:scale-95 transition-transform"
                >
                  Upload Statement
                </button>
                <button
                  onClick={() => navigate('/transactions')}
                  className="text-accent text-sm font-medium px-6 py-2 active:scale-95 transition-transform"
                >
                  Add a transaction manually
                </button>
              </div>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full pb-4">
      <Header />

      <div className="px-4 mb-4 flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted" aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-text-primary font-semibold text-sm">{formatMonthLong(currentMonth)}</h2>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted disabled:opacity-20"
          aria-label="Next month"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="px-4 space-y-3">
        <InsightsCard month={currentMonth} />
        <NetWorthCard />
        <MoneyFlowCard month={currentMonth} />
        <GoalsCard />
        <div className="grid grid-cols-2 gap-3">
          <SavingsRateCard month={currentMonth} />
          <QuickActions />
        </div>
        <BudgetCard month={currentMonth} />
        <SpendingDonut month={currentMonth} />
        <MonthlyTrendChart />
        <RecentTransactions month={currentMonth} />
      </div>
    </div>
  )
}

function Header() {
  const navigate = useNavigate()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="px-4 pt-14 pb-3 flex items-center justify-between">
      <div>
        <p className="text-text-muted text-xs">{greeting}</p>
        <h1 className="text-text-primary text-lg font-bold tracking-tight">Pocket Advisor</h1>
      </div>
      <button
        onClick={() => navigate('/settings')}
        className="w-9 h-9 rounded-full bg-bg-elevated flex items-center justify-center"
        aria-label="Settings"
      >
        <Settings size={16} className="text-text-muted" />
      </button>
    </div>
  )
}
