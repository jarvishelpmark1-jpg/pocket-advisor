import { useState } from 'react'
import { FileText, Plus, Sparkles, XCircle, CheckCircle2, HelpCircle } from 'lucide-react'
import { format } from 'date-fns'
import { Card } from '../shared/Card'
import { Button } from '../shared/Button'
import { identityTypeLabel } from '../../lib/statement-identify'
import type { ImportGroup, ImportTarget } from '../../lib/upload-plan'
import type { ParsedStatementFile } from '../../lib/upload-processor'
import type { Account, AccountType } from '../../lib/types'

const NEW_ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit', label: 'Credit card' },
  { value: 'loan', label: 'Loan' },
]

const MATCH_REASON_LABELS = {
  fingerprint: 'matched by account number',
  institution: 'matched by bank name',
  filename: 'matched by file name',
} as const

export interface ConfirmEntry {
  file: File
  parsed: ParsedStatementFile
}

function describePeriod(parsed: ParsedStatementFile): string {
  const n = `${parsed.transactions.length} transaction${parsed.transactions.length !== 1 ? 's' : ''}`
  if (!parsed.periodStart || !parsed.periodEnd) return n
  return `${n} · ${format(parsed.periodStart, 'MMM d')} – ${format(parsed.periodEnd, 'MMM d, yyyy')}`
}

function FileRow({ entry }: { entry: ConfirmEntry }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <FileText size={13} className="text-text-muted flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-text-secondary text-[11px] truncate">{entry.parsed.filename}</p>
        <p className="text-text-muted text-[10px]">{describePeriod(entry.parsed)}</p>
      </div>
    </div>
  )
}

/** Rows of existing accounts to pick from, plus an inline "new account" form. */
function AccountPicker({
  accounts,
  proposedName,
  proposedType,
  onPick,
  onCreateNew,
}: {
  accounts: Account[]
  proposedName: string
  proposedType: AccountType
  onPick: (accountId: number) => void
  onCreateNew: () => void
}) {
  return (
    <div className="space-y-2 mt-2">
      {accounts.map((a) => (
        <button
          key={a.id}
          onClick={() => onPick(a.id!)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-accent/40 hover:bg-bg-elevated transition-colors text-left"
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: a.color + '20', color: a.color }}
          >
            {a.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-primary text-sm truncate">{a.name}</p>
            <p className="text-text-muted text-[10px]">
              {[a.institution || null, a.lastFour ? `••${a.lastFour}` : null].filter(Boolean).join(' ') || a.type}
            </p>
          </div>
        </button>
      ))}
      <button
        onClick={onCreateNew}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border hover:border-accent/40 transition-colors text-left text-text-secondary text-sm"
      >
        <div className="w-8 h-8 rounded-lg bg-bg-elevated flex items-center justify-center">
          <Plus size={14} />
        </div>
        {proposedName ? `New account: ${proposedName}` : 'New account'}
        <span className="sr-only">{proposedType}</span>
      </button>
    </div>
  )
}

function NewAccountEditor({
  name,
  type,
  onChange,
}: {
  name: string
  type: AccountType
  onChange: (name: string, type: AccountType) => void
}) {
  return (
    <div className="space-y-2.5 mt-2">
      <input
        type="text"
        value={name}
        onChange={(e) => onChange(e.target.value, type)}
        placeholder="Account name (e.g. Chase Checking)"
        className="w-full px-3 py-2.5 rounded-lg bg-bg-card border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/50"
        aria-label="New account name"
      />
      <div className="flex gap-1.5 flex-wrap">
        {NEW_ACCOUNT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange(name, t.value)}
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
    </div>
  )
}

