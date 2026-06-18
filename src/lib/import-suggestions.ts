import type { Transaction } from './types'

export interface ImportSuggestion {
  label: string
  total: number
  count: number
}

// Outflows that represent money leaving for ANOTHER of your accounts — a card
// payment, a loan/mortgage payment, or a transfer that hasn't been matched to
// an imported account yet. These point at the "spoke" accounts worth importing
// next to complete the picture.
const SPOKE_PATTERN =
  /\bCREDIT\s*CARD\b|\bCARD\s*(PYMT|PMT|PAYMENT)\b|\bCC\s*PAYMENT\b|\bLOAN\b|\bMORTGAGE\b|\bAUTO\s*(PAY|LOAN)\b|\bPAYMENT\s*TO\b|\bTRANSFER\s*TO\b|\bONLINE\s*TRANSFER\b|\bWEB\s*PMT\b/i

function looksLikeSpokePayment(t: Transaction): boolean {
  if (t.amount >= 0) return false
  if (t.transferPairId !== null) return false // already matched → that account is imported
  if (t.categoryId === 'debt_payment') return true
  if (t.categoryId === 'transfer') return true
  return SPOKE_PATTERN.test(t.description) || SPOKE_PATTERN.test(t.originalDescription)
}

function labelFor(t: Transaction): string {
  if (t.merchantName) return t.merchantName
  const cleaned = t.description
    .toUpperCase()
    .replace(/\b(ONLINE|WEB|MOBILE|ELECTRONIC|RECURRING|AUTO|AUTHORIZED|PMT|PYMT|PAYMENT|TRANSFER|TO|FROM|ACH|XFER)\b/g, ' ')
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const words = cleaned.split(' ').filter(Boolean).slice(0, 2).join(' ')
  return words || 'Other transfer'
}

/**
 * Rank likely "next accounts to import" by total dollars flowing to them.
 * Pure: pass the transactions and the labels of accounts already imported
 * (names + institutions) so those are filtered out.
 */
export function suggestSpokeImports(
  transactions: Transaction[],
  existingLabels: string[] = [],
  limit = 4
): ImportSuggestion[] {
  const existing = existingLabels.map((l) => l.toUpperCase()).filter(Boolean)
  const groups = new Map<string, ImportSuggestion>()

  for (const t of transactions) {
    if (!looksLikeSpokePayment(t)) continue
    const label = labelFor(t)
    const upper = label.toUpperCase()
    if (existing.some((e) => e.includes(upper) || upper.includes(e))) continue

    const g = groups.get(label)
    if (g) {
      g.total += Math.abs(t.amount)
      g.count += 1
    } else {
      groups.set(label, { label, total: Math.abs(t.amount), count: 1 })
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}
