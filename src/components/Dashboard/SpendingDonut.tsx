import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { getCategoryBreakdown } from '../../lib/analytics'
import { getCategoryColor, getCategoryName } from '../../lib/categories'
import { formatCurrency } from '../../lib/formatters'
import { Card, CardHeader } from '../shared/Card'
import type { CategoryId } from '../../lib/types'

export function SpendingDonut({ month }: { month: string }) {
  const [data, setData] = useState<{ categoryId: CategoryId; total: number; count: number }[]>([])

  useEffect(() => {
    getCategoryBreakdown(month).then(setData)
  }, [month])

  if (data.length === 0) return null

  const total = data.reduce((s, d) => s + d.total, 0)
  const top = data.slice(0, 8)
  const otherTotal = data.slice(8).reduce((s, d) => s + d.total, 0)
  const chartData = otherTotal > 0
    ? [...top, { categoryId: 'other' as CategoryId, total: otherTotal, count: 0 }]
    : top

  return (
    <Card>
      <CardHeader title="Spending Breakdown" subtitle={`${formatCurrency(total)} total`} />

      <div className="flex items-center gap-4">
        <div className="w-28 h-28 flex-shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="total"
                innerRadius={32}
                outerRadius={52}
                paddingAngle={2}
                strokeWidth={0}
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={getCategoryColor(entry.categoryId)} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 space-y-2 min-w-0">
          {top.slice(0, 5).map((item) => {
            const pct = ((item.total / total) * 100).toFixed(0)
            return (
              <div key={item.categoryId} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getCategoryColor(item.categoryId) }}
                />
                <span className="text-text-secondary text-[11px] flex-1 truncate">
                  {getCategoryName(item.categoryId)}
                </span>
                <span className="text-text-muted text-[10px] font-mono">{pct}%</span>
                <span className="text-text-primary text-[11px] font-mono font-medium w-16 text-right">
                  {formatCurrency(item.total, true)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