function GroupCard({
  group,
  entries,
  accounts,
  onResolve,
  onSkip,
}: {
  group: ImportGroup
  entries: ConfirmEntry[]
  accounts: Account[]
  onResolve: (target: ImportTarget) => void
  onSkip: () => void
}) {
  const [picking, setPicking] = useState(group.target.kind === 'unresolved')
  const target = group.target
  const plural = entries.length !== 1

  let headline: React.ReactNode
  if (target.kind === 'existing') {
    const account = accounts.find((a) => a.id === target.accountId)
    headline = (
      <div className="flex items-start gap-2.5">
        <CheckCircle2 size={16} className="text-income flex-shrink-0 mt-0.5" />
        <p className="text-text-primary text-sm">
          {plural ? 'These look like statements' : 'This looks like a statement'} for{' '}
          <strong>{account?.name}</strong>
          <span className="text-text-muted text-[11px]"> · {MATCH_REASON_LABELS[target.reason]}</span>
        </p>
      </div>
    )
  } else if (target.kind === 'new') {
    const { identity } = group
    const noun = identity.institution
      ? `${identity.institution}${identity.accountType ? ` ${identityTypeLabel(identity.accountType)}` : ' account'}`
      : identity.accountType
        ? identityTypeLabel(identity.accountType)
        : 'account'
    const description = `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`
    headline = (
      <div className="flex items-start gap-2.5">
        <Sparkles size={16} className="text-accent flex-shrink-0 mt-0.5" />
        <p className="text-text-primary text-sm">
          {plural ? 'These look like statements' : 'This looks like a statement'} for {description}
          {identity.lastFour && (
            <span> ending in <strong>••{identity.lastFour}</strong></span>
          )}
          {' '}you haven't added yet.
        </p>
      </div>
    )
  } else {
    headline = (
      <div className="flex items-start gap-2.5">
        <HelpCircle size={16} className="text-warning flex-shrink-0 mt-0.5" />
        <p className="text-text-primary text-sm">
          Which account {plural ? 'do these belong' : 'does this belong'} to? The file
          {plural ? 's don’t' : ' doesn’t'} say.
        </p>
      </div>
    )
  }

  return (
    <Card>
      {headline}

      <div className="mt-2 pl-1">
        {entries.map((e, i) => (
          <FileRow key={i} entry={e} />
        ))}
      </div>

      {target.kind === 'new' && !picking && (
        <>
          <NewAccountEditor
            name={target.name}
            type={target.type}
            onChange={(name, type) => onResolve({ kind: 'new', name, type })}
          />
          {accounts.length > 0 && (
            <button
              onClick={() => setPicking(true)}
              className="text-accent text-[11px] font-medium mt-2.5"
            >
              It's one of my existing accounts →
            </button>
          )}
        </>
      )}

      {(picking || target.kind === 'unresolved') && (
        <AccountPicker
          accounts={accounts}
          proposedName={target.kind === 'new' ? target.name : ''}
          proposedType={target.kind === 'new' ? target.type : 'checking'}
          onPick={(accountId) => {
            onResolve({ kind: 'existing', accountId, reason: 'filename' })
            setPicking(false)
          }}
          onCreateNew={() => {
            onResolve({
              kind: 'new',
              name: target.kind === 'new' ? target.name : '',
              type: target.kind === 'new' ? target.type : group.identity.accountType ?? 'checking',
            })
            setPicking(false)
          }}
        />
      )}

      {target.kind === 'existing' && !picking && (
        <button
          onClick={() => setPicking(true)}
          className="text-accent text-[11px] font-medium mt-2.5"
        >
          Different account…
        </button>
      )}
      {target.kind === 'existing' && picking && (
        <AccountPicker
          accounts={accounts}
          proposedName=""
          proposedType="checking"
          onPick={(accountId) => {
            onResolve({ kind: 'existing', accountId, reason: 'filename' })
            setPicking(false)
          }}
          onCreateNew={() => {
            onResolve({ kind: 'new', name: '', type: group.identity.accountType ?? 'checking' })
            setPicking(false)
          }}
        />
      )}

      <button
        onClick={onSkip}
        className="w-full text-center text-text-muted text-[11px] mt-3 py-1 hover:text-text-secondary transition-colors"
      >
        Don't import {plural ? 'these files' : 'this file'}
      </button>
    </Card>
  )
}

/**
 * The one screen between "dropped files" and "imported": every file has been
 * read already, so the app states what it found and the user only confirms.
 */
export function ConfirmStep({
  groups,
  entriesByKey,
  accounts,
  failed,
  onResolve,
  onSkip,
  onImport,
  onCancel,
}: {
  groups: ImportGroup[]
  entriesByKey: Map<number, ConfirmEntry>
  accounts: Account[]
  failed: { filename: string; error: string }[]
  onResolve: (groupKey: string, target: ImportTarget) => void
  onSkip: (groupKey: string) => void
  onImport: () => void
  onCancel: () => void
}) {
  const fileCount = groups.reduce((s, g) => s + g.entryKeys.length, 0)
  const unresolved = groups.filter((g) => g.target.kind === 'unresolved').length
  const canImport = fileCount > 0 && unresolved === 0

  return (
    <div className="space-y-3">
      {failed.length > 0 && (
        <Card padding="sm">
          {failed.map((f, i) => (
            <div key={i} className="flex items-start gap-2.5 py-1.5">
              <XCircle size={14} className="text-expense flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-text-primary text-xs truncate">{f.filename}</p>
                <p className="text-expense text-[11px] leading-snug mt-0.5">{f.error}</p>
              </div>
            </div>
          ))}
          <p className="text-text-muted text-[10px] mt-1.5 pl-6">
            Nothing from {failed.length !== 1 ? 'these files' : 'this file'} was saved — your data is untouched.
          </p>
        </Card>
      )}

      {groups.map((g) => (
        <GroupCard
          key={g.key}
          group={g}
          entries={g.entryKeys.map((k) => entriesByKey.get(k)!).filter(Boolean)}
          accounts={accounts}
          onResolve={(target) => onResolve(g.key, target)}
          onSkip={() => onSkip(g.key)}
        />
      ))}

      {groups.length > 0 && (
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onImport} disabled={!canImport} className="flex-1">
            Import {fileCount} {fileCount === 1 ? 'statement' : 'statements'}
          </Button>
        </div>
      )}
      {groups.length === 0 && (
        <Button variant="secondary" onClick={onCancel} fullWidth>
          Back
        </Button>
      )}
      {unresolved > 0 && (
        <p className="text-text-muted text-[11px] text-center">
          Pick an account for the highlighted {unresolved === 1 ? 'file' : 'files'} to continue.
        </p>
      )}
    </div>
  )
}
