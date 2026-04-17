import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { getMonthKey } from '../../lib/analytics'
import { formatMonthLong } from '../../lib/formatters'
import { NetWorthCard } from './NetWorthCard'
import { CashFlowCard } from './CashFlowCard'
import { SpendingDonut } from './SpendingDonut'
import { SavingsRateCard } from './SavingsRateCard'
import { RecentTransactions } from './RecentTransactions'
import { MonthlyTrendChart } from './MonthlyTrendChart'
import { QuickActions } from './QuickActions'
import { EmptyState } from '../shared/EmptyState'

export function Dashboard() {
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date()))
  const navigate = useNavigate()

  const txnCount = useLiveQuery(() => db.transactions.count())
  const accountCount = useLiveQuery(() => db.accounts.count())

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
        <Header />
        <div className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            icon={<Sparkles size={28} />}
            title="Welcome to Pocket Advisor"
            description="Upload your first bank or credit card statement to get started with smart financial insights."
            action={
              <button
                onClick={() => navigate('/upload')}
                className="bg-accent text-white px-6 py-3 rounded-xl font-medium text-sm active:scale-95 transition-transform"
              >
                Upload Statement
              </button>
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
        <NetWorthCard />
        <CashFlowCard month={currentMonth} />
        <div className="grid grid-cols-2 gap-3">
          <SavingsRateCard month={currentMonth} />
          <QuickActions />
        </div>
        <SpendingDonut month={currentMonth} />
        <MonthlyTrendChart />
        <RecentTransactions month={currentMonth} />
      </div>
    </div>
  )
}

function Header() {
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="px-4 pt-14 pb-3 flex items-center justify-between">
      <div>
        <p className="text-text-muted text-xs">{greeting}</p>
        <h1 className="text-text-primary text-lg font-bold tracking-tight">Pocket Advisor</h1>
      </div>
      <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center">
        <Sparkles size={16} className="text-accent" />
      </div>
    </div>
  )
}
