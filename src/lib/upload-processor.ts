import { db } from './db'
import { parseCSV, parseOFX, detectFileType } from './parser'
import { parsePDF } from './pdf-parser'
import { classifyTransaction } from './classifier'
import { reconcileTransfers } from './reconcile'
import { isLiability, backfillNetWorthHistory } from './analytics'
import type { Transaction, UploadResult, ParsedTransaction, StatementMetadata } from './types'

const AUTO_REVIEW_THRESHOLD = 0.7

export async function processUpload(
  file: File,
  accountId: number,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const fileType = detectFileType(file.name)

  let parsed: ParsedTransaction[]
  let statement: StatementMetadata | null = null

  if (fileType === 'pdf') {
    onProgress?.(5)
    const buffer = await file.arrayBuffer()
    const r = await parsePDF(buffer)
    parsed = r.transactions
    statement = r.statement
  } else {
    const content = await file.text()
    const confirmedType = detectFileType(file.name, content)
    if (confirmedType === 'csv') {
      const r = parseCSV(content)
      parsed = r.transactions
      statement = r.statement
    } else if (confirmedType === 'ofx') {
      const r = parseOFX(content)
      parsed = r.transactions
      statement = r.statement
    } else {
      throw new Error('Unsupported file format. Please upload a PDF, CSV, or OFX/QFX file.')
    }
  }

  if (parsed.length === 0) {
    throw new Error(
      fileType === 'pdf'
        ? 'Could not extract transactions from this PDF. The statement format may not be supported yet, or the PDF may be image-based (scanned). Try downloading a CSV from your bank instead.'
        : 'No transactions found in this file. Please check the format.'
    )
  }

  // Capture state before we add rows: whether this is the account's first import
  // decides whether a statement balance may adopt over the default/seed anchor.
  const account = await db.accounts.get(accountId)
  const priorTxnCount = await db.transactions.where('accountId').equals(accountId).count()

  // Card/loan statements usually print charges as positive numbers (OFX and
  // some banks' CSVs sign them instead). Imported as-is, every charge would
  // read as income — so on a liability account where positives dominate, flip
  // all signs: spending becomes negative, payments/refunds positive.
  if (account && isLiability(account.type)) {
    const positives = parsed.filter(p => p.amount > 0).length
    if (positives / parsed.length > 0.6) {
      parsed = parsed.map(p => ({ ...p, amount: -p.amount }))
    }
  }

  const upload = await db.uploads.add({
    accountId,
    filename: file.name,
    transactionCount: 0,
    autoClassified: 0,
    needsReview: 0,
    uploadedAt: new Date(),
    periodStart: null,
    periodEnd: null,
  })

  let autoClassified = 0
  let duplicatesSkipped = 0
  const transactions: Transaction[] = []

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i]
    onProgress?.(Math.round(10 + ((i + 1) / parsed.length) * 80))

    // A row already in the ledger from a *different* upload (or entered
    // manually) is a re-import — skip it. A match from THIS upload means the
    // file itself lists the transaction twice (two same-price coffees the same
    // day), which is real activity, not a duplicate.
    const matches = await db.transactions
      .where('[accountId+date+amount+description]')
      .equals([accountId, p.date, p.amount, p.description])
      .toArray()

    if (matches.some(m => m.uploadId !== (upload as number))) {
      duplicatesSkipped++
      continue
    }

    const classification = await classifyTransaction(p)
    const isAutoReviewed = classification.confidence >= AUTO_REVIEW_THRESHOLD

    const txn: Transaction = {
      accountId,
      date: p.date,
      description: p.description,
      originalDescription: p.description,
      amount: p.amount,
      categoryId: classification.categoryId,
      confidence: classification.confidence,
      isReviewed: isAutoReviewed,
      isRecurring: false,
      merchantName: classification.merchantName,
      notes: '',
      transferPairId: null,
      source: 'import',
      uploadId: upload as number,
      createdAt: new Date(),
    }

    const id = await db.transactions.add(txn)
    txn.id = id as number
    transactions.push(txn)

    if (isAutoReviewed) autoClassified++
  }

  onProgress?.(92)

  const descGroups = new Map<string, Transaction[]>()
  for (const txn of transactions) {
    if (txn.isReviewed) continue
    const key = (txn.merchantName || txn.description.slice(0, 20)).toUpperCase()
    const group = descGroups.get(key)
    if (group) group.push(txn)
    else descGroups.set(key, [txn])
  }

  for (const [, group] of descGroups) {
    if (group.length < 2) continue
    const reviewed = group.find(t => t.confidence >= AUTO_REVIEW_THRESHOLD)
    if (!reviewed) {
      const best = group.reduce((a, b) => a.confidence > b.confidence ? a : b)
      if (best.confidence >= 0.5) {
        for (const txn of group) {
          const boosted = Math.min(best.confidence + 0.15, 0.95)
          await db.transactions.update(txn.id!, {
            categoryId: best.categoryId,
            confidence: boosted,
            isReviewed: boosted >= AUTO_REVIEW_THRESHOLD,
          })
          if (boosted >= AUTO_REVIEW_THRESHOLD) {
            autoClassified++
          }
        }
      }
    }
  }

  onProgress?.(96)

  // Match cross-account transfers / card payments against the whole ledger so
  // both legs net out instead of double-counting as spend + income.
  const transfersMatched = await reconcileTransfers()

  onProgress?.(98)

  const dates = transactions.map(t => t.date.getTime()).filter(d => !isNaN(d))
  const periodStart = dates.length > 0 ? new Date(Math.min(...dates)) : null
  const periodEnd = dates.length > 0 ? new Date(Math.max(...dates)) : null

  // Re-anchor the account to the statement's ending balance so the derived
  // balance is actually live (not stuck at the seed value). The statement's
  // transactions are dated on/before its close, so they're already baked into
  // that balance and won't double-count (deriveAccountBalance only adds rows
  // dated strictly after the anchor).
  let anchorUpdated: UploadResult['anchorUpdated'] = null
  if (account && statement) {
    const anchorDate = statement.endDate ?? periodEnd
    // Adopt on the account's first import (its anchor is just a seed); afterwards
    // only adopt a newer statement, so re-uploading an old one can't clobber a
    // more-recent known balance.
    const adopt =
      anchorDate !== null &&
      (priorTxnCount === 0 || anchorDate.getTime() > account.anchorDate.getTime())
    if (adopt && anchorDate) {
      const liability = isLiability(account.type)
      // anchorBalance is stored in natural terms: cash for assets, amount owed
      // (positive) for liabilities. OFX reports owed as a negative balance, PDFs
      // print it positive — abs() normalizes both.
      const anchorBalance = liability ? Math.abs(statement.endingBalance) : statement.endingBalance
      await db.accounts.update(accountId, { anchorBalance, anchorDate, updatedAt: new Date() })
      anchorUpdated = { balance: anchorBalance, date: anchorDate, isLiability: liability }
    }
  }

  // Balances changed (new rows, maybe a re-anchor) — refresh net-worth history
  // so the dashboard chart reflects this import.
  await backfillNetWorthHistory()

  // reconciliation may have pulled some just-imported rows out of review
  const stillNeedsReview = transactions.length
    ? await db.transactions.where('uploadId').equals(upload as number).filter(t => !t.isReviewed).count()
    : 0

  await db.uploads.update(upload as number, {
    transactionCount: transactions.length,
    autoClassified,
    needsReview: stillNeedsReview,
    periodStart,
    periodEnd,
  })

  return {
    total: transactions.length,
    autoClassified,
    needsReview: stillNeedsReview,
    duplicatesSkipped,
    transfersMatched,
    transactions,
    anchorUpdated,
  }
}
