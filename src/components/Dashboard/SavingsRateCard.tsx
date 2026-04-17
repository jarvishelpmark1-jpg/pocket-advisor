import { useState, useEffect } from 'react'
import { PiggyBank } from 'lucide-react'
import { getMonthlyTotals } from '../../lib/analytics'
import { Card } from '../shared/Card'

export function SavingsRateCard({ month }: { month: string }) {
  const [rate, setRate] = useState(0)

  useEffect(() => {
    getMonthlyTotals(month).then(d => setRate(d.savingsRate))
  }, [month])

  const isGood = rate >= 20
  const isOk = rate >= 10 && rate < 20
  const color = isGood ? '#10B981' : isOk ? '#F59E0B' : '#F43F5E'

  return (
    <Card padding="sm" className="flex flex-col justify-between">
      <div className="flex items-center gap-1.5 mb-2">
        <PiggyBank size={14} className="text-text-muted" />
        <span className="text-text-muted text-[10px] font-medium">Savings Rate</span>
      </div>
      <span className="text-2xl font-bold font-mono" style={{ color }}>
        {rate.toFixed(0)}%
      </span>
      <span className="text-text-muted text-[10px] mt-1">
        {isGood ? 'On track' : isOk ? 'Could improve' : 'Below target'}
      </span>
    </Card>
  )
}
