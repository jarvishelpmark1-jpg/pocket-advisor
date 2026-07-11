import type { Upload } from './types'

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
