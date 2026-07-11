import Papa from 'papaparse'
import type { ParsedTransaction, ParseResult } from './types'

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
  balance?: number
}

// In priority order — but see detectDescColumn: a column only wins if its
// contents actually read like merchant text. Elan/US Bank card CSVs have both
// "Name" (the merchant) and "Memo" (reference numbers); picking by header
// alone imported every row with a junk reference string as its description.
const DESC_CANDIDATES = [
  'Description', 'Transaction Description', 'Trans Description',
  'Payee', 'Name', 'Merchant', 'Details', 'Narrative', 'Memo',
]

function looksLikeText(value: string): boolean {
  const letters = (value.match(/[A-Za-z]/g) || []).length
  return letters >= 3 && letters >= value.length * 0.3
}

function detectDescColumn(headers: string[], rows: string[][]): number {
  const found: number[] = []
  for (const c of DESC_CANDIDATES) {
    const idx = findColumn(headers, [c])
    if (idx !== -1 && !found.includes(idx)) found.push(idx)
  }
  if (found.length === 0) return -1

  const sample = rows.slice(1, 26)
  for (const idx of found) {
    let textRows = 0
    let nonEmpty = 0
    for (const row of sample) {
      const v = (row?.[idx] || '').trim()
      if (!v) continue
      nonEmpty++
      if (looksLikeText(v)) textRows++
    }
    if (nonEmpty > 0 && textRows / nonEmpty >= 0.5) return idx
  }
  return found[0]
}

function detectColumns(headers: string[], rows: string[][]): ColumnMapping | null {
  const dateCol = findColumn(headers, [
    'Date', 'Transaction Date', 'Trans Date', 'Posted Date', 'Post Date',
    'Posting Date', 'Settlement Date',
  ])

  const descCol = detectDescColumn(headers, rows)

  const amountCol = findColumn(headers, [
    'Amount', 'Transaction Amount', 'Trans Amount', 'Amount (USD)',
  ])

  const creditCol = findColumn(headers, [
    'Credit', 'Credits', 'Deposit', 'Deposits',
  ])

  const debitCol = findColumn(headers, [
    'Debit', 'Debits', 'Withdrawal', 'Withdrawals', 'Charge',
  ])

  const typeCol = findColumn(headers, [
    'Type', 'Transaction Type', 'Trans Type', 'Transaction',
  ])

  const balanceCol = findColumn(headers, [
    'Balance', 'Running Balance', 'Running Bal', 'Ending Balance',
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
    balance: balanceCol !== -1 ? balanceCol : undefined,
  }
}

export function parseCSV(content: string): ParseResult {
  const result = Papa.parse(content, {
    skipEmptyLines: true,
    header: false,
  })

  if (!result.data || result.data.length < 2) return { transactions: [], statement: null }

  const rows = result.data as string[][]
  const headers = rows[0]
  const mapping = detectColumns(headers, rows)

  if (!mapping) {
    return { transactions: parseWithoutHeaders(rows), statement: null }
  }

  const transactions: ParsedTransaction[] = []
  // When a running-balance column is present, the row with the latest date
  // carries the statement's ending balance.
  let latestBalance: { date: Date; balance: number } | null = null

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.length < 2) continue

    const date = parseDate(row[mapping.date])
    if (!date) continue

    if (mapping.balance !== undefined) {
      const bal = parseAmount(row[mapping.balance])
      if (bal !== null && (!latestBalance || date.getTime() >= latestBalance.date.getTime())) {
        latestBalance = { date, balance: bal }
      }
    }

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

  return {
    transactions,
    statement: latestBalance
      ? { endingBalance: latestBalance.balance, endDate: latestBalance.date }
      : null,
  }
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

function parseOfxDate(s: string): Date | null {
  const m = s.match(/(\d{8})/)
  if (!m) return null
  const d = new Date(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6, 8))
  return isNaN(d.getTime()) ? null : d
}

/** Pull the ledger (ending) balance + as-of date from an OFX/QFX file, if present. */
function extractOfxStatement(content: string): ParseResult['statement'] {
  const block = content.match(/<LEDGERBAL>([\s\S]*?)<\/LEDGERBAL>/i)?.[1] ?? content
  const amtMatch = block.match(/<BALAMT>([^<\n\r]+)/i)
  if (!amtMatch) return null
  const endingBalance = parseFloat(amtMatch[1].trim())
  if (isNaN(endingBalance)) return null
  const asOfMatch = block.match(/<DTASOF>([^<\n\r]+)/i)
  return { endingBalance, endDate: asOfMatch ? parseOfxDate(asOfMatch[1]) : null }
}

export function parseOFX(content: string): ParseResult {
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

  return { transactions, statement: extractOfxStatement(content) }
}

export function detectFileType(filename: string, content?: string): 'csv' | 'ofx' | 'pdf' | 'unknown' {
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'ofx' || ext === 'qfx') return 'ofx'
  if (ext === 'csv') return 'csv'
  if (content) {
    if (content.includes('<OFX>') || content.includes('OFXHEADER')) return 'ofx'
    if (content.includes(',') && content.split('\n').length > 1) return 'csv'
  }
  return 'unknown'
}
