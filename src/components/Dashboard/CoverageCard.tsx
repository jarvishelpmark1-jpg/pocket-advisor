import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ArrowUpRight } from 'lucide-react'
import { db } from '../../lib/db'
import { analyzeCoverage } from '../../lib/import-suggestions'
import { formatCurrency } from '../../lib/formatters'
import { Card } from '../shared/Card'

/**
 * The trust meter for net worth: how much of the user's money movement is fully
 * accounted for, plus a one-tap "import this next" toward 100%. All math comes
 * straight from analyzeCoverage — this card never recomputes, so the % and the
 * dollar line can't drift from the engine.
 */
export function CoverageCard() {
  const navigate = useNavigate()

  const data = useLiveQuery(async () => {
    const [txns, accounts] = await Promise.all([db.transactions.toArray(), db.accounts.toArray()])
    const labels = accounts.flatMap(
      (a) => [a.name, a.institution, a.lastFour ? `••${a.lastFour}` : null].filter(Boolean) as string[]
    )
    return analyzeCoverage(txns, labels)
  })

  if (!data) return null

  const total = data.tracedTotal + data.untracedTotal
  if (total === 0) return null // no outflow yet — nothing to trace

  const fullyTraced = data.untracedTotal === 0
  const top = data.suggestions[0]

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <p className="text-text-muted text-xs font-medium">Coverage</p>
        <ShieldCheck size={14} className={fullyTraced ? 'text-income' : 'text-text-muted'} />
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-bold tracking-tight ${fullyTraced ? 'text-income' : 'text-text-primary'}`}>
          {data.coveragePct}%
        </span>
        <span className="text-text-muted text-[11px]">accounted for</span>
      </div>

      <p className="text-text-secondary text-[11px] font-mono mt-0.5">
        {formatCurrency(data.tracedTotal, true)} of {formatCurrency(total, true)} traced
      </p>

      <div className="h-1.5 rounded-full bg-bg-elevated mt-3 overflow-hidden">
        <div className="h-full rounded-full bg-income" style={{ width: `${data.coveragePct}%` }} />
      </div>

      {fullyTraced ? (
        <p className="text-income text-[11px] font-medium mt-3 flex items-center gap-1.5">
          <ShieldCheck size={13} />
          All money traced
        </p>
      ) : top ? (
        <button
          onClick={() => navigate(`/upload?new=${encodeURIComponent(top.label)}&type=${top.type}`)}
          className="w-full mt-3 flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-accent/10 text-accent active:scale-[0.98] transition-transform"
        >
          <span className="text-xs font-semibold truncate">Import next: {top.label}</span>
          <ArrowUpRight size={15} className="flex-shrink-0" />
        </button>
      ) : (
        <p className="text-text-muted text-[11px] mt-3">
          {formatCurrency(data.untracedTotal, true)} is flowing to accounts you haven't added yet.
        </p>
      )}
    </Card>
  )
}
