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
  const [institution, setInstitution] = useState('')
  const [lastFour, setLastFour] = useState('')
  const [balance, setBalance] = useState('')
  const [color, setColor] = useState(COLORS[0])

  const reset = () => {
    setName('')
    setType('checking')
    setInstitution('')
    setLastFour('')
    setBalance('')
    setColor(COLORS[Math.floor(Math.random() * COLORS.length)])
  }

  const handleSave = async () => {
    if (!name.trim()) return
    await db.accounts.add({
      name: name.trim(),
      type,
      institution: institution.trim(),
      lastFour: lastFour.trim() || undefined,
      balance: parseFloat(balance) || 0,
      color,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    reset()
    onSave()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Account">
      <div className="space-y-4">
        <Field label="Account Name" placeholder="e.g. Chase Checking">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm focus:border-accent focus:outline-none"
            placeholder="e.g. Chase Checking"
          />
        </Field>

        <Field label="Account Type">
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
        </Field>

        <Field label="Institution" placeholder="e.g. Chase, Bank of America">
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm focus:border-accent focus:outline-none"
            placeholder="e.g. Chase"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Last 4 Digits">
            <input
              value={lastFour}
              onChange={(e) => setLastFour(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
              placeholder="1234"
              maxLength={4}
            />
          </Field>
          <Field label="Current Balance">
            <input
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
              placeholder="0.00"
              type="number"
              step="0.01"
            />
          </Field>
        </div>

        <Field label="Color">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'scale-110 ring-2 ring-white/20' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>

        <Button onClick={handleSave} fullWidth disabled={!name.trim()}>
          Add Account
        </Button>
      </div>
    </Modal>
  )
}

function Field({ label, children, placeholder }: { label: string; children: React.ReactNode; placeholder?: string }) {
  return (
    <div>
      <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  )
}
