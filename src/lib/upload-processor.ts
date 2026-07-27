import { db } from './db'
import { parseCSV, parseOFX, detectFileType } from './parser'
import { parsePDF } from './pdf-parser'
import { classifyTransaction } from './classifier'
import { reconcileTransfers } from './reconcile'
import { isLiability, backfillNetWorthHistory } from './analytics'
import {
  identifyFilename,
  identifyOFX,
  identifyStatementText,
  mergeIdentities,
  type StatementIdentity,
} from './statement-identify'
import type { Transaction, UploadResult, ParsedTransaction, StatementMetadata } from './types'

const AUTO_REVIEW_THRESHOLD = 0.7

// The same transaction exported two ways (PDF statement vs OFX/CSV download)
// prints different description strings — "2270 - DAVIS SUPPLY EDMOND OK" vs
// "DAVIS SUPPLY EDMOND". With date and amount already equal, a strong word
// overlap means it's the same money, not a coincidence.
function descTokens(s: string): Set<string> {
  return new Set(
    s.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/)
      .filter((w) => w.length >= 3 && /[A-Z]/.test(w))
  )
}

function looksLikeSameTransaction(a: string, b: string): boolean {
  const ta = descTokens(a)
  const tb = descTokens(b)
  if (ta.size === 0 || tb.size === 0) return false
  let shared = 0
  for (const w of ta) if (tb.has(w)) shared++
  return shared / Math.min(ta.size, tb.size) >= 0.5
}

/** A statement file after phase-1 parsing: everything read, nothing written. */
export interface ParsedStatementFile {
  filename: string
  kind: 'pdf' | 'csv' | 'ofx'
  transactions: ParsedTransaction[]
  statement: StatementMetadata | null
  /** who/what this statement looks like (institution, type, last four) */
  identity: StatementIdentity
  periodStart: Date | null
  periodEnd: Date | null
}

/**
 * Phase 1 of an import: read, parse, and identify the file WITHOUT touching
 * the database. The upload flow shows this result to the user for confirmation
 * (which account, right type) before importStatement writes anything — so a
 * failed or misread file can never leave debris behind.
 */
