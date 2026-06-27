import type { Transaction } from './types'

/** Account type we can confidently infer for a spoke from its payments. */
export type SuggestionType = 'credit' | 'loan' | 'checking'

export interface ImportSuggestion {
  label: string
  total: number
  count: number
  /**
   * Best-guess account type for this destination, so a deep-linked import
   * creates a card/loan as a *debt* (not a checking asset) and net worth
   * stays correct from day one. Falls back to 'checking' when unsure.
   */
  type: SuggestionType
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

const CREDIT_PATTERN = /\bCREDIT\s*CARD\b|\bCARD\s*(PYMT|PMT|PAYMENT)\b|\bCC\s*PAYMENT\b/i
const LOAN_PATTERN = /\bLOAN\b|\bMORTGAGE\b|\bAUTO\s*(PAY|LOAN)\b/i

// Strength order so a group settles on its most specific (and most net-worth-
// relevant) type: a credit-card payment wins over a generic transfer.
const TYPE_RANK: Record<SuggestionType, number> = { credit: 2, loan: 1, checking: 0 }

function inferType(t: Transaction): SuggestionType {
  const text = `${t.description} ${t.originalDescription}`
  if (CREDIT_PATTERN.test(text)) return 'credit'
  if (LOAN_PATTERN.test(text)) return 'loan'
  return 'checking'
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

    const ty = inferType(t)
    const g = groups.get(label)
    if (g) {
      g.total += Math.abs(t.amount)
      g.count += 1
      if (TYPE_RANK[ty] > TYPE_RANK[g.type]) g.type = ty
    } else {
      groups.set(label, { label, total: Math.abs(t.amount), count: 1, type: ty })
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

export interface Coverage {
  /** outflow we can fully see (real spending + transfers reconciled to imported accounts) */
  tracedTotal: number
  /** outflow leaving to accounts not yet imported */
  untracedTotal: number
  /** 0–100; how much of your money movement is fully accounted for */
  coveragePct: number
  /** biggest unimported destinations, ranked by dollars */
  suggestions: ImportSuggestion[]
}

/**
 * The guided-onboarding brain: how much of the user's money is fully traced vs.
 * still flowing to accounts they haven't imported, plus what to import next.
 * "Trace everything" = drive untracedTotal to zero (coverage to 100%).
 */
export function analyzeCoverage(
  transactions: Transaction[],
  existingLabels: string[] = [],
  limit = 4
): Coverage {
  let traced = 0
  let untraced = 0
  for (const t of transactions) {
    if (t.amount >= 0) continue
    if (looksLikeSpokePayment(t)) untraced += Math.abs(t.amount)
    else traced += Math.abs(t.amount)
  }
  const total = traced + untraced
  const coveragePct = total === 0 ? 100 : Math.round((traced / total) * 100)
  return {
    tracedTotal: traced,
    untracedTotal: untraced,
    coveragePct,
    suggestions: suggestSpokeImports(transactions, existingLabels, limit),
  }
}
