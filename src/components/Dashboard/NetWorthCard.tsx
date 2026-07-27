import { useLiveQuery } from 'dexie-react-hooks'
import { ShieldCheck } from 'lucide-react'
import { db } from '../../lib/db'
import { getAccountBalances } from '../../lib/analytics'
import { balanceTrust } from '../../lib/balance-trust'
import { Card } from '../shared/Card'
import { formatCurrency } from '../../lib/formatters'

export function NetWorthCard() {
  const balances = useLiveQuery(() => getAccountBalances())
  const uploads = useLiveQuery(() => db.uploads.toArray()) ?? []

  if (!balances || balances.length === 0) return null

  // Net worth is the sum of every account's signed contribution (the same
  // definition as computeNetWorth), so assets, debt, and the total can't drift
  // apart — an overdrawn asset simply counts as debt.
  let assets = 0
  let liabilities = 0

  for (const b of balances) {
    if (b.contribution < 0) liabilities += -b.contribution
    else assets += b.contribution
  }

  const netWorth = assets - liabilities
  const isPositive = netWorth >= 0

  // "Is this number real?" in one line: how many balances rest on a statement,
  // a verified check, or the user's own entry — vs. a $0 guess.
  const anchored = balances.filter(
    (b) => balanceTrust(b.account, uploads).level !== 'never_set'
  ).length
  const allAnchored = anchored === balances.length

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
      <p className={`flex items-center gap-1 mt-2 text-[10px] ${allAnchored ? 'text-income' : 'text-text-muted'}`}>
        <ShieldCheck size={10} />
        {allAnchored
          ? `All ${balances.length} balances anchored to real numbers`
          : `${anchored} of ${balances.length} balances anchored to real numbers`}
      </p>
    </Card>
  )
}