export async function parseStatementFile(file: File): Promise<ParsedStatementFile> {
  const fileType = detectFileType(file.name)

  let parsed: ParsedTransaction[]
  let statement: StatementMetadata | null = null
  let identity = identifyFilename(file.name)
  let kind: ParsedStatementFile['kind']

  if (fileType === 'pdf') {
    kind = 'pdf'
    const buffer = await file.arrayBuffer()
    let r: Awaited<ReturnType<typeof parsePDF>>
    try {
      r = await parsePDF(buffer)
    } catch (err) {
      // Surface the engine's own error — "could not extract transactions" hides
      // whether the PDF never opened at all (corrupt file, unsupported browser).
      const detail = err instanceof Error ? err.message : String(err)
      throw new Error(`Couldn't open this PDF (${detail}). If this keeps happening, try downloading a CSV from your bank instead.`)
    }
    parsed = r.transactions
    statement = r.statement
    identity = mergeIdentities(identifyStatementText(r.textLines), identity)
  } else {
    const content = await file.text()
    const confirmedType = detectFileType(file.name, content)
    if (confirmedType === 'csv') {
      kind = 'csv'
      const r = parseCSV(content)
      parsed = r.transactions
      statement = r.statement
    } else if (confirmedType === 'ofx') {
      kind = 'ofx'
      const r = parseOFX(content)
      parsed = r.transactions
      statement = r.statement
      identity = mergeIdentities(identifyOFX(content), identity)
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

  const dates = parsed.map((t) => t.date.getTime()).filter((d) => !isNaN(d))
  return {
    filename: file.name,
    kind,
    transactions: parsed,
    statement,
    identity,
    periodStart: dates.length > 0 ? new Date(Math.min(...dates)) : null,
    periodEnd: dates.length > 0 ? new Date(Math.max(...dates)) : null,
  }
}

/**
 * Phase 2: write a parsed statement into an account — dedupe, classify,
 * reconcile transfers, and re-anchor the balance. Also stamps the account with
 * the statement's identity (institution, last four) when those are blank, so
 * the next upload of this account auto-matches.
 */
export async function importStatement(
  parsedFile: ParsedStatementFile,
  accountId: number,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  let parsed = parsedFile.transactions
  const statement = parsedFile.statement

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
    filename: parsedFile.filename,
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
    // manually) is a re-import — skip it. That covers the exact same file
    // re-uploaded, and the same period exported in two formats (descriptions
    // differ but date+amount+most words agree). A match from THIS upload means
    // the file itself lists the transaction twice (two same-price coffees the
    // same day), which is real activity, not a duplicate.
    const sameDateAmount = await db.transactions
      .where('[accountId+date+amount+description]')
      .between([accountId, p.date, p.amount, ''], [accountId, p.date, p.amount, '￿'], true, true)
      .toArray()

    const isDuplicate = sameDateAmount.some(
      (m) =>
        m.uploadId !== (upload as number) &&
        (m.description === p.description || looksLikeSameTransaction(m.description, p.description))
    )
    if (isDuplicate) {
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

  // The file's own period (pre-dedupe): even a fully-duplicate re-upload knows
  // what stretch of time it covered.
  const periodStart = parsedFile.periodStart
  const periodEnd = parsedFile.periodEnd

  // Re-anchor the account to the statement's ending balance so the derived
  // balance is actually live (not stuck at the seed value). The statement's
  // transactions are dated on/before its close, so they're already baked into
  // that balance and won't double-count (deriveAccountBalance only adds rows
  // dated strictly after the anchor).
  let anchorUpdated: UploadResult['anchorUpdated'] = null
  let anchorSkipped: UploadResult['anchorSkipped'] = null
  if (account && statement) {
    const anchorDate = statement.endDate ?? periodEnd
    // Adopt on the account's first import, and afterwards only adopt a newer
    // statement, so re-uploading an old one can't clobber a more-recent known
    // balance. A creation-seed anchor ($0 stamped "today") is not knowledge —
    // any statement balance beats it, even one dated in the past; otherwise an
    // account that started from balance-less CSVs could never anchor at all.
    const seedAnchor =
      account.anchorBalance === 0 &&
      Math.abs(account.anchorDate.getTime() - account.createdAt.getTime()) < 24 * 60 * 60 * 1000
    const adopt =
      anchorDate !== null &&
      (priorTxnCount === 0 || seedAnchor || anchorDate.getTime() > account.anchorDate.getTime())
    const liability = isLiability(account.type)
    // anchorBalance is stored in natural terms: cash for assets, amount owed
    // (positive) for liabilities. OFX reports owed as a negative balance, PDFs
    // print it positive — abs() normalizes both.
    const normalizedBalance = liability ? Math.abs(statement.endingBalance) : statement.endingBalance
    if (adopt && anchorDate) {
      await db.accounts.update(accountId, {
        anchorBalance: normalizedBalance,
        anchorDate,
        anchorSource: 'statement',
        updatedAt: new Date(),
      })
      anchorUpdated = { balance: normalizedBalance, date: anchorDate, isLiability: liability }
    } else {
      anchorSkipped = { balance: normalizedBalance, date: anchorDate }
    }
  }

  // Learn the statement's fingerprint: fill in institution / last-four the
  // account doesn't have yet, so the next upload of this account auto-matches
  // instead of asking (or worse, creating a duplicate). Fill-blanks only —
  // never overwrite what the user typed.
  if (account) {
    const { identity } = parsedFile
    const stamp: Partial<Pick<typeof account, 'institution' | 'lastFour' | 'updatedAt'>> = {}
    if (!account.institution && identity.institution) stamp.institution = identity.institution
    if (!account.lastFour && identity.lastFour) stamp.lastFour = identity.lastFour
    if (Object.keys(stamp).length > 0) {
      stamp.updatedAt = new Date()
      await db.accounts.update(accountId, stamp)
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
    anchorSkipped,
    periodStart,
    periodEnd,
  }
}

/** Parse + import in one step (kept for callers that don't need a confirm gate). */
export async function processUpload(
  file: File,
  accountId: number,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  onProgress?.(5)
  const parsed = await parseStatementFile(file)
  return importStatement(parsed, accountId, onProgress)
}
