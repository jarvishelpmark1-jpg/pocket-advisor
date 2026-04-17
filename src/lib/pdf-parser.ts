import * as pdfjsLib from 'pdfjs-dist'
import type { ParsedTransaction } from './types'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface TextItem {
  str: string
  x: number
  y: number
  width: number
  height: number
}

interface TextLine {
  y: number
  items: TextItem[]
  text: string
}

async function extractTextFromPDF(data: ArrayBuffer): Promise<TextLine[][]> {
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const allPages: TextLine[][] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const items: TextItem[] = content.items
      .filter((item): item is typeof item & { str: string } => 'str' in item && typeof item.str === 'string')
      .map((item) => {
        const tx = (item as Record<string, unknown>).transform as number[]
        return {
          str: item.str,
          x: tx[4],
          y: Math.round(tx[5]),
          width: tx[0] * item.str.length * 0.6,
          height: tx[3],
        }
      })
      .filter(item => item.str.trim().length > 0)

    const lineMap = new Map<number, TextItem[]>()
    for (const item of items) {
      const yKey = Math.round(item.y / 2) * 2
      if (!lineMap.has(yKey)) lineMap.set(yKey, [])
      lineMap.get(yKey)!.push(item)
    }

    const lines: TextLine[] = Array.from(lineMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([y, lineItems]) => {
        const sorted = lineItems.sort((a, b) => a.x - b.x)
        return {
          y,
          items: sorted,
          text: sorted.map(i => i.str).join(' ').trim(),
        }
      })
      .filter(l => l.text.length > 0)

    allPages.push(lines)
  }

  return allPages
}

const DATE_PATTERN = /\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/
const MONEY_PATTERN = /\$?\s*-?\(?\d{1,3}(?:,\d{3})*\.\d{2}\)?/
const AMOUNT_EXTRACT = /[($]*(\d{1,3}(?:,\d{3})*\.\d{2})\)?/

function parseMoneyStr(s: string): number | null {
  const match = s.match(AMOUNT_EXTRACT)
  if (!match) return null
  let val = parseFloat(match[1].replace(/,/g, ''))
  if (s.includes('(') || s.includes('-')) val = -val
  return isNaN(val) ? null : val
}

function parseDateStr(s: string, fallbackYear?: number): Date | null {
  const match = s.match(DATE_PATTERN)
  if (!match) return null
  const month = parseInt(match[1])
  const day = parseInt(match[2])
  let year = match[3] ? parseInt(match[3]) : (fallbackYear || new Date().getFullYear())
  if (year < 100) year += 2000

  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  return isNaN(d.getTime()) ? null : d
}

function detectStatementYear(lines: TextLine[]): number | undefined {
  for (const line of lines.slice(0, 30)) {
    const yearMatch = line.text.match(/(?:statement|period|through|ending|closing).*?(\d{1,2}[\/\-]\d{1,2}[\/\-](\d{4}))/i)
    if (yearMatch) return parseInt(yearMatch[2])

    const standaloneYear = line.text.match(/\b(20\d{2})\b/)
    if (standaloneYear) return parseInt(standaloneYear[1])
  }
  return undefined
}

function isLikelyHeaderLine(text: string): boolean {
  const lower = text.toLowerCase()
  const headerTerms = ['date', 'description', 'amount', 'debit', 'credit', 'withdrawal', 'deposit', 'balance', 'transaction', 'details', 'posted']
  const matches = headerTerms.filter(t => lower.includes(t))
  return matches.length >= 2
}

