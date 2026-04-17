import { useNavigate } from 'react-router-dom'
import { useTransactions } from '../../hooks/useTransactions'
import { formatCurrency, formatDate, cleanDescription } from '../../lib/formatters'
import { getCategoryColor, getCategoryName } from '../../lib/categories'
import { Card, CardHeader } from '../shared/Card'

export function RecentTransactions({ month }: { month: string }) {
  const transactions = useTransactions(month)
  const navigate = useNavigate()

  if (!transactions || transactions.length === 0) return null

  const recent = transactions.slice(0, 8)

  return (
    <Card>
      <CardHeader
        title="Recent Transactions"
        action={
          <button
            onClick={() => navigate('/transactions')}
            className="text-accent text-[11px] font-medium"
          >
            See all
          </button>
        }
      />
      <div className="space-y-0.5">
        {recent.map((txn) => (
          <div
            key={txn.id}
            className="flex items-center gap-3 py-2 px-1 rounded-lg hover:bg-bg-elevated/50 transition-colors"
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
              <p className="text-text-primary text-sm truncate">
                {txn.merchantName || cleanDescription(txn.description)}
              </p>
              <p className="text-text-muted text-[10px]">
                {getCategoryName(txn.categoryId)} · {formatDate(txn.date)}
              </p>
            </div>
            <span
              className={`text-sm font-mono font-medium flex-shrink-0 ${
                txn.amount > 0 ? 'text-income' : 'text-text-primary'
              }`}
            >
              {txn.amount > 0 ? '+' : ''}{formatCurrency(txn.amount)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}
