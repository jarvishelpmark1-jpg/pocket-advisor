import { motion } from 'framer-motion'
import { CheckCircle2, Copy, ArrowRight, ArrowLeftRight, Wallet, XCircle, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { Card } from '../shared/Card'
import { Button } from '../shared/Button'
import { formatCurrency } from '../../lib/formatters'
import type { UploadResult } from '../../lib/types'

export interface CompletedUpload {
  filename: string
  accountName: string
  result: UploadResult | null
  error: string | null
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
  const anchorsUpdated = items.filter((i) => i.result?.anchorUpdated)

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

      {items.length > 1 && (
        <Card padding="sm">
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1">
                <FileText size={14} className="text-text-muted flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-xs truncate">{item.filename}</p>
                  <p className={`text-[10px] ${item.error ? 'text-expense' : 'text-text-muted'}`}>
                    {item.error
                      ? item.error
                      : `${item.result!.total} transactions → ${item.accountName}`}
                  </p>
                </div>
                {item.error ? (
                  <XCircle size={14} className="text-expense flex-shrink-0" />
                ) : (
                  <CheckCircle2 size={14} className="text-income flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {items.length === 1 && failed.length === 1 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-expense/10 text-expense text-xs">
          <XCircle size={12} className="flex-shrink-0" />
          {failed[0].error}
        </div>
      )}

      {duplicatesSkipped > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated text-text-muted text-xs">
          <Copy size={12} />
          {duplicatesSkipped} duplicate{duplicatesSkipped !== 1 ? 's' : ''} skipped
        </div>
      )}

      {transfersMatched > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated text-text-muted text-xs">
          <ArrowLeftRight size={12} />
          {transfersMatched} transfer{transfersMatched !== 1 ? 's' : ''} matched across accounts (excluded from spending)
        </div>
      )}

      {anchorsUpdated.map((item, i) => {
        const a = item.result!.anchorUpdated!
        return (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-income/10 text-income text-xs">
            <Wallet size={12} className="flex-shrink-0" />
            {item.accountName}: {a.isLiability ? 'balance owed' : 'balance'} set to{' '}
            {formatCurrency(a.balance)} as of {format(a.date, 'MMM d, yyyy')}
          </div>
        )
      })}

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

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <Card padding="sm" className="text-center">
      <span className="text-lg font-bold font-mono" style={{ color }}>{value}</span>
      <p className="text-text-muted text-[10px] mt-0.5">{label}</p>
    </Card>
  )
}
