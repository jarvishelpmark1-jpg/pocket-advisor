import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
  icon?: ReactNode
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  fullWidth,
  className = '',
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-accent text-white hover:bg-accent-light active:bg-accent',
    secondary: 'bg-bg-elevated text-text-primary border border-border hover:bg-bg-hover',
    ghost: 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated',
    danger: 'bg-expense/10 text-expense hover:bg-expense/20',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      className={`
        ${variants[variant]} ${sizes[size]}
        rounded-xl font-medium transition-all duration-150
        flex items-center justify-center gap-2
        disabled:opacity-40 disabled:cursor-not-allowed
        active:scale-[0.97]
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
