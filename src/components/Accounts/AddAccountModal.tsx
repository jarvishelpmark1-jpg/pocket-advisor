import { useState } from 'react'
import { db } from '../../lib/db'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import type { AccountType } from '../../lib/types'

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit Card' },
  { value: 'money_market', label: 'Money Market' },
  { value: 'investment', label: 'Investment' },
  { value: 'loan', label: 'Loan' },
]

const COLORS = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#A855F7', '#EC4899', '#06B6D4']

export function AddAccountModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')

  const reset = () => {
    setName('')
    setType('checking')
  }

  const handleSave = async () => {
    const accountName = name.trim() || `${ACCOUNT_TYPES.find(t => t.value === type)?.label ?? 'Account'}`
    await db.accounts.add({
      name: accountName,
      type,
      institution: '',
      balance: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    reset()
    onSave()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Account">
      <div className="space-y-4">
        <div>
          <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">
            Account Type
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {ACCOUNT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`px-2 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                  type === t.value
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'bg-bg-elevated text-text-muted border border-transparent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">
            Name <span className="text-text-muted/50">(optional)</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm focus:border-accent focus:outline-none"
            placeholder={`e.g. Chase ${ACCOUNT_TYPES.find(t => t.value === type)?.label ?? ''}`}
          />
        </div>

        <Button onClick={handleSave} fullWidth>
          Add Account
        </Button>
      </div>
    </Modal>
  )
}
