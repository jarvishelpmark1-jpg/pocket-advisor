import { motion } from 'framer-motion'

interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  height?: number
  showLabel?: boolean
  label?: string
}

export function ProgressBar({
  value,
  max = 100,
  color = '#6366F1',
  height = 6,
  showLabel = false,
  label,
}: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100)

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-text-muted">{label}</span>
          <span className="text-text-secondary font-mono">{pct.toFixed(0)}%</span>
        </div>
      )}
      <div
        className="w-full rounded-full bg-bg-elevated overflow-hidden"
        style={{ height }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  )
}
