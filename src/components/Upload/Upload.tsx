import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, Clock, CheckCircle, Trash2, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { db, clearAllData } from '../../lib/db'
import { parseStatementFile, importStatement } from '../../lib/upload-processor'
import { planImports, type ImportGroup, type ImportTarget } from '../../lib/upload-plan'
import { suggestedAccountName, type StatementIdentity } from '../../lib/statement-identify'
import { DropZone } from './DropZone'
import { ConfirmStep, type ConfirmEntry } from './ConfirmStep'
import { UploadResults, type CompletedUpload } from './UploadResults'
import { NextImportsCard } from './NextImportsCard'
import { Card } from '../shared/Card'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { ProgressBar } from '../shared/ProgressBar'
import { useToast } from '../../hooks/useToast'
import type { Account, AccountType } from '../../lib/types'

const COLORS = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#A855F7', '#EC4899', '#06B6D4']

// Types a guided "Import next" deep-link is allowed to preset (a debt must be
// created as a debt, not a checking asset). Anything else is ignored.
const PRESET_TYPES: AccountType[] = ['checking', 'savings', 'credit', 'loan']
const PRESET_TYPE_LABELS: Partial<Record<AccountType, string>> = {
  credit: 'credit card',
  loan: 'loan',
  savings: 'savings',
}

// drop → reading (parse every file, no DB writes) → confirm (one plain-English
// question per detected account) → importing → summary. Accounts are only
// created after their statement has parsed successfully AND the user confirmed
// — a failed or misread file can never leave a ghost account behind.
type Phase = 'idle' | 'reading' | 'confirm' | 'importing' | 'summary'

interface StepProgress {
  current: number
  total: number
  filename: string
  /** within-file percent (import phase only) */
  pct: number
}

