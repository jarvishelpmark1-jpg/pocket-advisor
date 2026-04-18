import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Wallet, CreditCard, PiggyBank, TrendingUp, Building, Trash2 } from 'lucide-react'
import { db, clearAllData } from '../../lib/db'
import { formatCurrency } from '../../lib/formatters'
import { Card } from '../shared/Card'
import { Button } from '../shared/Button'
import { EmptyState } from '../shared/EmptyState'
import { AddAccountModal } from './AddAccountModal'
import { EditBalanceModal } from './EditBalanceModal'
import type { Account, AccountType } from '../../lib/types'

const TYPE_ICONS: Record<AccountType, typeof Wallet> = {
  checking: Wallet,
  savings: PiggyBank,
  credit: CreditCard,
  money_market: Building,
  investment: TrendingUp,
  loan: CreditCard,
}

const TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit Card',
  money_market: 'Money Market',
  investment: 'Investment',
  loan: 'Loan',
}

export function AccountsPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? []

  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    const group = a.type === 'credit' || a.type === 'loan' ? 'liabilities' : 'assets'
    if (!acc[group]) acc[group] = []
    acc[group].push(a)
    return acc
  }, {})

  const totalAssets = (grouped['assets'] || []).reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = (grouped['liabilities'] || []).reduce((s, a) => s + Math.abs(a.balance), 0)

  const deleteAccount = async (id: number) => {
    const txnCount = await db.transactions.where('accountId').equals(id).count()
    if (txnCount > 0) {
      if (!confirm(`This account has ${txnCount} transactions. Delete them too?`)) return
      await db.transactions.where('accountId').equals(id).delete()
    }
    await db.accounts.delete(id)
  }

  return (
    <div className="min-h-full pb-4">
      <div className="px-4 pt-14 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-text-primary text-lg font-bold">Accounts</h1>
          <p className="text-text-muted text-xs mt-0.5">Manage your financial accounts</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} icon={<Plus size={14} />}>
          Add
        </Button>
      </div>

      <div className="px-4 space-y-4">
        {accounts.length === 0 ? (
          <EmptyState
            icon={<Wallet size={28} />}
            title="No Accounts"
            description="Add your first account to start tracking your finances."
            action={
              <Button onClick={() => setShowAdd(true)} icon={<Plus size={14} />}>
                Add Account
              </Button>
            }
          />
        ) : (
          <>
            {accounts.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                <Card padding="sm">
                  <p className="text-text-muted text-[10px] mb-1">Total Assets</p>
                  <span className="text-income font-bold text-lg font-mono">{formatCurrency(totalAssets, true)}</span>
                </Card>
                <Card padding="sm">
                  <p className="text-text-muted text-[10px] mb-1">Total Debt</p>
                  <span className="text-expense font-bold text-lg font-mono">{formatCurrency(totalLiabilities, true)}</span>
                </Card>
              </div>
            )}

            {['assets', 'liabilities'].map((group) => {
              const items = grouped[group]
              if (!items?.length) return null

              return (
                <div key={group}>
                  <h3 className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">
                    {group === 'assets' ? 'Assets' : 'Liabilities'}
                  </h3>
                  <div className="space-y-2">
                    {items.map((account) => {
                      const Icon = TYPE_ICONS[account.type]
                      return (
                        <Card
                          key={account.id}
                          padding="sm"
                          onClick={() => setEditingAccount(account)}
                          className="flex items-center gap-3"
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: account.color + '15', color: account.color }}
                          >
                            <Icon size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-text-primary text-sm font-medium">{account.name}</p>
                            <p className="text-text-muted text-[10px]">
                              {account.institution} · {TYPE_LABELS[account.type]}
                              {account.lastFour ? ` ····${account.lastFour}` : ''}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`text-sm font-mono font-semibold ${
                              group === 'liabilities' ? 'text-expense' : 'text-text-primary'
                            }`}>
                              {formatCurrency(Math.abs(account.balance))}
                            </span>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </>
        )}

        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="text-text-muted text-[10px] font-semibold uppercase tracking-wider mb-2">
            Danger Zone
          </h3>
          <button
            onClick={async () => {
              if (!confirm('Delete ALL data? This removes every account, transaction, upload, and learned rule. This cannot be undone.')) return
              if (!confirm('Are you absolutely sure? All data will be permanently erased.')) return
              await clearAllData()
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium active:scale-[0.98] transition-transform"
          >
            <Trash2 size={16} />
            Clear All Data
          </button>
        </div>
      </div>

      <AddAccountModal open={showAdd} onClose={() => setShowAdd(false)} onSave={() => setShowAdd(false)} />

      {editingAccount && (
        <EditBalanceModal
          account={editingAccount}
          open={!!editingAccount}
          onClose={() => setEditingAccount(null)}
          onDelete={() => {
            deleteAccount(editingAccount.id!)
            setEditingAccount(null)
          }}
        />
      )}
    </div>
  )
}
