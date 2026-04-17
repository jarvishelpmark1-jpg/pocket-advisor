import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { db } from '../../lib/db'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import type { Account } from '../../lib/types'

export function EditBalanceModal({
  account,
  open,
  onClose,
  onDelete,
}: {
  account: Account
  open: boolean
  onClose: () => void
  onDelete: () => void
}) {
  const [balance, setBalance] = useState(account.balance.toString())

  const handleSave = async () => {
    const newBalance = parseFloat(balance)
    if (isNaN(newBalance)) return
    await db.accounts.update(account.id!, {
      balance: newBalance,
      updatedAt: new Date(),
    })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={account.name}>
      <div className="space-y-4">
        <div>
          <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">
            Current Balance
          </label>
          <input
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-lg font-mono focus:border-accent focus:outline-none"
            type="number"
            step="0.01"
            autoFocus
          />
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
