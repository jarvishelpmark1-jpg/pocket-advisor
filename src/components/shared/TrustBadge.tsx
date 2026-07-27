import { ShieldCheck, FileText, PenLine, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { balanceTrust } from '../../lib/balance-trust'
import type { Account, Upload } from '../../lib/types'

/**
 * One consistent vocabulary for "can I trust this number?" — shown next to a
 * balance wherever one appears.
 */
export function TrustBadge({ account, uploads }: { account: Account; uploads: Upload[] }) {
  const t = balanceTrust(account, uploads)

  switch (t.level) {
    case 'never_set':
      return (
        <span className="inline-flex items-center gap-1 text-warning text-[10px] font-medium">
          <AlertTriangle size={10} />
          Balance never set
        </span>
      )
    case 'verified':
      return (
        <span className="inline-flex items-center gap-1 text-income text-[10px] font-medium">
          <ShieldCheck size={10} />
          Verified · {format(t.asOf, 'MMM d')}
        </span>
      )
    case 'statement':
      return (
        <span className="inline-flex items-center gap-1 text-text-muted text-[10px]">
          <FileText size={10} />
          From statement · {format(t.asOf, 'MMM d')}
        </span>
      )
    case 'manual':
      return (
        <span className="inline-flex items-center gap-1 text-text-muted text-[10px]">
          <PenLine size={10} />
          Set by hand · {format(t.asOf, 'MMM d')}
        </span>
      )
  }
}
