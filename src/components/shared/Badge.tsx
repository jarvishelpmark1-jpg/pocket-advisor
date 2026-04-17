import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  color?: string
  variant?: 'solid' | 'outline'
  size?: 'sm' | 'md'
}

export function Badge({ children, color = '#6366F1', variant = 'solid', size = 'sm' }: BadgeProps) {
  const sizes = { sm: 'text-[10px] px-2 py-0.5', md: 'text-xs px-2.5 py-1' }

  if (variant === 'outline') {
    return (
      <span
        className={`${sizes[size]} rounded-full font-medium border`}
        style={{ color, borderColor: color + '40' }}
      >
        {children}
      </span>
    )
  }

  return (
    <span
      className={`${sizes[size]} rounded-full font-medium`}
      style={{ backgroundColor: color + '20', color }}
    >
      {children}
    </span>
  )
}