function isNoiseLine(text: string): boolean {
  const lower = text.toLowerCase()
  const noisePatterns = [
    /^page\s+\d/i,
    /account\s*(number|#|no)/i,
    /statement\s*period/i,
    /opening\s*balance/i,
    /closing\s*balance/i,
    /^total/i,
    /continued\s*(on|from)/i,
    /beginning\s*balance/i,
    /ending\s*balance/i,
    /customer\s*service/i,
    /www\./i,
    /member\s*fdic/i,
    /equal\s*housing/i,
  ]
  return noisePatterns.some(p => p.test(lower))
}

export async function parsePDF(data: ArrayBuffer): Promise<ParsedTransaction[]> {
  const pages = await extractTextFromPDF(data)
  const allLines = pages.flat()

  if (allLines.length === 0) return []

  const year = detectStatementYear(allLines)

  const strategies = [
    parseByColumnLayout,
    parseByLinePattern,
    parseByAmountAtEnd,
  ]

  for (const strategy of strategies) {
    const results = strategy(allLines, year)
    if (results.length >= 3) return results
  }

  for (const strategy of strategies) {
    const results = strategy(allLines, year)
    if (results.length > 0) return results
  }

  return []
}

function parseByColumnLayout(lines: TextLine[], fallbackYear?: number): ParsedTransaction[] {
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    if (isLikelyHeaderLine(lines[i].text)) {
      headerIdx = i
      break
    }
  }

  if (headerIdx === -1) return []

  const transactions: ParsedTransaction[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (isNoiseLine(line.text)) continue
    if (isLikelyHeaderLine(line.text)) continue

    const date = parseDateStr(line.text, fallbackYear)
    if (!date) continue

    let description = ''
    let amount: number | null = null

    if (line.items.length >= 2) {
      const nonDateItems = line.items.filter(item => !DATE_PATTERN.test(item.str))
      const amountItems = nonDateItems.filter(item => MONEY_PATTERN.test(item.str))
      const descItems = nonDateItems.filter(item => !MONEY_PATTERN.test(item.str))

      description = descItems.map(i => i.str).join(' ').trim()

      if (amountItems.length === 1) {
        amount = parseMoneyStr(amountItems[0].str)
      } else if (amountItems.length === 2) {
        const first = parseMoneyStr(amountItems[0].str)
        const second = parseMoneyStr(amountItems[1].str)
        if (first !== null && first !== 0) amount = -Math.abs(first)
        else if (second !== null && second !== 0) amount = Math.abs(second)
      } else if (amountItems.length > 2) {
        const lastTwo = amountItems.slice(-2)
        const debit = parseMoneyStr(lastTwo[0].str)
        const credit = parseMoneyStr(lastTwo[1].str)
        if (debit !== null && debit !== 0) amount = -Math.abs(debit)
        else if (credit !== null && credit !== 0) amount = Math.abs(credit)
      }
    }

    if (!description && amount === null) continue

    if (amount === null) {
      const moneyMatch = line.text.match(MONEY_PATTERN)
      if (moneyMatch) amount = parseMoneyStr(moneyMatch[0])
    }

    if (amount === null || amount === 0) continue
    if (!description) description = line.text.replace(DATE_PATTERN, '').replace(MONEY_PATTERN, '').trim()
    if (!description) continue

    transactions.push({ date, description: cleanPdfDescription(description), amount })
  }

  return transactions
}

function parseByLinePattern(lines: TextLine[], fallbackYear?: number): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isNoiseLine(line.text)) continue

    const dateMatch = line.text.match(/^(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/)
    if (!dateMatch) continue

    const date = parseDateStr(dateMatch[1], fallbackYear)
    if (!date) continue

    const afterDate = line.text.slice(dateMatch[0].length).trim()
    const amounts = afterDate.match(new RegExp(MONEY_PATTERN.source, 'g'))

    if (!amounts || amounts.length === 0) {
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1]
        const nextAmounts = nextLine.text.match(new RegExp(MONEY_PATTERN.source, 'g'))
        if (nextAmounts && nextAmounts.length > 0) {
          const description = afterDate.replace(new RegExp(MONEY_PATTERN.source, 'g'), '').trim()
          const amountStr = nextAmounts[nextAmounts.length > 1 ? nextAmounts.length - 2 : 0]
          const amount = parseMoneyStr(amountStr)
          if (description && amount !== null && amount !== 0) {
            transactions.push({ date, description: cleanPdfDescription(description), amount })
            i++
          }
        }
      }
      continue
    }

    let description = afterDate
    for (const amt of amounts) {
      description = description.replace(amt, '')
    }
    description = description.trim()

    let amount: number | null = null
    if (amounts.length === 1) {
      amount = parseMoneyStr(amounts[0])
    } else if (amounts.length >= 2) {
      const debit = parseMoneyStr(amounts[amounts.length - 2])
      const credit = parseMoneyStr(amounts[amounts.length - 1])
      if (debit !== null && debit !== 0) amount = -Math.abs(debit)
      else if (credit !== null && credit !== 0) amount = Math.abs(credit)
    }

    if (amount === null || amount === 0) continue
    if (!description) continue

    transactions.push({ date, description: cleanPdfDescription(description), amount })
  }

  return transactions
}

function parseByAmountAtEnd(lines: TextLine[], fallbackYear?: number): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = []

  for (const line of lines) {
    if (isNoiseLine(line.text)) continue

    const text = line.text
    const amountMatch = text.match(/([($\-]?\$?\s*\d{1,3}(?:,\d{3})*\.\d{2}\)?)\s*$/)
    if (!amountMatch) continue

    const beforeAmount = text.slice(0, text.length - amountMatch[0].length).trim()
    const date = parseDateStr(beforeAmount, fallbackYear)
    if (!date) continue

    const description = beforeAmount.replace(DATE_PATTERN, '').trim()
    const amount = parseMoneyStr(amountMatch[1])

    if (!description || amount === null || amount === 0) continue

    transactions.push({ date, description: cleanPdfDescription(description), amount })
  }

  return transactions
}

function findColumnX(items: TextItem[], keywords: string[]): { min: number; max: number } | null {
  for (const item of items) {
    const lower = item.str.toLowerCase()
    if (keywords.some(k => lower.includes(k))) {
      return { min: item.x - 5, max: item.x + item.width + 50 }
    }
  }
  return null
}

function cleanPdfDescription(desc: string): string {
  return desc
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-*]+/, '')
    .replace(/[\s\-*]+$/, '')
    .replace(/\d{10,}/g, '')
    .trim()
}
