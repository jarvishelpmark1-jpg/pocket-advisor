import { db } from './db'
import type { Transaction } from './types'

const DAY = 24 * 60 * 60 * 1000
const DEFAULT_WINDOW_DAYS = 4

// A transfer/payment signal on at least one leg keeps pairing conservative:
// a genuine paycheck and a same-week, same-amount rent payment in two
// accounts won't be netted out unless one side actually reads like a move.
const TRANSFER_HINT =
  /\bTRANSFER\b|\bXFER\b|\bTFR\b|\bWIRE\b|\bACH\b|\bPAYMENT\b|\bPMT\b|\bAUTOPAY\b|\bBILL\s*PAY\b|\bE-?PAYMENT\b|\bONLINE\s*(PMT|PAYMENT)\b|\bCREDIT\s*CARD\b|\bZELLE\b|\bVENMO\b|\bPAYPAL\b/i

function looksLikeMove(t: Transaction): boolean {
  if (t.categoryId === 'transfer' || t.categoryId === 'debt_payment') return true
  return TRANSFER_HINT.test(t.description) || TRANSFER_HINT.test(t.originalDescription)
}

function cents(amount: number): number {
  return Math.round(Math.abs(amount) * 100)
}

/**
 * Pure matcher: pairs an outflow on one account with an equal, opposite-sign
 * inflow on a *different* account within `windowDays`, when at least one leg
 * looks like a transfer/payment. Ambiguous matches (more than one candidate)
 * are skipped rather than guessed. Returns [outflowId, inflowId] pairs.
 *
 * Only transactions with an id and no existing pair are considered.
 */
export function findTransferPairs(
  transactions: Transaction[],
  windowDays = DEFAULT_WINDOW_DAYS
): [number, number][] {
  const open = transactions.filter((t) => t.id != null && t.transferPairId == null)
  const outflows = open.filter((t) => t.amount < 0).sort((a, b) => a.date.getTime() - b.date.getTime())
  const inflows = open.filter((t) => t.amount > 0)

  const inflowByAmount = new Map<number, Transaction[]>()
  for (const inf of inflows) {
    const k = cents(inf.amount)
    const arr = inflowByAmount.get(k)
    if (arr) arr.push(inf)
    else inflowByAmount.set(k, [inf])
  }

  const used = new Set<number>()
  const pairs: [number, number][] = []
  const windowMs = windowDays * DAY

  for (const out of outflows) {
    if (used.has(out.id!)) continue
    const candidates = (inflowByAmount.get(cents(out.amount)) ?? []).filter(
      (inf) =>
        !used.has(inf.id!) &&
        inf.accountId !== out.accountId &&
        Math.abs(inf.date.getTime() - out.date.getTime()) <= windowMs &&
        (looksLikeMove(out) || looksLikeMove(inf))
    )
    if (candidates.length !== 1) continue // unambiguous matches only
    const inf = candidates[0]
    used.add(out.id!)
    used.add(inf.id!)
    pairs.push([out.id!, inf.id!])
  }

  return pairs
}

/**
 * Find and persist transfer pairs across all accounts. Both legs are linked,
 * marked as transfers, and flagged reviewed so they leave the review queue and
 * are excluded from income/expense totals. Returns the number of pairs made.
 */
export async function reconcileTransfers(windowDays = DEFAULT_WINDOW_DAYS): Promise<number> {
  const txns = await db.transactions.filter((t) => t.transferPairId == null).toArray()
  const pairs = findTransferPairs(txns, windowDays)
  if (pairs.length === 0) return 0

  await db.transaction('rw', db.transactions, async () => {
    for (const [outId, inId] of pairs) {
      await db.transactions.update(outId, { transferPairId: inId, categoryId: 'transfer', isReviewed: true })
      await db.transactions.update(inId, { transferPairId: outId, categoryId: 'transfer', isReviewed: true })
    }
  })

  return pairs.length
}
