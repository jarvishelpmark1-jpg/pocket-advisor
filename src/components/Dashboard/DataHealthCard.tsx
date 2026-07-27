import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { assessDataHealth, type AccountHealthIssue } from '../../lib/data-health'

function issueText(issue: AccountHealthIssue): { headline: string; detail: string; to: string } {
  const name = issue.account.name
  switch (issue.kind) {
    case 'no_balance':
      return {
        headline: `${name}: balance never set`,
        detail: "Its number is just imported activity stacked on $0 — nobody's told the app the real balance. Set it in Settings, or upload a PDF statement (those carry it).",
        to: '/settings',
      }
    case 'stale':
      return {
        headline: `${name}: ${issue.daysBehind} days behind`,
        detail: `Newest data is from ${format(issue.lastDataDate!, 'MMM d')}. Upload the statements since then.`,
        to: '/upload',
      }
    case 'gap':
      return {
        headline: `${name}: missing a stretch`,
        detail: `No data between ${format(issue.gapStart!, 'MMM d')} and ${format(issue.gapEnd!, 'MMM d')} — a statement in between likely didn't import.`,
        to: '/upload',
      }
  }
}

/**
 * Trust panel: net worth and insights are only as good as the data underneath.
 * When an account's balance was never anchored, its data is months old, or a
 * statement is missing from the middle, say so louder than the numbers.
 */
export function DataHealthCard() {
  const issues = useLiveQuery(() => assessDataHealth()) ?? []
  const navigate = useNavigate()

  if (issues.length === 0) return null

  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/5 overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <AlertTriangle size={14} className="text-warning" />
        <p className="text-warning text-xs font-semibold">
          These numbers can't be right yet
        </p>
      </div>
      <div className="px-2 pb-2">
        {issues.map((issue, i) => {
          const t = issueText(issue)
          return (
            <button
              key={i}
              onClick={() => navigate(t.to)}
              className="w-full flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-warning/10 transition-colors text-left"
            >
              <span
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ backgroundColor: issue.account.color }}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-text-primary text-xs font-medium">{t.headline}</span>
                <span className="block text-text-muted text-[11px] leading-snug mt-0.5">{t.detail}</span>
              </span>
              <ChevronRight size={14} className="text-text-muted flex-shrink-0 mt-1" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
