import { format, isToday, isYesterday, parseISO } from 'date-fns'

export function formatCurrency(amount: number, compact = false): string {
  if (compact && Math.abs(amount) >= 1000) {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
    return formatted
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d')
}

export function formatMonthShort(month: string): string {
  return format(parseISO(month + '-01'), 'MMM')
}

export function formatMonthLong(month: string): string {
  return format(parseISO(month + '-01'), 'MMMM yyyy')
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

export function cleanDescription(desc: string): string {
  return desc
    .replace(/\d{10,}/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[*#]+/g, '')
    .trim()
    .slice(0, 50)
}
