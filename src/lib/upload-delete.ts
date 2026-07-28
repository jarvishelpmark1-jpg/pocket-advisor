// Undo an upload as if it never happened — without touching anything the user
// did elsewhere. Only rows stamped with this uploadId are deleted (review work
// on every other upload survives untouched); transfer partners in OTHER
// uploads are unpaired rather than deleted; and if this upload's statement set
// the account's current balance anchor, the anchor is put back (exactly when
// we recorded what it replaced, otherwise reset to a loudly-flagged "never
// set" instead of silently keeping a wrong number).

import { db } from './db'
import { reconcileTransfers } from './reconcile'
import { backfillNetWorthHistory } from './analytics'
import type { Upload } from './types'

const DAY = 24 * 60 * 60 * 1000
// A statement's close can precede its period only slightly…
const ANCHOR_BEFORE_MS = 7 * DAY
// …but can trail the last transaction by weeks on a quiet account (the close
// date is the cycle's end, not the last purchase).
const ANCHOR_AFTER_MS = 35 * DAY

export interface DeleteUploadResult {
  removedTransactions: number
  /** transfer legs in other uploads whose partner was deleted */
  unpaired: number
  /**
   * What happened to the account's balance anchor:
   * untouched — this upload never set it (or a newer statement replaced it);
   * restored — put back exactly what this upload had replaced;
   * reset — anchor came from this upload but its predecessor is unknown, so
   * the account is flagged "balance never set" rather than left wrong.
   */
  anchorOutcome: 'untouched' | 'restored' | 'reset'
}

export async function deleteUpload(uploadId: number): Promise<DeleteUploadResult> {
  const upload = await db.uploads.get(uploadId)
  if (!upload) return { removedTransactions: 0, unpaired: 0, anchorOutcome: 'untouched' }

  const txns = await db.transactions.where('uploadId').equals(uploadId).toArray()
  const doomedIds = new Set(txns.map((t) => t.id!))
  const partnerIds = txns
    .map((t) => t.transferPairId)
    .filter((id): id is number => id !== null && !doomedIds.has(id))

  let unpaired = 0
  await db.transaction('rw', [db.transactions, db.uploads], async () => {
    for (const pid of partnerIds) {
      const partner = await db.transactions.get(pid)
      if (partner && partner.transferPairId !== null) {
        await db.transactions.update(pid, { transferPairId: null })
        unpaired++
      }
    }
    await db.transactions.where('uploadId').equals(uploadId).delete()
    await db.uploads.delete(uploadId)
  })

  const anchorOutcome = await revertAnchor(upload)

  // Survivors may pair up differently now, and every derived number changed.
  await reconcileTransfers()
  await backfillNetWorthHistory()

  return { removedTransactions: txns.length, unpaired, anchorOutcome }
}

async function revertAnchor(upload: Upload): Promise<DeleteUploadResult['anchorOutcome']> {
  const account = await db.accounts.get(upload.accountId)
  if (!account) return 'untouched'

  if (upload.anchorSet) {
    // Exact bookkeeping exists: revert only if this upload's anchor is still
    // the one in effect (a newer statement or manual edit must not be undone).
    const stillInEffect =
      account.anchorBalance === upload.anchorSet.balance &&
      account.anchorDate.getTime() === upload.anchorSet.date.getTime()
    if (!stillInEffect) return 'untouched'

    const before = upload.anchorBefore
    await db.accounts
      .where('id')
      .equals(account.id!)
      .modify((a) => {
        a.anchorBalance = before?.balance ?? 0
        a.anchorDate = before?.date ?? a.createdAt
        if (before?.source) a.anchorSource = before.source
        else a.anchorSource = 'seed'
        if (before?.verifiedAt) a.anchorVerifiedAt = before.verifiedAt
        else delete a.anchorVerifiedAt
        a.updatedAt = new Date()
      })
    return 'restored'
  }

  // Legacy upload (imported before undo bookkeeping existed): we can't know
  // what the anchor was before. If the current anchor plausibly came from this
  // upload — dated inside its statement window and not set by hand — a wrong
  // number is worse than a flagged one: reset to the "never set" state, which
  // the dashboard and Settings surface loudly.
  const cameFromThisUpload =
    account.anchorSource !== 'manual' &&
    account.anchorSource !== 'seed' &&
    upload.periodStart !== null &&
    upload.periodEnd !== null &&
    account.anchorDate.getTime() >= upload.periodStart.getTime() - ANCHOR_BEFORE_MS &&
    account.anchorDate.getTime() <= upload.periodEnd.getTime() + ANCHOR_AFTER_MS

  if (!cameFromThisUpload) return 'untouched'

  await db.accounts
    .where('id')
    .equals(account.id!)
    .modify((a) => {
      a.anchorBalance = 0
      a.anchorDate = a.createdAt
      a.anchorSource = 'seed'
      delete a.anchorVerifiedAt
      a.updatedAt = new Date()
    })
  return 'reset'
}
