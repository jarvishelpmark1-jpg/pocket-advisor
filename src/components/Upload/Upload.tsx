import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, Clock, CheckCircle, Trash2, Plus, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import { db, clearAllData } from '../../lib/db'
import { suggestAccountForFilename } from '../../lib/account-match'
import { DropZone } from './DropZone'
import { ProcessingView } from './ProcessingView'
import { UploadResults, type CompletedUpload } from './UploadResults'
import { NextImportsCard } from './NextImportsCard'
import { Card } from '../shared/Card'
import { Button } from '../shared/Button'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import type { Account, AccountType, UploadResult } from '../../lib/types'

const COLORS = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#A855F7', '#EC4899', '#06B6D4']

// Types a guided "Import next" deep-link is allowed to preset (a debt must be
// created as a debt, not a checking asset). Anything else is ignored.
const PRESET_TYPES: AccountType[] = ['checking', 'savings', 'credit', 'loan']
const PRESET_TYPE_LABELS: Partial<Record<AccountType, string>> = {
  credit: 'credit card',
  loan: 'loan',
  savings: 'savings',
}

const NEW_ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit card' },
  { value: 'loan', label: 'Loan' },
]

type Phase = 'idle' | 'assign' | 'processing' | 'summary'

interface QueueItem {
  file: File
  account: Account | null
  result: UploadResult | null
  error: string | null
}

