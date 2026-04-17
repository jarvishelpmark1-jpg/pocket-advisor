import Papa from 'papaparse'
import type { ParsedTransaction } from './types'

function parseDate(value: string): Date | null {
  if (!value) return null

  const cleaned = value.trim().replace(/["']/g, '')

  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
  ]

  for (const fmt of formats) {
    const match = cleaned.match(fmt)
    if (!match) continue

    if (fmt === formats[0]) {
      return new Date(+match[3], +match[1] - 1, +match[2])
    }
    if (fmt === formats[1]) {
      const year = +match[3] + (+match[3] > 50 ? 1900 : 2000)
      return new Date(year, +match[1] - 1, +match[2])
    }
    if (fmt === formats[2]) {
      return new Date(+match[1], +match[2] - 1, +match[3])
    }
    if (fmt === formats[3]) {
      return new Date(+match[3], +match[1] - 1, +match[2])
    }
  }

  const fallback = new Date(cleaned)
  return isNaN(fallback.getTime()) ? null : fallback
}

function parseAmount(value: string): number | null {
  if (!value) return null
  const cleaned = value.replace(/[$,"\s]/g, '').replace(/\((.+)\)/, '-$1')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(h => h.toLowerCase().replace(/[^a-z]/g, ''))
  for (const candidate of candidates) {
    const idx = normalized.indexOf(candidate.toLowerCase().replace(/[^a-z]/g, ''))
    if (idx !== -1) return idx
  }
  return -1
}

interface ColumnMapping {
  date: number
  description: number
  amount: number
  credit?: number
  debit?: number
  type?: number
}

function detectColumns(headers: string[]): ColumnMapping | null {
  const dateCol = findColumn(headers, [
    'Date', 'Transaction Date', 'Trans Date', 'Posted Date', 'Post Date',
    'Posting Date', 'Settlement Date',
  ])

  const descCol = findColumn(headers, [
    'Description', 'Memo', 'Transaction Description', 'Trans Description',
    'Payee', 'Name', 'Merchant', 'Details', 'Narrative',
  ])

  const amountCol = findColumn(headers, [
    'Amount', 'Transaction Amount', 'Trans Amount',
  ])

  const creditCol = findColumn(headers, [
    'Credit', 'Credits', 'Deposit', 'Deposits',
  ])

  const debitCol = findColumn(headers, [
    'Debit', 'Debits', 'Withdrawal', 'Withdrawals', 'Charge',
  ])

  const typeCol = findColumn(headers, [
    'Type', 'Transaction Type', 'Trans Type',
  ])

  if (dateCol === -1 || descCol === -1) return null

  if (amountCol === -1 && creditCol === -1 && debitCol === -1) return null

  return {
    date: dateCol,
    description: descCol,
    amount: amountCol,
    credit: creditCol !== -1 ? creditCol : undefined,
    debit: debitCol !== -1 ? debitCol : undefined,
    type: typeCol !== -1 ? typeCol : undefined,
  }
}

export function parseCSV(content: string): ParsedTransaction[] {
  const result = Papa.parse(content, {
    skipEmptyLines: true,
    header: false,
  })

  if (!result.data || result.data.length < 2) return []

  const rows = result.data as string[][]
  const headers = rows[0]
  const mapping = detectColumns(headers)

  if (!mapping) {
    return parseWithoutHeaders(rows)
  }

  const transactions: ParsedTransaction[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue

    const date = parseDate(row[mapping.date])
    if (!date) continue

    const description = (row[mapping.description] || '').trim()
    if (!description) continue

    let amount: number | null = null

    if (mapping.amount !== -1 && mapping.amount !== undefined) {
      amount = parseAmount(row[mapping.amount])
    }

    if (amount === null && mapping.credit !== undefined && mapping.debit !== undefined) {
      const credit = parseAmount(row[mapping.credit])
      const debit = parseAmount(row[mapping.debit])
      if (credit && credit !== 0) {
        amount = Math.abs(credit)
      } else if (debit && debit !== 0) {
        amount = -Math.abs(debit)
      }
    }

    if (amount === null) continue

    if (mapping.type !== undefined) {
      const type = (row[mapping.type] || '').toLowerCase()
      if ((type.includes('credit') || type.includes('deposit')) && amount < 0) {
        amount = Math.abs(amount)
      } else if ((type.includes('debit') || type.includes('withdrawal') || type.includes('charge')) && amount > 0) {
        amount = -amount
      }
    }

    transactions.push({ date, description, amount })
  }

  return transactions
}

function parseWithoutHeaders(rows: string[][]): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []

  for (const row of rows) {
    if (!row || row.length < 3) continue

    let dateIdx = -1
    let amountIdx = -1

    for (let i = 0; i < row.length; i++) {
      if (dateIdx === -1 && parseDate(row[i])) dateIdx = i
      if (amountIdx === -1 && /^-?[$]?[\d,]+\.?\d*$/.test(row[i].replace(/[()]/g, '').trim())) amountIdx = i
    }

    if (dateIdx === -1 || amountIdx === -1) continue

    const descIdx = row.findIndex((_, i) => i !== dateIdx && i !== amountIdx && row[i].trim().length > 0)
    if (descIdx === -1) continue

    const date = parseDate(row[dateIdx])
    const amount = parseAmount(row[amountIdx])
    const description = row[descIdx].trim()

    if (date && amount !== null && description) {
      transactions.push({ date, description, amount })
    }
  }

  return transactions
}

export function parseOFX(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []
  const txnPattern = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match

  while ((match = txnPattern.exec(content)) !== null) {
    const block = match[1]

    const dateMatch = block.match(/<DTPOSTED>(\d{8})/)
    const amountMatch = block.match(/<TRNAMT>([^<\n]+)/)
    const nameMatch = block.match(/<NAME>([^<\n]+)/) || block.match(/<MEMO>([^<\n]+)/)

    if (!dateMatch || !amountMatch) continue

    const dateStr = dateMatch[1]
    const date = new Date(
      parseInt(dateStr.slice(0, 4)),
      parseInt(dateStr.slice(4, 6)) - 1,
      parseInt(dateStr.slice(6, 8))
    )

    const amount = parseFloat(amountMatch[1].trim())
    const description = (nameMatch?.[1] || 'Unknown').trim()

    if (!isNaN(date.getTime()) && !isNaN(amount)) {
      transactions.push({ date, description, amount })
    }
  }

  return transactions
}

export function detectFileType(filename: string, content: string): 'csv' | 'ofx' | 'unknown' {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'ofx' || ext === 'qfx') return 'ofx'
  if (ext === 'csv') return 'csv'
  if (content.includes('<OFX>') || content.includes('OFXHEADER')) return 'ofx'
  if (content.includes(',') && content.split('\n').length > 1) return 'csv'
  return 'unknown'
}
