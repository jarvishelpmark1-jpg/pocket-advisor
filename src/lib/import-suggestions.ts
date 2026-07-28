import type { Transaction } from './types'

/** Account type we can confidently infer for a spoke from its payments. */
export type SuggestionType = 'credit' | 'loan' | 'savings' | 'checking'

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
  /** the most recent raw bank line behind this suggestion — so the user can
   * recognize what it actually is instead of guessing from a scrubbed label */
  sample: string
  lastSeen: Date
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
const SAVINGS_PATTERN = /\bSAV(INGS)?\b/i

// Strength order so a group settles on its most specific (and most net-worth-
// relevant) type: a credit-card payment wins over a generic transfer.
const TYPE_RANK: Record<SuggestionType, number> = { credit: 3, loan: 2, savings: 1, checking: 0 }

function inferType(t: Transaction): SuggestionType {
  const text = `${t.description} ${t.originalDescription}`
  if (CREDIT_PATTERN.test(text)) return 'credit'
  if (LOAN_PATTERN.test(text)) return 'loan'
  if (SAVINGS_PATTERN.test(text)) return 'savings'
  return 'checking'
}

// "Online Banking transfer to CHK 5678" — the digits are the destination
// account's last four, the single most identifying thing on the line.
const DEST_DIGITS =
  /\b(CHK|CHECKING|SAV|SAVINGS|MMA|ACCT|ACCOUNT|CARD|LOAN)\s*#?\s*[X*]*\s*(\d{3,4})\b/i

// Bank shorthand → words a human recognizes.
const SHORT_WORDS: Record<string, string> = {
  CHK: 'Checking',
  CHECKING: 'Checking',
  SAV: 'Savings',
  SAVINGS: 'Savings',
  MMA: 'Money Market',
  ACCT: 'Account',
}

function labelFor(t: Transaction): string {
  const dest = `${t.description} ${t.originalDescription}`.match(DEST_DIGITS)
  let base: string
  if (t.merchantName) {
    base = t.merchantName
  } else {
    const cleaned = t.description
      .toUpperCase()
      .replace(/\b(ONLINE|BANKING|WEB|MOBILE|ELECTRONIC|RECURRING|AUTO|AUTHORIZED|PMT|PYMT|PAYMENT|TRANSFER|TO|FROM|ACH|XFER|CONFIRMATION)\b/g, ' ')
      .replace(/[^A-Z ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    base = cleaned
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => SHORT_WORDS[w] ?? w)
      .join(' ')
  }
  if (dest) {
    if (!base || base === 'Account') base = SHORT_WORDS[dest[1].toUpperCase()] ?? 'Account'
    return `${base} ••${dest[2]}`
  }
  return base || 'Other transfer'
}

/**
 * Rank likely "next accounts to import" by total dollars flowing to them.
 * Pure: pass the transactions and the labels of accounts already imported
 * (names + institutions) so those are filtered out.
 */
// "CAPITAL ONE" must recognize "Capital One Venture ••1234" as already
// imported — compare with spacing/punctuation squashed out, either direction,
// and require enough length that a stray short token can't match everything.
function labelsOverlap(a: string, b: string): boolean {
  const na = a.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const nb = b.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!na || !nb) return false
  const [short, long] = na.length <= nb.length ? [na, nb] : [nb, na]
  return short.length >= 4 && long.includes(short)
}

export function suggestSpokeImports(
  transactions: Transaction[],
  existingLabels: string[] = [],
  limit = 4
): ImportSuggestion[] {
  const existing = existingLabels.filter(Boolean)
  const groups = new Map<string, ImportSuggestion>()

  for (const t of transactions) {
    if (!looksLikeSpokePayment(t)) continue
    const label = labelFor(t)
    if (existing.some((e) => labelsOverlap(e, label))) continue

    const ty = inferType(t)
    const sample = t.originalDescription || t.description
    const g = groups.get(label)
    if (g) {
      g.total += Math.abs(t.amount)
      g.count += 1
      if (TYPE_RANK[ty] > TYPE_RANK[g.type]) g.type = ty
      if (t.date.getTime() > g.lastSeen.getTime()) {
        g.lastSeen = t.date
        g.sample = sample
      }
    } else {
      groups.set(label, {
        label,
        total: Math.abs(t.amount),
        count: 1,
        type: ty,
        sample,
        lastSeen: t.date,
      })
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
