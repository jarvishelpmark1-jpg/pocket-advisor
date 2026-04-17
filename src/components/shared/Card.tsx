import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  padding?: 'sm' | 'md' | 'lg'
  glow?: string
}

export function Card({ children, className = '', onClick, padding = 'md', glow }: CardProps) {
  const paddings = { sm: 'p-3', md: 'p-4', lg: 'p-5' }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={`
        bg-bg-card rounded-2xl border border-border
        ${paddings[padding]}
        ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}
        ${glow ? `shadow-[0_0_20px_-5px_${glow}]` : ''}
        ${className}
      `}
    >
      {children}
    </motion.div>
  )
}

export function CardHeader({ title, subtitle, action }: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h3 className="text-text-primary text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-text-muted text-xs mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
