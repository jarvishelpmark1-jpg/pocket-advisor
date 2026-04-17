import { motion } from 'framer-motion'
import { CheckCircle2, Copy, ArrowRight } from 'lucide-react'
import { Card } from '../shared/Card'
import { Button } from '../shared/Button'
import type { UploadResult } from '../../lib/types'

export function UploadResults({
  result,
  onReview,
  onDone,
}: {
  result: UploadResult
  onReview: () => void
  onDone: () => void
}) {
  const pct = result.total > 0 ? ((result.autoClassified / result.total) * 100).toFixed(0) : '0'

  return (
    <div className="space-y-3">
      <Card className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
          className="w-14 h-14 rounded-full bg-income/10 flex items-center justify-center mx-auto mb-3"
        >
          <CheckCircle2 size={28} className="text-income" />
        </motion.div>

        <h3 className="text-text-primary text-base font-semibold mb-1">Upload Complete</h3>
        <p className="text-text-muted text-xs">
          {result.total} transactions processed
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total" value={result.total.toString()} color="#6366F1" />
        <StatCard label="Auto-sorted" value={`${pct}%`} color="#10B981" />
        <StatCard label="To review" value={result.needsReview.toString()} color={result.needsReview > 0 ? '#F59E0B' : '#10B981'} />
      </div>

      {result.duplicatesSkipped > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated text-text-muted text-xs">
          <Copy size={12} />
          {result.duplicatesSkipped} duplicate{result.duplicatesSkipped !== 1 ? 's' : ''} skipped
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {result.needsReview > 0 ? (
          <>
            <Button variant="secondary" onClick={onDone} className="flex-1">Done</Button>
            <Button onClick={onReview} icon={<ArrowRight size={14} />} className="flex-1">
              Review {result.needsReview}
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
