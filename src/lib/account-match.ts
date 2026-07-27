import type { Account, Upload } from './types'
import type { StatementIdentity } from './statement-identify'

// Collapse the parts of a filename that vary between exports of the same
// account (statement dates, long reference ids) while keeping short digit runs
// like an account's last-4, which is what distinguishes two cards at one bank.
// "Chase3477_Activity_20260608.CSV" → "chase3477 activity #"
function normalize(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/\d{4}[-_.]?\d{2}[-_.]?\d{2}/g, '#')
    .replace(/\d{5,}/g, '#')
    .replace(/[^a-z0-9#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Banks name their exports consistently, so a file that looks like one already
 * imported almost certainly belongs to the same account. Suggest an account
 * only when every past upload with the same normalized name agrees on one —
 * a wrong suggestion is worse than none.
 */
export function suggestAccountForFilename(filename: string, uploads: Upload[]): number | null {
  const key = normalize(filename)
  if (!key) return null

  const accountIds = new Set(
    uploads.filter((u) => normalize(u.filename) === key).map((u) => u.accountId)
  )
  return accountIds.size === 1 ? [...accountIds][0] : null
}

/** Squash to comparable form: "Bank of America" → "bankofamerica". */
function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Does an account's name or institution carry this institution's name? */
function accountAtInstitution(account: Account, institution: string): boolean {
  const inst = squash(institution)
  if (inst.length < 3) return false
  return squash(account.institution).includes(inst) || squash(account.name).includes(inst)
}

export interface AccountMatch {
  accountId: number
  /** why we matched — drives the confirm-card copy */
  reason: 'fingerprint' | 'institution' | 'filename'
}

/**
 * Decide which existing account a statement belongs to, most reliable signal
 * first: the account's last four digits, then institution + type, then the
 * filename convention. Returns null when the evidence is ambiguous — the flow
 * asks the user rather than guessing between two accounts, but a null here is
 * also what triggers the "create new account" proposal, so this is the one
 * gate that keeps a re-uploaded card from becoming a duplicate account.
 */
export function matchStatementToAccount(
  identity: StatementIdentity,
  filename: string,
  accounts: Account[],
  uploads: Upload[]
): AccountMatch | null {
  const candidates = accounts.filter((a) => a.type !== 'manual_asset')

  if (identity.lastFour) {
    let byFour = candidates.filter((a) => a.lastFour === identity.lastFour)
    // Two banks can issue cards with the same last four — institution breaks ties.
    if (byFour.length > 1 && identity.institution) {
      const alsoInst = byFour.filter((a) => accountAtInstitution(a, identity.institution!))
      if (alsoInst.length > 0) byFour = alsoInst
    }
    if (byFour.length === 1) return { accountId: byFour[0].id!, reason: 'fingerprint' }
    if (byFour.length > 1) return null // genuinely ambiguous — ask, don't guess
  }

  if (identity.institution) {
    let byInst = candidates.filter((a) => accountAtInstitution(a, identity.institution!))
    // A statement that knows its last four must not attach to an account with
    // a DIFFERENT last four on file — that's a second card at the same bank
    // (equal last-fours already matched in the fingerprint step).
    if (identity.lastFour) {
      byInst = byInst.filter((a) => !a.lastFour)
    }
    if (byInst.length > 1 && identity.accountType) {
      byInst = byInst.filter((a) => a.type === identity.accountType)
    }
    if (byInst.length === 1) return { accountId: byInst[0].id!, reason: 'institution' }
  }

  const byFilename = suggestAccountForFilename(filename, uploads)
  if (byFilename !== null) return { accountId: byFilename, reason: 'filename' }

  return null
}
