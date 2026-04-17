import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { getSpendingVelocity, getMonthlyTotals } from '../../lib/analytics'
import { formatCurrency } from '../../lib/formatters'
import { Card, CardHeader } from '../shared/Card'
import { format, parseISO, getDaysInMonth } from 'date-fns'

export function DailyVelocity({ month }: { month: string }) {
  const [data, setData] = useState<{ date: string; amount: number }[]>([])
  const [avgDaily, setAvgDaily] = useState(0)

  useEffect(() => {
    getSpendingVelocity(month).then(d => {
      setData(d)
      const total = d.reduce((s, v) => s + v.amount, 0)
      const days = getDaysInMonth(parseISO(month + '-01'))
      setAvgDaily(total / days)
    })
  }, [month])

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader
        title="Daily Spending"
        subtitle={`Avg ${formatCurrency(avgDaily)}/day`}
      />
      <div className="h-32 -mx-2">
        <ResponsiveContainer>
          <BarChart data={data}>
            <XAxis
              dataKey="date"
              tickFormatter={(d) => format(parseISO(d), 'd')}
              tick={{ fontSize: 9, fill: '#6B7280' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1A1F2E',
                border: '1px solid #2A3040',
                borderRadius: 12,
                fontSize: 11,
                color: '#F9FAFB',
              }}
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(d) => format(parseISO(d as string), 'MMM d')}
            />
            <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={12}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.amount > avgDaily * 2 ? '#F43F5E' : entry.amount > avgDaily ? '#F59E0B' : '#6366F1'}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2">
        <Legend color="#6366F1" label="Normal" />
        <Legend color="#F59E0B" label="Above avg" />
        <Legend color="#F43F5E" label="High" />
      </div>
    </Card>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-text-muted text-[9px]">{label}</span>
    </div>
  )
}
