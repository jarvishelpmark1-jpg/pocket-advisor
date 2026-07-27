import { useState } from 'react'
import { motion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  CheckCircle2, Copy, ArrowRight, ArrowLeftRight, XCircle, FileText,
  AlertTriangle, ShieldCheck, Info,
} from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../../lib/db'
import { hasUnsetBalance } from '../../lib/data-health'
import { isLiability, backfillNetWorthHistory } from '../../lib/analytics'
import { Card } from '../shared/Card'
import { Button } from '../shared/Button'
import { formatCurrency } from '../../lib/formatters'
import type { Account, UploadResult } from '../../lib/types'

export interface CompletedUpload {
  filename: string
  account: Account | null
  result: UploadResult | null
  error: string | null
}

/** Everything that landed in one account this upload, folded into one receipt. */
interface AccountReceipt {
  account: Account
  fileCount: number
  txnCount: number
  periodStart: Date | null
  periodEnd: Date | null
  /** the newest adopted statement balance, if any file carried one */
  anchor: NonNullable<UploadResult['anchorUpdated']> | null
  /** a balance that was read but NOT adopted (older than what's on file) */
  skipped: NonNullable<UploadResult['anchorSkipped']> | null
}

function buildReceipts(items: CompletedUpload[]): AccountReceipt[] {
  const byAccount = new Map<number, AccountReceipt>()
  for (const item of items) {
    if (!item.account?.id || !item.result) continue
    const r = item.result
    let receipt = byAccount.get(item.account.id)
    if (!receipt) {
      receipt = {
        account: item.account,
        fileCount: 0,
        txnCount: 0,
        periodStart: null,
        periodEnd: null,
        anchor: null,
        skipped: null,
      }
      byAccount.set(item.account.id, receipt)
    }
    receipt.fileCount++
    receipt.txnCount += r.total
    if (r.periodStart && (!receipt.periodStart || r.periodStart < receipt.periodStart)) {
      receipt.periodStart = r.periodStart
    }
    if (r.periodEnd && (!receipt.periodEnd || r.periodEnd > receipt.periodEnd)) {
      receipt.periodEnd = r.periodEnd
    }
    if (r.anchorUpdated && (!receipt.anchor || r.anchorUpdated.date > receipt.anchor.date)) {
      receipt.anchor = r.anchorUpdated
    }
    if (r.anchorSkipped && !receipt.skipped) {
      receipt.skipped = r.anchorSkipped
    }
  }
  return [...byAccount.values()]
}