export function UploadPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [current, setCurrent] = useState(0)
  const [confirmClear, setConfirmClear] = useState(false)
  const { toast } = useToast()

  // Manual assets (house, vehicles, …) have no statements, so they're never
  // import targets — keep them out of the picker.
  const accounts = (useLiveQuery(() => db.accounts.toArray()) ?? []).filter((a) => a.type !== 'manual_asset')
  const allUploads = useLiveQuery(() => db.uploads.toArray()) ?? []
  const recentUploads = useLiveQuery(() => db.uploads.orderBy('uploadedAt').reverse().limit(10).toArray()) ?? []
  const txnCount = useLiveQuery(() => db.transactions.count()) ?? 0
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // A guided "Import next" link lands here pre-targeting a NEW account (the
  // coverage engine only ever suggests accounts that don't exist yet), with an
  // inferred type so a card/loan is created as a debt.
  const presetName = searchParams.get('new')?.trim() || ''
  const presetTypeRaw = searchParams.get('type')?.trim() as AccountType | null
  const presetType: AccountType =
    presetTypeRaw && PRESET_TYPES.includes(presetTypeRaw) ? presetTypeRaw : 'checking'
  const clearPreset = () => {
    if (presetName) setSearchParams({}, { replace: true })
  }

  const createAccount = async (name: string, type: AccountType): Promise<Account> => {
    const count = await db.accounts.count()
    const finalName = name.trim() || (count === 0 ? 'My Account' : `Account ${count + 1}`)
    const color = COLORS[count % COLORS.length]
    const now = new Date()
    const base = {
      name: finalName,
      type,
      institution: '',
      anchorBalance: 0,
      anchorDate: now,
      color,
      createdAt: now,
      updatedAt: now,
    }
    const id = await db.accounts.add(base)
    return { id: id as number, ...base }
  }

  // Move the queue pointer to `index`, entering whichever phase that item needs.
  const startItem = (q: QueueItem[], index: number) => {
    setQueue(q)
    if (index >= q.length) {
      setPhase(q.length > 0 ? 'summary' : 'idle')
      return
    }
    setCurrent(index)
    setPhase(q[index].account ? 'processing' : 'assign')
  }

  const handleFilesDrop = async (files: File[]) => {
    // A preset deep-link means "these statements belong to this new account" —
    // create it once and assign the whole batch to it.
    let preset: Account | null = null
    if (presetName) {
      preset = await createAccount(presetName, presetType)
      clearPreset()
    }
    const q = files.map((file) => ({ file, account: preset, result: null, error: null }))
    startItem(q, 0)
  }

  const handleAssign = (account: Account) => {
    const q = queue.map((it, i) => (i === current ? { ...it, account } : it))
    setQueue(q)
    setPhase('processing')
  }

  const handleSkipFile = () => {
    const q = queue.filter((_, i) => i !== current)
    startItem(q, current)
  }

  const handleComplete = (result: UploadResult) => {
    const q = queue.map((it, i) => (i === current ? { ...it, result } : it))
    startItem(q, current + 1)
  }

  const handleError = (message: string) => {
    const q = queue.map((it, i) => (i === current ? { ...it, error: message } : it))
    startItem(q, current + 1)
  }

  const handleReset = () => {
    setPhase('idle')
    setQueue([])
    setCurrent(0)
    clearPreset()
  }

  const handleClearAll = async () => {
    await clearAllData()
    handleReset()
    setConfirmClear(false)
    toast('All data cleared')
  }

  const currentItem = queue[current]
  const queueLabel = queue.length > 1 ? `File ${current + 1} of ${queue.length}` : undefined
  const completedItems: CompletedUpload[] = queue.map((it) => ({
    filename: it.file.name,
    accountName: it.account?.name ?? '',
    result: it.result,
    error: it.error,
  }))

  return (
    <div className="min-h-full pb-4">
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-text-primary text-lg font-bold">Upload Statements</h1>
            <p className="text-text-muted text-xs mt-0.5">PDF, CSV, OFX, or QFX — as many as you like</p>
          </div>
          {txnCount > 0 && phase === 'idle' && (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-expense text-[11px] font-medium bg-expense/10 active:scale-95 transition-transform"
              aria-label="Clear all data and start fresh"
            >
              <Trash2 size={12} />
              Start Fresh
            </button>
          )}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {phase === 'idle' && presetName && (
          <div className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5">
            <p className="text-text-secondary text-[11px]">
              New account:{' '}
              <span className="text-accent font-semibold">{presetName}</span>
              {presetType !== 'checking' && (
                <span className="text-text-muted"> · {PRESET_TYPE_LABELS[presetType]}</span>
              )}
            </p>
            <p className="text-text-muted text-[10px] mt-0.5">Drop its statements below to add it.</p>
          </div>
        )}

        {phase === 'idle' && <DropZone onFiles={handleFilesDrop} />}

        {phase === 'idle' && <NextImportsCard />}

        {phase === 'assign' && currentItem && (
          <AssignAccountCard
            file={currentItem.file}
            queueLabel={queueLabel}
            accounts={accounts}
            suggestedId={suggestAccountForFilename(currentItem.file.name, allUploads)}
            onSelect={handleAssign}
            onCreate={async (name, type) => handleAssign(await createAccount(name, type))}
            onSkip={handleSkipFile}
          />
        )}

        {phase === 'processing' && currentItem?.account && (
          <ProcessingView
            file={currentItem.file}
            accountId={currentItem.account.id!}
            queueLabel={queueLabel}
            onComplete={handleComplete}
            onError={handleError}
          />
        )}

        {phase === 'summary' && (
          <UploadResults
            items={completedItems}
            onReview={() => navigate('/review')}
            onDone={handleReset}
          />
        )}

        {recentUploads.length > 0 && phase === 'idle' && (
          <div>
            <h3 className="text-text-secondary text-xs font-medium mb-2 flex items-center gap-1.5">
              <Clock size={12} />
              Recent Uploads
            </h3>
            <div className="space-y-2">
              {recentUploads.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-border">
                  <FileText size={16} className="text-text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-xs truncate">{u.filename}</p>
                    <p className="text-text-muted text-[10px]">
                      {u.transactionCount} transactions · {format(u.uploadedAt, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <CheckCircle size={14} className="text-income flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClear}
        title="Start Fresh"
        message="This removes all accounts, transactions, uploads, and learned rules. You cannot undo this."
        confirmLabel="Clear Everything"
        variant="danger"
        onConfirm={handleClearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}

function AssignAccountCard({
  file,
  queueLabel,
  accounts,
  suggestedId,
  onSelect,
  onCreate,
  onSkip,
}: {
  file: File
  queueLabel?: string
  accounts: Account[]
  suggestedId: number | null
  onSelect: (account: Account) => void
  onCreate: (name: string, type: AccountType) => Promise<void>
  onSkip: () => void
}) {
  const [showForm, setShowForm] = useState(accounts.length === 0)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [creating, setCreating] = useState(false)

  // Suggested account first, so the common "12 months of the same account" dump
  // is one tap per file.
  const sorted = [...accounts].sort((a, b) => (a.id === suggestedId ? -1 : b.id === suggestedId ? 1 : 0))

  const handleCreate = async () => {
    if (creating) return
    setCreating(true)
    try {
      await onCreate(name, type)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card>
      <p className="text-text-primary text-sm font-medium">Which account is this statement for?</p>
      <p className="text-text-muted text-[10px] font-mono mt-1 mb-3 truncate">
        {queueLabel ? `${queueLabel} · ` : ''}{file.name}
      </p>

      {accounts.length > 0 && (
        <div className="space-y-2 mb-3">
          {sorted.map((a) => (
            <button
              key={a.id}
              onClick={() => onSelect(a)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-accent/40 hover:bg-bg-elevated transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: a.color + '20', color: a.color }}>
                {a.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-sm truncate">{a.name}</p>
                <p className="text-text-muted text-[10px]">{a.institution || a.type}</p>
              </div>
              {a.id === suggestedId && (
                <span className="flex items-center gap-1 text-accent text-[10px] font-medium flex-shrink-0">
                  <Sparkles size={10} />
                  Suggested
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {!showForm && accounts.length > 0 && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border hover:border-accent/40 transition-colors text-left text-text-secondary text-sm"
        >
          <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center">
            <Plus size={14} />
          </div>
          New account
        </button>
      )}

      {showForm && (
        <div className="space-y-3 p-3 rounded-xl bg-bg-elevated">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Account name (e.g. Chase Checking)"
            className="w-full px-3 py-2.5 rounded-lg bg-bg-card border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/50"
            autoFocus={accounts.length > 0}
          />
          <div className="flex gap-1.5 flex-wrap">
            {NEW_ACCOUNT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  type === t.value
                    ? 'bg-accent text-white'
                    : 'bg-bg-card text-text-secondary border border-border'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button onClick={handleCreate} disabled={creating} fullWidth>
            {creating ? 'Creating…' : 'Create & import here'}
          </Button>
        </div>
      )}

      <button
        onClick={onSkip}
        className="w-full text-center text-text-muted text-xs mt-3 py-1.5 hover:text-text-secondary transition-colors"
      >
        Skip this file
      </button>
    </Card>
  )
}
