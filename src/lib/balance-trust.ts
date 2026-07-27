// Answers, for any account, the question the user actually has: "can I trust
// this number?" — by classifying where the balance anchor came from and
// whether the user confirmed it. Every screen that shows a balance uses this
// one vocabulary, so trust reads the same everywhere.

import type { Account, Upload } from './types'

const DAY = 24 * 60 * 60 * 1000
// A statement's close date and its last transaction can differ by a few days —
// tolerance for inferring provenance on accounts that predate anchorSource.
const STATEMENT_INFER_MS = 7 * DAY

export type TrustLevel =
  /** the user confirmed this balance against their bank */
  | 'verified'
  /** anchored to a statement's printed balance */
  | 'statement'
  /** the user typed the balance themselves */
  | 'manual'
  /** still on the $0 creation seed — the number shown is a guess */
  | 'never_set'

export interface BalanceTrust {
  level: TrustLevel
  /** when the anchored balance was true */
  asOf: Date
  staleDays: number
}

function seedLike(account: Account): boolean {
  return (
    account.anchorBalance === 0 &&
    Math.abs(account.anchorDate.getTime() - account.createdAt.getTime()) < DAY
  )
}

/**
 * Classify an account's balance provenance. `uploads` is only consulted for
 * accounts created before anchorSource existed, to tell a statement anchor
 * from a manual one after the fact.
 */
export function balanceTrust(
  account: Account,
  uploads: Upload[] = [],
  now: Date = new Date()
): BalanceTrust {
  const asOf = account.anchorDate
  const staleDays = Math.max(0, Math.floor((now.getTime() - asOf.getTime()) / DAY))

  let source = account.anchorSource
  if (!source) {
    if (seedLike(account)) {
      source = 'seed'
    } else if (
      uploads.some(
        (u) =>
          u.accountId === account.id &&
          u.periodEnd &&
          Math.abs(u.periodEnd.getTime() - asOf.getTime()) < STATEMENT_INFER_MS
      )
    ) {
      // Statement adoption pins the anchor at the statement's close — an
      // upload whose period ends right there is almost certainly its source.
      source = 'statement'
    } else {
      source = 'manual'
    }
  }

  if (source === 'seed') return { level: 'never_set', asOf, staleDays }

  const verified =
    account.anchorVerifiedAt !== undefined &&
    account.anchorVerifiedAt.getTime() >= asOf.getTime()
  if (verified) return { level: 'verified', asOf, staleDays }

  return { level: source, asOf, staleDays }
}
