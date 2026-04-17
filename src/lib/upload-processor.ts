import { db } from './db'
import { parseCSV, parseOFX, detectFileType } from './parser'
import { classifyTransaction } from './classifier'
import type { Transaction, UploadResult } from './types'

const AUTO_CLASSIFY_THRESHOLD = 0.55

export async function processUpload(
  file: File,
  accountId: number,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const content = await file.text()
  const fileType = detectFileType(file.name, content)

  let parsed
  if (fileType === 'csv') {
    parsed = parseCSV(content)
  } else if (fileType === 'ofx') {
    parsed = parseOFX(content)
  } else {
    throw new Error('Unsupported file format. Please upload a CSV or OFX/QFX file.')
  }

  if (parsed.length === 0) {
    throw new Error('No transactions found in this file. Please check the format.')
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
    onProgress?.(Math.round(((i + 1) / parsed.length) * 100))

    const existing = await db.transactions
      .where('[accountId+date+amount+description]')
      .equals([accountId, p.date, p.amount, p.description])
      .first()

    if (existing) {
      duplicatesSkipped++
      continue
    }

    const classification = await classifyTransaction(p)
    const isAutoClassified = classification.confidence >= AUTO_CLASSIFY_THRESHOLD

    const txn: Transaction = {
      accountId,
      date: p.date,
      description: p.description,
      originalDescription: p.description,
      amount: p.amount,
      categoryId: isAutoClassified ? classification.categoryId : null,
      confidence: classification.confidence,
      isReviewed: isAutoClassified && classification.confidence >= 0.85,
      isRecurring: false,
      merchantName: classification.merchantName,
      notes: '',
      uploadId: upload as number,
      createdAt: new Date(),
    }

    const id = await db.transactions.add(txn)
    txn.id = id as number
    transactions.push(txn)

    if (isAutoClassified) autoClassified++
    else needsReview++
  }

  const dates = transactions.map(t => t.date.getTime()).filter(d => !isNaN(d))
  const periodStart = dates.length > 0 ? new Date(Math.min(...dates)) : null
  const periodEnd = dates.length > 0 ? new Date(Math.max(...dates)) : null

  await db.uploads.update(upload as number, {
    transactionCount: transactions.length,
    autoClassified,
    needsReview,
    periodStart,
    periodEnd,
  })

  return {
    total: transactions.length,
    autoClassified,
    needsReview,
    duplicatesSkipped,
    transactions,
  }
}
