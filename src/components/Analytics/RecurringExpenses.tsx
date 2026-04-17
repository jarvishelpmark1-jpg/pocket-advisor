import { useState, useEffect } from 'react'
import { Repeat } from 'lucide-react'
import { detectRecurring } from '../../lib/analytics'
import { formatCurrency, formatDate } from '../../lib/formatters'
import { getCategoryName, getCategoryColor } from '../../lib/categories'
import { Card, CardHeader } from '../shared/Card'
import { Badge } from '../shared/Badge'
import type { RecurringTransaction } from '../../lib/types'

const FREQUENCY_LABELS = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
}

export function RecurringExpenses() {
  const [data, setData] = useState<RecurringTransaction[]>([])

  useEffect(() => {
    detectRecurring().then(setData)
  }, [])

  if (data.length === 0) return null

  const monthlyTotal = data.reduce((sum, d) => {
    const multiplier = { weekly: 4.33, biweekly: 2.17, monthly: 1, quarterly: 0.33, annual: 0.083 }
    return sum + d.averageAmount * (multiplier[d.frequency] || 1)
  }, 0)

  return (
    <Card>
      <CardHeader
        title="Recurring Expenses"
        subtitle={`~${formatCurrency(monthlyTotal)}/mo detected`}
      />
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.merchantName} className="flex items-center gap-3 py-1.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold flex-shrink-0"
              style={{
                backgroundColor: getCategoryColor(item.categoryId) + '15',
                color: getCategoryColor(item.categoryId),
              }}
            >
              <Repeat size={12} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-xs truncate">{item.merchantName}</p>
              <p className="text-text-muted text-[9px]">
                {FREQUENCY_LABELS[item.frequency]} · Last: {formatDate(item.lastSeen)}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-text-primary text-xs font-mono font-medium block">
                {formatCurrency(item.averageAmount)}
              </span>
              <Badge color={getCategoryColor(item.categoryId)} size="sm">
                {getCategoryName(item.categoryId)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