export function UploadResults({
  items,
  onReview,
  onDone,
}: {
  items: CompletedUpload[]
  onReview: () => void
  onDone: () => void
}) {
  const results = items.map((i) => i.result).filter((r): r is UploadResult => r !== null)
  const failed = items.filter((i) => i.error !== null)

  const total = results.reduce((s, r) => s + r.total, 0)
  const autoClassified = results.reduce((s, r) => s + r.autoClassified, 0)
  const needsReview = results.reduce((s, r) => s + r.needsReview, 0)
  const duplicatesSkipped = results.reduce((s, r) => s + r.duplicatesSkipped, 0)
  const transfersMatched = results.reduce((s, r) => s + r.transfersMatched, 0)
  const receipts = buildReceipts(items)

  const pct = total > 0 ? ((autoClassified / total) * 100).toFixed(0) : '0'
  const allFailed = results.length === 0

  return (
    <div className="space-y-3">
      <Card className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
          className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${allFailed ? 'bg-expense/10' : 'bg-income/10'}`}
        >
          {allFailed ? (
            <XCircle size={28} className="text-expense" />
          ) : (
            <CheckCircle2 size={28} className="text-income" />
          )}
        </motion.div>

        <h3 className="text-text-primary text-base font-semibold mb-1">
          {allFailed
            ? 'Nothing imported'
            : items.length > 1
              ? `${results.length} of ${items.length} files imported`
              : 'Upload Complete'}
        </h3>
        <p className="text-text-muted text-xs">{total} transactions processed</p>
      </Card>

      {!allFailed && (
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total" value={total.toString()} color="#6366F1" />
          <StatCard label="Auto-sorted" value={`${pct}%`} color="#10B981" />
          <StatCard label="To review" value={needsReview.toString()} color={needsReview > 0 ? '#F59E0B' : '#10B981'} />
        </div>
      )}

      {receipts.map((receipt) => (
        <AccountReceiptCard key={receipt.account.id} receipt={receipt} />
      ))}

      {failed.length > 0 && (
        <Card padding="sm">
          {failed.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 py-1.5">
              <FileText size={14} className="text-text-muted flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-text-primary text-xs truncate">{item.filename}</p>
                <p className="text-expense text-[11px] leading-snug mt-0.5">{item.error}</p>
              </div>
              <XCircle size={14} className="text-expense flex-shrink-0 mt-0.5" />
            </div>
          ))}
        </Card>
      )}

      {duplicatesSkipped > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated text-text-muted text-xs">
          <Copy size={12} />
          {duplicatesSkipped} duplicate{duplicatesSkipped !== 1 ? 's' : ''} skipped — already imported earlier
        </div>
      )}

      {transfersMatched > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated text-text-muted text-xs">
          <ArrowLeftRight size={12} />
          {transfersMatched} transfer{transfersMatched !== 1 ? 's' : ''} matched across accounts (excluded from spending)
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {needsReview > 0 ? (
          <>
            <Button variant="secondary" onClick={onDone} className="flex-1">Done</Button>
            <Button onClick={onReview} icon={<ArrowRight size={14} />} className="flex-1">
              Review {needsReview}
            </Button>
          </>
        ) : (
          <Button onClick={onDone} fullWidth>Done</Button>
        )}
      </div>
    </div>
  )
}

/**
 * The receipt: what was read, for which account, and — the trust anchor — the
 * one question "does this balance look right?". A yes stamps the account
 * verified; a no re-anchors to whatever the user's bank actually shows.
 */
function AccountReceiptCard({ receipt }: { receipt: AccountReceipt }) {
  const { account, anchor, skipped } = receipt

  const period =
    receipt.periodStart && receipt.periodEnd
      ? `${format(receipt.periodStart, 'MMM d')} – ${format(receipt.periodEnd, 'MMM d, yyyy')}`
      : null

  return (
    <Card padding="sm">
      <div className="flex items-center gap-2.5 mb-1.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: account.color + '20', color: account.color }}
        >
          {account.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-text-primary text-sm font-medium truncate">{account.name}</p>
          <p className="text-text-muted text-[10px]">
            {receipt.fileCount} statement{receipt.fileCount !== 1 ? 's' : ''} ·{' '}
            {receipt.txnCount} transaction{receipt.txnCount !== 1 ? 's' : ''}
            {period ? ` · ${period}` : ''}
          </p>
        </div>
      </div>

      {anchor && <VerifyBalancePrompt account={account} anchor={anchor} />}

      {!anchor && skipped && (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-bg-elevated text-text-muted text-[11px] leading-snug">
          <Info size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            This statement's balance ({formatCurrency(Math.abs(skipped.balance))}
            {skipped.date ? ` on ${format(skipped.date, 'MMM d, yyyy')}` : ''}) is older than the
            one already on file, so the newer balance was kept.
          </span>
        </div>
      )}

      {!anchor && !skipped && <SetBalancePrompt account={account} />}
    </Card>
  )
}

/** "Your statement says X — does that look right?" — the accuracy anchor. */
function VerifyBalancePrompt({
  account,
  anchor,
}: {
  account: Account
  anchor: { balance: number; date: Date; isLiability: boolean }
}) {
  const live = useLiveQuery(() => db.accounts.get(account.id!), [account.id])
  const [mismatch, setMismatch] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  if (!live) return null

  const isVerified =
    live.anchorVerifiedAt && live.anchorVerifiedAt.getTime() >= live.anchorDate.getTime()

  const statementLine = (
    <p className="text-text-primary text-xs">
      The statement says {anchor.isLiability ? <>you owed <strong>{formatCurrency(anchor.balance)}</strong></> : <>you had <strong>{formatCurrency(anchor.balance)}</strong></>}{' '}
      on {format(anchor.date, 'MMM d, yyyy')}.
    </p>
  )

  if (isVerified) {
    return (
      <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-income/10 text-income text-[11px] leading-snug">
        <ShieldCheck size={12} className="flex-shrink-0 mt-0.5" />
        <span>
          Verified — {account.name} is anchored to{' '}
          {formatCurrency(live.anchorBalance)}
          {live.anchorSource === 'manual' ? ' (your number)' : ` from the ${format(live.anchorDate, 'MMM d')} statement`}.
        </span>
      </div>
    )
  }

  const confirmMatch = async () => {
    await db.accounts.update(account.id!, { anchorVerifiedAt: new Date(), updatedAt: new Date() })
  }

  const saveMismatch = async () => {
    const amount = Math.abs(parseFloat(value))
    if (isNaN(amount) || saving) return
    setSaving(true)
    try {
      // The user just read this number off their bank — that's the truest
      // anchor we can get, dated now.
      await db.accounts.update(account.id!, {
        anchorBalance: amount,
        anchorDate: new Date(),
        anchorSource: 'manual',
        anchorVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      await backfillNetWorthHistory()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg bg-bg-elevated px-2.5 py-2 space-y-2">
      {statementLine}
      {!mismatch ? (
        <>
          <p className="text-text-muted text-[11px]">Does that look right?</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={confirmMatch} className="flex-1">
              Looks right
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setMismatch(true)} className="flex-1">
              Something's off
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-text-muted text-[11px] leading-snug">
            Enter what your bank shows {anchor.isLiability ? 'owed ' : ''}right now — and if the
            difference is big, a statement in between is probably missing (the Home screen will
            point at gaps).
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={anchor.isLiability ? 'Amount owed now' : 'Balance now'}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
            />
            <Button size="sm" onClick={saveMismatch} disabled={saving || !value}>
              Save
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * CSV exports carry no balance, so an account can absorb months of history yet
 * still sit on its $0 creation seed. When that's the state after this upload,
 * ask for the real number right here instead of failing silently.
 */
function SetBalancePrompt({ account }: { account: Account }) {
  const live = useLiveQuery(() => db.accounts.get(account.id!), [account.id])
  const txns = useLiveQuery(
    () => db.transactions.where('accountId').equals(account.id!).toArray(),
    [account.id]
  )
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  if (!live || !txns || !hasUnsetBalance(live, txns)) return null
  const liability = isLiability(live.type)

  const save = async () => {
    const amount = Math.abs(parseFloat(value))
    if (isNaN(amount) || saving) return
    setSaving(true)
    try {
      await db.accounts.update(account.id!, {
        anchorBalance: amount,
        anchorDate: new Date(),
        anchorSource: 'manual',
        anchorVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      await backfillNetWorthHistory()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 px-2.5 py-2">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle size={12} className="text-warning flex-shrink-0" />
        <p className="text-text-primary text-xs">
          This file had no balance info — what does <strong>{live.name}</strong>{' '}
          {liability ? 'owe' : 'hold'} right now?
        </p>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={liability ? 'Current amount owed' : 'Current balance'}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-bg-card border border-border text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
        />
        <Button size="sm" onClick={save} disabled={saving || !value}>
          Save
        </Button>
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card padding="sm" className="text-center">
      <span className="text-lg font-bold font-mono" style={{ color }}>{value}</span>
      <p className="text-text-muted text-[10px] mt-0.5">{label}</p>
    </Card>
  )
}