export function UploadPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [entries, setEntries] = useState<Map<number, ConfirmEntry>>(new Map())
  const [failed, setFailed] = useState<{ filename: string; error: string }[]>([])
  const [groups, setGroups] = useState<ImportGroup[]>([])
  const [progress, setProgress] = useState<StepProgress | null>(null)
  const [completed, setCompleted] = useState<CompletedUpload[]>([])
  const [confirmClear, setConfirmClear] = useState(false)
  const { toast } = useToast()

  // Manual assets (house, vehicles, …) have no statements, so they're never
  // import targets — keep them out of matching and the picker.
  const accounts = (useLiveQuery(() => db.accounts.toArray()) ?? []).filter((a) => a.type !== 'manual_asset')
  const allUploads = useLiveQuery(() => db.uploads.toArray()) ?? []
  const recentUploads = useLiveQuery(() => db.uploads.orderBy('uploadedAt').reverse().limit(10).toArray()) ?? []
  const txnCount = useLiveQuery(() => db.transactions.count()) ?? 0
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // A guided "Import next" link lands here pre-targeting an account by name.
  // It only prefills what the dropped files can't say about themselves — the
  // files are still parsed and matched first, so tapping a suggestion for an
  // account that already exists routes to it instead of duplicating it.
  const presetName = searchParams.get('new')?.trim() || ''
  const presetTypeRaw = searchParams.get('type')?.trim() as AccountType | null
  const presetType: AccountType =
    presetTypeRaw && PRESET_TYPES.includes(presetTypeRaw) ? presetTypeRaw : 'checking'
  const clearPreset = () => {
    if (presetName) setSearchParams({}, { replace: true })
  }

  const createAccount = async (
    name: string,
    type: AccountType,
    identity: StatementIdentity
  ): Promise<Account> => {
    const count = await db.accounts.count()
    const finalName =
      name.trim() ||
      suggestedAccountName(identity) ||
      (count === 0 ? 'My Account' : `Account ${count + 1}`)
    const now = new Date()
    const base = {
      name: finalName,
      type,
      institution: identity.institution ?? '',
      lastFour: identity.lastFour ?? undefined,
      anchorBalance: 0,
      anchorDate: now,
      anchorSource: 'seed' as const,
      color: COLORS[count % COLORS.length],
      createdAt: now,
      updatedAt: now,
    }
    const id = await db.accounts.add(base)
    return { id: id as number, ...base }
  }

  const handleFilesDrop = async (files: File[]) => {
    setPhase('reading')
    const parsedEntries = new Map<number, ConfirmEntry>()
    const failures: { filename: string; error: string }[] = []

    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length, filename: files[i].name, pct: 0 })
      try {
        const parsed = await parseStatementFile(files[i])
        parsedEntries.set(i, { file: files[i], parsed })
      } catch (err) {
        failures.push({
          filename: files[i].name,
          error: err instanceof Error ? err.message : 'Could not read this file',
        })
      }
    }

    setEntries(parsedEntries)
    setFailed(failures)
    setProgress(null)

    const planEntries = [...parsedEntries.entries()].map(([key, e]) => ({ key, parsed: e.parsed }))
    const preset = presetName ? { name: presetName, type: presetType } : null
    clearPreset()

    if (planEntries.length === 0) {
      // Nothing parseable — go straight to the receipt so the errors are explained.
      setCompleted(failures.map((f) => ({ filename: f.filename, account: null, result: null, error: f.error })))
      setPhase('summary')
      return
    }

    setGroups(planImports(planEntries, accounts, allUploads, preset))
    setPhase('confirm')
  }

  const handleResolve = (key: string, target: ImportTarget) => {
    setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, target } : g)))
  }

  const handleSkipGroup = (key: string) => {
    setGroups((gs) => gs.filter((g) => g.key !== key))
  }

  const handleImportAll = async () => {
    const toImport = groups.filter((g) => g.target.kind !== 'unresolved')
    const totalFiles = toImport.reduce((s, g) => s + g.entryKeys.length, 0)
    setPhase('importing')

    const results: CompletedUpload[] = []
    let done = 0

    for (const group of toImport) {
      let account: Account | null = null
      let accountError: string | null = null
      try {
        if (group.target.kind === 'existing') {
          account = (await db.accounts.get(group.target.accountId)) ?? null
          if (!account) accountError = 'That account no longer exists.'
        } else if (group.target.kind === 'new') {
          account = await createAccount(group.target.name, group.target.type, group.identity)
        }
      } catch (err) {
        accountError = err instanceof Error ? err.message : 'Could not create the account'
      }

      for (const key of group.entryKeys) {
        const entry = entries.get(key)
        if (!entry) continue
        if (!account) {
          results.push({ filename: entry.parsed.filename, account: null, result: null, error: accountError ?? 'No account selected' })
          done++
          continue
        }
        setProgress({ current: done + 1, total: totalFiles, filename: entry.parsed.filename, pct: 0 })
        try {
          const result = await importStatement(entry.parsed, account.id!, (pct) =>
            setProgress({ current: done + 1, total: totalFiles, filename: entry.parsed.filename, pct })
          )
          results.push({ filename: entry.parsed.filename, account, result, error: null })
        } catch (err) {
          results.push({
            filename: entry.parsed.filename,
            account,
            result: null,
            error: err instanceof Error ? err.message : 'Import failed',
          })
        }
        done++
      }
    }

    for (const f of failed) {
      results.push({ filename: f.filename, account: null, result: null, error: f.error })
    }

    setCompleted(results)
    setProgress(null)
    setPhase('summary')
  }

  const handleReset = () => {
    setPhase('idle')
    setEntries(new Map())
    setFailed([])
    setGroups([])
    setProgress(null)
    setCompleted([])
    clearPreset()
  }

  const handleClearAll = async () => {
    await clearAllData()
    handleReset()
    setConfirmClear(false)
    toast('All data cleared')
  }

  const handleRejectedFiles = (names: string[]) => {
    const label = names.length === 1 ? `"${names[0]}"` : `${names.length} of those files`
    toast(
      `Can't read ${label} — statements need to be PDF, CSV, or OFX/QFX files. Your bank's website has them under Statements or Documents.`,
      'error'
    )
  }

  return (
    <div className="min-h-full pb-4">
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-text-primary text-lg font-bold">Upload Statements</h1>
            <p className="text-text-muted text-xs mt-0.5">
              Drop any statement — the app reads it and tells you what it found
            </p>
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
              Adding:{' '}
              <span className="text-accent font-semibold">{presetName}</span>
              {presetType !== 'checking' && (
                <span className="text-text-muted"> · {PRESET_TYPE_LABELS[presetType]}</span>
              )}
            </p>
            <p className="text-text-muted text-[10px] mt-0.5">Drop its statements below to add it.</p>
          </div>
        )}

        {phase === 'idle' && <DropZone onFiles={handleFilesDrop} onRejected={handleRejectedFiles} />}

        {phase === 'idle' && <NextImportsCard />}

        {(phase === 'reading' || phase === 'importing') && progress && (
          <Card className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4"
            >
              <Loader2 size={24} className="text-accent" />
            </motion.div>
            <p className="text-text-primary text-sm font-medium mb-1">
              {phase === 'reading' ? 'Reading your statements' : 'Importing'}
            </p>
            <p className="text-text-muted text-xs mb-4">
              {phase === 'reading'
                ? 'Nothing is saved yet — you confirm first'
                : 'Sorting and categorizing transactions'}
            </p>
            <ProgressBar
              value={((progress.current - 1 + progress.pct / 100) / progress.total) * 100}
              color="#6366F1"
              height={4}
            />
            <p className="text-text-muted text-[10px] font-mono mt-2">
              {progress.total > 1 ? `File ${progress.current} of ${progress.total} · ` : ''}
              {progress.filename}
            </p>
          </Card>
        )}

        {phase === 'confirm' && (
          <ConfirmStep
            groups={groups}
            entriesByKey={entries}
            accounts={accounts}
            failed={failed}
            onResolve={handleResolve}
            onSkip={handleSkipGroup}
            onImport={handleImportAll}
            onCancel={handleReset}
          />
        )}

        {phase === 'summary' && (
          <UploadResults
            items={completed}
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
                      {u.transactionCount} transactions
                      {u.periodStart && u.periodEnd
                        ? ` · covers ${format(u.periodStart, 'MMM d')} – ${format(u.periodEnd, 'MMM d, yyyy')}`
                        : ` · ${format(u.uploadedAt, 'MMM d, yyyy')}`}
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
