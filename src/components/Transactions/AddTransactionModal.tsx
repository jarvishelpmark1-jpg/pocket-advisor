import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { db } from '../../lib/db'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import { CategoryGrid } from '../Review/CategoryGrid'
import { addManualTransaction } from '../../hooks/useTransactions'
import type { CategoryId } from '../../lib/types'

type Direction = 'expense' | 'income'

export function AddTransactionModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? []

  const [direction, setDirection] = useState<Direction>('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [accountId, setAccountId] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null)
  const [saving, setSaving] = useState(false)

  const resolvedAccountId = accountId ?? accounts[0]?.id ?? null
  const amountNum = parseFloat(amount)
  const canSave =
    !saving &&
    resolvedAccountId != null &&
    !isNaN(amountNum) &&
    amountNum > 0 &&
    description.trim().length > 0 &&
    categoryId != null

  const reset = () => {
    setDirection('expense')
    setAmount('')
    setDescription('')
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setAccountId(null)
    setCategoryId(null)
  }

  const handleSave = async () => {
    if (!canSave || resolvedAccountId == null || categoryId == null) return
    setSaving(true)
    try {
      const signed = direction === 'expense' ? -Math.abs(amountNum) : Math.abs(amountNum)
      await addManualTransaction({
        accountId: resolvedAccountId,
        date: new Date(`${date}T00:00:00`),
        description: description.trim(),
        amount: signed,
        categoryId,
      })
      reset()
      onAdded()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction">
      {accounts.length === 0 ? (
        <p className="text-text-muted text-sm py-4 text-center">
          Add an account in Settings first, then you can log transactions here.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Direction">
            {(['expense', 'income'] as Direction[]).map((d) => (
              <button
                key={d}
                role="radio"
                aria-checked={direction === d}
                onClick={() => { setDirection(d); setCategoryId(null) }}
                className={`py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                  direction === d
                    ? d === 'expense'
                      ? 'bg-expense/15 text-expense border border-expense/30'
                      : 'bg-income/15 text-income border border-income/30'
                    : 'bg-bg-elevated text-text-muted border border-transparent'
                }`}
              >
                {d === 'expense' ? 'Money out' : 'Money in'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block" htmlFor="manual-amount">
                Amount
              </label>
              <input
                id="manual-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-lg font-mono focus:border-accent focus:outline-none"
                placeholder="0.00"
                type="number"
                step="0.01"
                inputMode="decimal"
                autoFocus
              />
            </div>
            <div>
              <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block" htmlFor="manual-date">
                Date
              </label>
              <input
                id="manual-date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
                type="date"
                max={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
          </div>

          <div>
            <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block" htmlFor="manual-desc">
              Description
            </label>
            <input
              id="manual-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm focus:border-accent focus:outline-none"
              placeholder="e.g. Farmers market, cash"
            />
          </div>

          {accounts.length > 1 && (
            <div>
              <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">
                Account
              </label>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAccountId(a.id!)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                      resolvedAccountId === a.id
                        ? 'bg-accent/15 text-accent border border-accent/30'
                        : 'bg-bg-elevated text-text-muted border border-transparent'
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-2 block">
              Category
            </label>
            <CategoryGrid
              onSelect={setCategoryId}
              suggestedId={categoryId}
              showIncome={direction === 'income'}
            />
          </div>

          <Button onClick={handleSave} fullWidth disabled={!canSave}>
            {saving ? 'Adding…' : 'Add Transaction'}
          </Button>
        </div>
      )}
    </Modal>
  )
}
