import { useState, useMemo } from 'react'
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, subMonths } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { getMonthKey } from '../../lib/analytics'
import { formatCurrency, formatDate, cleanDescription, formatMonthLong } from '../../lib/formatters'
import { getCategoryName, getCategoryColor, CATEGORIES } from '../../lib/categories'
import { Card } from '../shared/Card'
import { EmptyState } from '../shared/EmptyState'
import { Modal } from '../shared/Modal'
import { CategoryGrid } from '../Review/CategoryGrid'
import { updateTransactionCategory } from '../../hooks/useTransactions'
import { learnFromCorrection } from '../../lib/classifier'
import type { Transaction, CategoryId } from '../../lib/types'

export function TransactionsPage() {
  const [currentMonth, setCurrentMonth] = useState(getMonthKey(new Date()))
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<CategoryId | 'all'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date')
  const [editing, setEditing] = useState<Transaction | null>(null)

  const transactions = useLiveQuery(async () => {
    const start = new Date(currentMonth + '-01')
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59)
    return db.transactions
      .where('date')
      .between(start, end, true, true)
      .toArray()
  }, [currentMonth])

  const filtered = useMemo(() => {
    if (!transactions) return []
    let result = [...transactions]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter(t =>
        t.description.toLowerCase().includes(q) ||
        (t.merchantName && t.merchantName.toLowerCase().includes(q))
      )
    }

    if (filterCategory !== 'all') {
      result = result.filter(t => t.categoryId === filterCategory)
    }

    result.sort((a, b) => {
      if (sortBy === 'amount') return Math.abs(b.amount) - Math.abs(a.amount)
      return b.date.getTime() - a.date.getTime()
    })

    return result
  }, [transactions, search, filterCategory, sortBy])

  const prevMonth = () => setCurrentMonth(getMonthKey(subMonths(new Date(currentMonth + '-01'), 1)))
  const nextMonth = () => {
    const next = getMonthKey(new Date(new Date(currentMonth + '-01').getFullYear(), new Date(currentMonth + '-01').getMonth() + 1, 1))
    if (next <= getMonthKey(new Date())) setCurrentMonth(next)
  }

  const handleReclassify = async (txn: Transaction, categoryId: CategoryId) => {
    await updateTransactionCategory(txn.id!, categoryId)
    await learnFromCorrection(txn.description, categoryId)
    setEditing(null)
  }

  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {}
    for (const txn of filtered) {
      const key = format(txn.date, 'yyyy-MM-dd')
      if (!groups[key]) groups[key] = []
      groups[key].push(txn)
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  return (
    <div className="min-h-full pb-4">
      <div className="px-4 pt-14 pb-2">
        <h1 className="text-text-primary text-lg font-bold">Transactions</h1>
      </div>

      <div className="px-4 mb-3 flex items-center justify-between">
        <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted">
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-text-primary font-semibold text-sm">{formatMonthLong(currentMonth)}</h2>
        <button
          onClick={nextMonth}
          disabled={currentMonth === getMonthKey(new Date())}
          className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted disabled:opacity-20"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="px-4 mb-3 flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions..."
            className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-3 py-2 text-text-primary text-xs focus:border-accent focus:outline-none"
          />
        </div>
        <button
          onClick={() => setSortBy(s => s === 'date' ? 'amount' : 'date')}
          className="p-2 rounded-xl bg-bg-card border border-border text-text-muted"
          title={`Sort by ${sortBy === 'date' ? 'amount' : 'date'}`}
        >
          <ArrowUpDown size={14} />
        </button>
      </div>

      <div className="px-4">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Search size={24} />}
            title="No Transactions"
            description={search ? 'Try a different search term' : 'No transactions for this month'}
          />
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, txns]) => (
              <div key={date}>
                <p className="text-text-muted text-[10px] font-medium mb-1.5 px-1">
                  {formatDate(date)} · {txns.length} transaction{txns.length !== 1 ? 's' : ''}
                </p>
                <Card padding="sm">
                  <div className="divide-y divide-border">
                    {txns.map((txn) => (
                      <button
                        key={txn.id}
                        onClick={() => setEditing(txn)}
                        className="flex items-center gap-3 py-2.5 w-full text-left first:pt-0 last:pb-0"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{
                            backgroundColor: getCategoryColor(txn.categoryId) + '15',
                            color: getCategoryColor(txn.categoryId),
                          }}
                        >
                          {(txn.merchantName || txn.description).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-text-primary text-xs truncate">
                            {txn.merchantName || cleanDescription(txn.description)}
                          </p>
                          <p className="text-text-muted text-[9px]">{getCategoryName(txn.categoryId)}</p>
                        </div>
                        <span className={`text-xs font-mono font-medium flex-shrink-0 ${
                          txn.amount > 0 ? 'text-income' : 'text-text-primary'
                        }`}>
                          {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
                        </span>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Transaction">
          <div className="space-y-4">
            <div>
              <p className="text-text-primary text-sm font-medium">
                {editing.merchantName || cleanDescription(editing.description)}
              </p>
              <p className="text-text-muted text-xs mt-0.5">
                {formatDate(editing.date)} · {formatCurrency(editing.amount)}
              </p>
              <p className="text-text-muted text-[10px] mt-1 font-mono">{editing.originalDescription}</p>
            </div>

            <div>
              <p className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-2">Category</p>
              <CategoryGrid
                onSelect={(catId) => handleReclassify(editing, catId)}
                suggestedId={editing.categoryId}
                showIncome={editing.amount > 0}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
