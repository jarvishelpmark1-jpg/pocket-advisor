import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { db } from '../../lib/db'
import { suggestSpokeImports } from '../../lib/import-suggestions'
import { formatCurrency } from '../../lib/formatters'
import { Card } from '../shared/Card'

export function NextImportsCard() {
  const navigate = useNavigate()
  const suggestions = useLiveQuery(async () => {
    const [txns, accounts] = await Promise.all([db.transactions.toArray(), db.accounts.toArray()])
    const labels = accounts.flatMap((a) => [a.name, a.institution].filter(Boolean) as string[])
    return suggestSpokeImports(txns, labels)
  })

  if (!suggestions || suggestions.length === 0) return null

  return (
    <Card>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={14} className="text-accent" />
        <h3 className="text-text-primary text-sm font-semibold">Complete your picture</h3>
      </div>
      <p className="text-text-muted text-[11px] mb-3">
        Money is flowing out to these — import their statements next so every dollar is accounted for.
      </p>
      <div className="space-y-2">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => navigate(`/upload?new=${encodeURIComponent(s.label)}&type=${s.type}`)}
            className="w-full flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
          >
            <div className="w-8 h-8 rounded-lg bg-expense/10 text-expense flex items-center justify-center flex-shrink-0">
              <ArrowUpRight size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-xs font-medium truncate">{s.label}</p>
              <p className="text-text-muted text-[10px]">{s.count} payment{s.count !== 1 ? 's' : ''} seen</p>
            </div>
            <span className="text-text-secondary text-xs font-mono flex-shrink-0">{formatCurrency(s.total, true)}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}
