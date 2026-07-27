import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../../lib/db'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import type { Account } from '../../lib/types'

const isLiability = (type: Account['type']) => type === 'credit' || type === 'loan'

export function EditBalanceModal({
  account,
  currentBalance,
  open,
  onClose,
  onDelete,
}: {
  account: Account
  /** derived current balance, used as the default and to re-anchor */
  currentBalance: number
  open: boolean
  onClose: () => void
  onDelete: () => void
}) {
  const [balance, setBalance] = useState(currentBalance.toString())
  const [asOf, setAsOf] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const isManualAsset = account.type === 'manual_asset'

  const handleSave = async () => {
    const newBalance = parseFloat(balance)
    if (isNaN(newBalance)) return
    // Re-anchor: this balance is true as of `asOf`; transactions after it
    // move the derived current balance from here.
    const anchorDate = new Date(`${asOf}T00:00:00`)
    await db.accounts.update(account.id!, {
      anchorBalance: newBalance,
      anchorDate,
      anchorSource: 'manual',
      anchorVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={account.name}>
      <div className="space-y-4">
        <div>
          <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">
            {isManualAsset ? 'Value' : isLiability(account.type) ? 'Balance Owed' : 'Current Balance'}
          </label>
          <input
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-lg font-mono focus:border-accent focus:outline-none"
            type="number"
            step="0.01"
            inputMode="decimal"
            autoFocus
          />
        </div>

        <div>
          <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">
            As of
          </label>
          <input
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
            type="date"
          />
          <p className="text-text-muted text-[10px] mt-1.5 leading-relaxed">
            {isManualAsset
              ? 'When this value is true as of. Net-worth history uses it from this date forward.'
              : "Transactions dated after this move the balance automatically. Set it to a statement's closing date and amount to reconcile exactly."}
          </p>
        </div>

        <Button onClick={handleSave} fullWidth>
          Update Balance
        </Button>

        <Button variant="danger" onClick={onDelete} fullWidth icon={<Trash2 size={14} />}>
          Delete Account
        </Button>
      </div>
    </Modal>
  )
}
