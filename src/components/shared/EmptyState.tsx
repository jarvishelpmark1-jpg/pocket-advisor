import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 px-6 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-bg-elevated flex items-center justify-center text-text-muted mb-4">
        {icon}
      </div>
      <h3 className="text-text-primary font-semibold text-base mb-1">{title}</h3>
      <p className="text-text-muted text-sm max-w-xs mb-4">{description}</p>
      {action}
    </motion.div>
  )
}
