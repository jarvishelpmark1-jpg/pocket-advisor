import { useState, useEffect } from 'react'
import { getCategoryBreakdown } from '../../lib/analytics'
import { getCategoryColor, getCategoryName } from '../../lib/categories'
import { formatCurrency } from '../../lib/formatters'
import { Card, CardHeader } from '../shared/Card'
import type { CategoryId } from '../../lib/types'

export function SpendingTrends({ month }: { month: string }) {
  const [data, setData] = useState<{ categoryId: CategoryId; total: number; count: number }[]>([])

  useEffect(() => {
    getCategoryBreakdown(month).then(setData)
  }, [month])

  if (data.length === 0) return null

  const max = data[0]?.total || 1

  return (
    <Card>
      <CardHeader title="Category Breakdown" subtitle={`${data.length} categories`} />
      <div className="space-y-2.5">
        {data.map((item) => {
          const pct = (item.total / max) * 100
          return (
            <div key={item.categoryId}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getCategoryColor(item.categoryId) }}
                  />
                  <span className="text-text-secondary text-[11px]">{getCategoryName(item.categoryId)}</span>
                  <span className="text-text-muted text-[9px]">{item.count}x</span>
                </div>
                <span className="text-text-primary text-[11px] font-mono font-medium">
                  {formatCurrency(item.total)}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-bg-elevated overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: getCategoryColor(item.categoryId),
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
