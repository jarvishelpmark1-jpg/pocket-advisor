import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Sun, Moon, Monitor, Plus, Wallet, CreditCard, PiggyBank,
  TrendingUp, Building, Download, Upload, Trash2, ChevronRight,
  Database, Palette, DollarSign, Shield,
} from 'lucide-react'
import { db, clearAllData } from '../../lib/db'
import { useTheme } from '../../hooks/useTheme'
import { getSettings, saveSettings } from '../../lib/settings'
import { exportBackup, importBackup, exportTransactionsCSV, downloadFile } from '../../lib/backup'
import { formatCurrency } from '../../lib/formatters'
import { CATEGORIES } from '../../lib/categories'
import { Card } from '../shared/Card'
import { Button } from '../shared/Button'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import { AddAccountModal } from '../Accounts/AddAccountModal'
import { EditBalanceModal } from '../Accounts/EditBalanceModal'
import type { Account, AccountType, CategoryId } from '../../lib/types'

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

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [showBudgets, setShowBudgets] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; count: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? []
  const txnCount = useLiveQuery(() => db.transactions.count()) ?? 0
  const ruleCount = useLiveQuery(() => db.userRules.count()) ?? 0

  const handleDeleteAccount = async (id: number) => {
    const count = await db.transactions.where('accountId').equals(id).count()
    if (count > 0) {
      setConfirmDelete({ id, count })
    } else {
      await db.accounts.delete(id)
      setEditingAccount(null)
      toast('Account deleted')
    }
  }

  const handleExportBackup = async () => {
    const json = await exportBackup()
    downloadFile(json, `pocket-advisor-backup-${new Date().toISOString().split('T')[0]}.json`, 'application/json')
    toast('Backup downloaded')
  }

  const handleExportCSV = async () => {
    const csv = await exportTransactionsCSV()
    downloadFile(csv, `transactions-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv')
    toast('CSV exported')
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const result = await importBackup(text)
      toast(`Restored ${result.accounts} accounts and ${result.transactions} transactions`)
    } catch {
      toast('Import failed — invalid backup file', 'error')
    }
    e.target.value = ''
  }

  const handleClearAll = async () => {
    await clearAllData()
    setConfirmClear(false)
    toast('All data cleared')
  }

  return (
    <div className="min-h-full pb-4">
      <div className="px-4 pt-14 pb-4">
        <h1 className="text-text-primary text-lg font-bold">Settings</h1>
        <p className="text-text-muted text-xs mt-0.5">Customize your experience</p>
      </div>

      <div className="px-4 space-y-6">
        <Section icon={<Palette size={16} />} title="Appearance">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
            {([
              { value: 'light' as const, icon: Sun, label: 'Light' },
              { value: 'dark' as const, icon: Moon, label: 'Dark' },
              { value: 'system' as const, icon: Monitor, label: 'System' },
            ]).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                role="radio"
                aria-checked={theme === value}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors ${
                  theme === value
                    ? 'bg-accent/15 border border-accent/30 text-accent'
                    : 'bg-bg-elevated border border-transparent text-text-muted'
                }`}
              >
                <Icon size={18} />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section icon={<Wallet size={16} />} title="Accounts">
          {accounts.length === 0 ? (
            <p className="text-text-muted text-xs py-2">No accounts yet</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((account) => {
                const Icon = TYPE_ICONS[account.type]
                return (
                  <button
                    key={account.id}
                    onClick={() => setEditingAccount(account)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-bg-elevated transition-colors text-left"
                    aria-label={`${account.name}, ${TYPE_LABELS[account.type]}, ${formatCurrency(Math.abs(account.balance))}`}
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: account.color + '15', color: account.color }}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary text-sm font-medium">{account.name}</p>
                      <p className="text-text-muted text-[10px]">{TYPE_LABELS[account.type]}</p>
                    </div>
                    <span className="text-text-secondary text-sm font-mono">
                      {formatCurrency(Math.abs(account.balance))}
                    </span>
                    <ChevronRight size={14} className="text-text-muted" />
                  </button>
                )
              })}
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAddAccount(true)}
            icon={<Plus size={14} />}
            className="mt-2"
            fullWidth
          >
            Add Account
          </Button>
        </Section>

        <Section icon={<DollarSign size={16} />} title="Monthly Budget">
          <BudgetSection show={showBudgets} onToggle={() => setShowBudgets(!showBudgets)} onSave={() => toast('Budget saved')} />
        </Section>

        <Section icon={<Database size={16} />} title="Data">
          <div className="space-y-2">
            <p className="text-text-muted text-[11px]">
              {txnCount} transactions · {accounts.length} accounts · {ruleCount} learned rules
            </p>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={handleExportBackup} icon={<Download size={14} />}>
                Backup
              </Button>
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} icon={<Upload size={14} />}>
                Restore
              </Button>
            </div>

            <Button variant="secondary" size="sm" onClick={handleExportCSV} icon={<Download size={14} />} fullWidth>
              Export CSV
            </Button>

            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" aria-label="Import backup file" />
          </div>
        </Section>

        <Section icon={<Shield size={16} />} title="About">
          <div className="space-y-1.5">
            <p className="text-text-muted text-xs">Pocket Advisor v1.0.0</p>
            <p className="text-text-muted text-xs">
              Your data stays on this device. Nothing is sent to any server.
            </p>
          </div>
        </Section>

        <div className="pt-4 border-t border-border">
          <button
            onClick={() => setConfirmClear(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-expense/10 border border-expense/20 text-expense text-sm font-medium active:scale-[0.98] transition-transform"
          >
            <Trash2 size={16} />
            Clear All Data
          </button>
        </div>
      </div>

      <AddAccountModal open={showAddAccount} onClose={() => setShowAddAccount(false)} onSave={() => { setShowAddAccount(false); toast('Account added') }} />

      {editingAccount && (
        <EditBalanceModal
          account={editingAccount}
          open={!!editingAccount}
          onClose={() => setEditingAccount(null)}
          onDelete={() => handleDeleteAccount(editingAccount.id!)}
        />
      )}

      <ConfirmDialog
        open={confirmClear}
        title="Clear All Data"
        message="This permanently removes every account, transaction, upload, and learned rule. This cannot be undone."
        confirmLabel="Clear Everything"
        variant="danger"
        onConfirm={handleClearAll}
        onCancel={() => setConfirmClear(false)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Account"
        message={`This account has ${confirmDelete?.count ?? 0} transactions. They will be deleted too.`}
        confirmLabel="Delete Account"
        variant="danger"
        onConfirm={async () => {
          if (confirmDelete) {
            await db.transactions.where('accountId').equals(confirmDelete.id).delete()
            await db.accounts.delete(confirmDelete.id)
            setConfirmDelete(null)
            setEditingAccount(null)
            toast('Account and transactions deleted')
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-text-muted">{icon}</span>
        <h2 className="text-text-primary text-sm font-semibold">{title}</h2>
      </div>
      <Card padding="sm">{children}</Card>
    </section>
  )
}

function BudgetSection({ show, onToggle, onSave }: { show: boolean; onToggle: () => void; onSave: () => void }) {
  const settings = getSettings()
  const [monthlyBudget, setMonthlyBudget] = useState(settings.monthlyBudget.toString())
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>(() => {
    const b: Record<string, string> = {}
    for (const [k, v] of Object.entries(settings.budgets)) {
      if (v) b[k] = v.toString()
    }
    return b
  })

  const expenseCategories = CATEGORIES.filter(c => c.group === 'needs' || c.group === 'wants')

  const handleSave = () => {
    const budgets: Partial<Record<CategoryId, number>> = {}
    for (const [k, v] of Object.entries(categoryBudgets)) {
      const num = parseFloat(v)
      if (!isNaN(num) && num > 0) budgets[k as CategoryId] = num
    }
    saveSettings({
      monthlyBudget: parseFloat(monthlyBudget) || 0,
      budgets,
    })
    onSave()
  }

  return (
    <div>
      <div className="mb-3">
        <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1 block" htmlFor="monthly-budget">
          Total Monthly Budget
        </label>
        <input
          id="monthly-budget"
          value={monthlyBudget}
          onChange={(e) => setMonthlyBudget(e.target.value)}
          onBlur={handleSave}
          className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2 text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
          placeholder="0.00"
          type="number"
          step="100"
          inputMode="decimal"
        />
      </div>

      <button
        onClick={onToggle}
        className="text-accent text-xs font-medium mb-2"
        aria-expanded={show}
      >
        {show ? 'Hide' : 'Set'} category budgets
      </button>

      {show && (
        <div className="space-y-2 mt-2 max-h-64 overflow-y-auto" role="list">
          {expenseCategories.map((cat) => (
            <div key={cat.id} className="flex items-center gap-2" role="listitem">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: cat.color }}
                aria-hidden="true"
              />
              <label htmlFor={`budget-${cat.id}`} className="text-text-secondary text-xs flex-1 truncate">{cat.name}</label>
              <input
                id={`budget-${cat.id}`}
                value={categoryBudgets[cat.id] || ''}
                onChange={(e) => setCategoryBudgets(prev => ({ ...prev, [cat.id]: e.target.value }))}
                onBlur={handleSave}
                className="w-20 bg-bg-elevated border border-border rounded-lg px-2 py-1 text-text-primary text-xs font-mono text-right focus:border-accent focus:outline-none"
                placeholder="—"
                type="number"
                step="10"
                inputMode="decimal"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
