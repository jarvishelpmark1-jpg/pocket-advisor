import { useState, useEffect } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { getMonthlyTrend } from '../../lib/analytics'
import { formatCurrency, formatMonthShort } from '../../lib/formatters'
import { Card, CardHeader } from '../shared/Card'

export function MonthlyTrendChart() {
  const [data, setData] = useState<{ month: string; income: number; expenses: number; net: number }[]>([])

  useEffect(() => {
    getMonthlyTrend(6).then(setData)
  }, [])

  const hasData = data.some(d => d.income > 0 || d.expenses > 0)
  if (!hasData) return null

  return (
    <Card>
      <CardHeader title="6-Month Trend" />
      <div className="h-40 -mx-2">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
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
              dataKey="income"
              stroke="#10B981"
              fill="url(#incomeGrad)"
              strokeWidth={2}
              dot={false}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#F43F5E"
              fill="url(#expenseGrad)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-6 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-income" />
          <span className="text-text-muted text-[10px]">Income</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-expense" />
          <span className="text-text-muted text-[10px]">Expenses</span>
        </div>
      </div>
    </Card>
  )
}
