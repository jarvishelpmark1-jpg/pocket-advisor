import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db'
import { Card } from '../shared/Card'
import { formatCurrency } from '../../lib/formatters'

export function NetWorthCard() {
  const accounts = useLiveQuery(() => db.accounts.toArray())

  if (!accounts || accounts.length === 0) return null

  let assets = 0
  let liabilities = 0

  for (const a of accounts) {
    if (a.type === 'credit' || a.type === 'loan') {
      liabilities += Math.abs(a.balance)
    } else {
      assets += a.balance
    }
  }

  const netWorth = assets - liabilities
  const isPositive = netWorth >= 0

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent/5 to-transparent rounded-bl-full" />
      <p className="text-text-muted text-xs font-medium mb-1">Net Worth</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold tracking-tight ${isPositive ? 'text-income' : 'text-expense'}`}>
          {formatCurrency(netWorth)}
        </span>
      </div>
      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-income" />
          <span className="text-text-muted text-[11px]">Assets</span>
          <span className="text-text-secondary text-[11px] font-mono">{formatCurrency(assets, true)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-expense" />
          <span className="text-text-muted text-[11px]">Debt</span>
          <span className="text-text-secondary text-[11px] font-mono">{formatCurrency(liabilities, true)}</span>
        </div>
      </div>
    </Card>
  )
}
