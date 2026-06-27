import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { getNetWorthHistory } from '../../lib/analytics'
import { formatCurrency, formatMonthShort } from '../../lib/formatters'
import { Card, CardHeader } from '../shared/Card'

export function NetWorthTrendChart() {
  const [data, setData] = useState<{ month: string; netWorth: number }[]>([])

  useEffect(() => {
    getNetWorthHistory(12).then(setData)
  }, [])

  // A single point (or a flat line of identical values) tells you nothing — only
  // show the chart once there are at least two distinct net-worth readings.
  const distinct = new Set(data.map((d) => Math.round(d.netWorth)))
  if (data.length < 2 || distinct.size < 2) return null

  return (
    <Card>
      <CardHeader title="Net Worth Over Time" />
      <div className="h-40 -mx-2">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366F1" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthShort}
              tick={{ fontSize: 10, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1A1F2E',
                border: '1px solid #2A3040',
                borderRadius: 12,
                fontSize: 12,
                color: '#F9FAFB',
              }}
              formatter={(value: unknown) => formatCurrency(Number(value))}
              labelFormatter={(label: unknown) => formatMonthShort(String(label))}
            />
            <Area
              type="monotone"
              dataKey="netWorth"
              stroke="#6366F1"
              fill="url(#netWorthGrad)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
