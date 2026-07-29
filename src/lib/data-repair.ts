// Self-healing for data damaged by past parser bugs. The parser now refuses
// statement summary rows ("Beginning balance as of 01/01" imported as a
// five-figure fake income transaction) — this removes any that already got
// in, once per install, so every device cleans itself on next launch.

import { db } from './db'
import { isSummaryRowDescription } from './parser'
import { backfillNetWorthHistory } from './analytics'
import { getSettings, saveSettings } from './settings'

export async function removeSummaryRowTransactions(): Promise<number> {
  const bad = await db.transactions
    .filter(
      (t) =>
        isSummaryRowDescription(t.description) || isSummaryRowDescription(t.originalDescription)
    )
    .toArray()
  if (bad.length === 0) return 0

  const badIds = new Set(bad.map((t) => t.id!))
  // A doomed row may have been paired as a transfer leg — unpair the partner
  // rather than leaving it pointing at a deleted transaction.
  for (const t of bad) {
    if (t.transferPairId !== null && !badIds.has(t.transferPairId)) {
      await db.transactions.update(t.transferPairId, { transferPairId: null })
    }
  }
  await db.transactions.bulkDelete([...badIds])
  return bad.length
}

/** Launch-time repairs + the regular snapshot backfill. */
export async function runStartupRepairs(): Promise<void> {
  if (!getSettings().summaryRowCleanupDone) {
    const removed = await removeSummaryRowTransactions()
    saveSettings({ summaryRowCleanupDone: true })
    if (removed > 0) {
      console.info(`[repair] removed ${removed} statement summary row(s) misread as transactions`)
    }
  }
  await backfillNetWorthHistory()
}
