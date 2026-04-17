import { useState, useEffect } from 'react'
import { getTopMerchants } from '../../lib/analytics'
import { formatCurrency } from '../../lib/formatters'
import { Card, CardHeader } from '../shared/Card'

export function TopMerchants({ month }: { month: string }) {
  const [data, setData] = useState<{ name: string; total: number; count: number }[]>([])

  useEffect(() => {
    getTopMerchants(month, 8).then(setData)
  }, [month])

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader title="Top Merchants" />
      <div className="space-y-2">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-text-muted text-[10px] font-mono w-4 text-right">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-xs truncate">{item.name}</p>
              <p className="text-text-muted text-[9px]">{item.count} transaction{item.count !== 1 ? 's' : ''}</p>
            </div>
            <span className="text-text-primary text-xs font-mono font-medium">{formatCurrency(item.total)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
