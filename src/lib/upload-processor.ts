import { db } from './db'
import { parseCSV, parseOFX, detectFileType } from './parser'
import { parsePDF } from './pdf-parser'
import { classifyTransaction } from './classifier'
import type { Transaction, UploadResult, ParsedTransaction } from './types'

const AUTO_REVIEW_THRESHOLD = 0.7

export async function processUpload(
  file: File,
  accountId: number,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const fileType = detectFileType(file.name)

  let parsed: ParsedTransaction[]

  if (fileType === 'pdf') {
    onProgress?.(5)
    const buffer = await file.arrayBuffer()
    parsed = await parsePDF(buffer)
  } else {
    const content = await file.text()
    const confirmedType = detectFileType(file.name, content)
    if (confirmedType === 'csv') {
      parsed = parseCSV(content)
    } else if (confirmedType === 'ofx') {
      parsed = parseOFX(content)
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
  let needsReview = 0
  let duplicatesSkipped = 0
  const transactions: Transaction[] = []

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i]
    onProgress?.(Math.round(10 + ((i + 1) / parsed.length) * 80))

    const existing = await db.transactions
      .where('[accountId+date+amount+description]')
      .equals([accountId, p.date, p.amount, p.description])
      .first()

    if (existing) {
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
      uploadId: upload as number,
      createdAt: new Date(),
    }

    const id = await db.transactions.add(txn)
    txn.id = id as number
    transactions.push(txn)

    if (isAutoReviewed) autoClassified++
    else needsReview++
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
            needsReview--
          }
        }
      }
    }
  }

  onProgress?.(98)

  const dates = transactions.map(t => t.date.getTime()).filter(d => !isNaN(d))
  const periodStart = dates.length > 0 ? new Date(Math.min(...dates)) : null
  const periodEnd = dates.length > 0 ? new Date(Math.max(...dates)) : null

  await db.uploads.update(upload as number, {
    transactionCount: transactions.length,
    autoClassified,
    needsReview: Math.max(needsReview, 0),
    periodStart,
    periodEnd,
  })

  return {
    total: transactions.length,
    autoClassified,
    needsReview: Math.max(needsReview, 0),
    duplicatesSkipped,
    transactions,
  }
}
