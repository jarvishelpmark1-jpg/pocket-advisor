import type { ParseResult } from './types'

// Pure (no pdfjs) statement-summary detection, so it's unit-testable in Node and
// reusable across parsers. Operates on plain text lines.

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
  const match = s.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (!match) return null
  const month = parseInt(match[1])
  const day = parseInt(match[2])
  let year = match[3] ? parseInt(match[3]) : (fallbackYear || new Date().getFullYear())
  if (year < 100) year += 2000
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(year, month - 1, day)
  return isNaN(d.getTime()) ? null : d
}

const BALANCE_EXCLUDE = /(beginning|opening|previous|prior|available|minimum|average|year[- ]?to[- ]?date|ytd)/i
const BALANCE_TIERS = [/new\s+balance/i, /ending\s+balance/i, /closing\s+balance/i, /statement\s+balance/i]

function lastMoneyOnLine(text: string): number | null {
  const matches = text.match(new RegExp(MONEY_PATTERN.source, 'g'))
  if (!matches || matches.length === 0) return null
  return parseMoneyStr(matches[matches.length - 1])
}

function detectStatementEndDate(lines: { text: string }[], fallbackYear?: number): Date | null {
  const datePatterns = [
    // "Statement Period 05/16/2026 - 06/15/2026" → take the closing (second) date
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*(?:-|–|—|to|through|thru)\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /(?:statement|closing|ending|billing)\s*(?:cycle\s*)?(?:date|period)?\D{0,16}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /as of\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
  ]
  for (const line of lines) {
    for (let p = 0; p < datePatterns.length; p++) {
      const m = line.text.match(datePatterns[p])
      if (!m) continue
      // pattern 0 is a range — the closing date is the second capture group
      const d = parseDateStr(p === 0 ? m[2] : m[1], fallbackYear)
      if (d) return d
    }
  }
  return null
}

/**
 * Best-effort extraction of a statement's ending balance + closing date from the
 * raw text lines. Returns null when nothing trustworthy is found — a wrong anchor
 * is worse than none, so this stays conservative (prefers "new balance", skips
 * beginning/minimum/average lines).
 */
export function detectStatementBalance(lines: { text: string }[], fallbackYear?: number): ParseResult['statement'] {
  let endingBalance: number | null = null
  for (const tier of BALANCE_TIERS) {
    for (const line of lines) {
      if (!tier.test(line.text) || BALANCE_EXCLUDE.test(line.text)) continue
      const amt = lastMoneyOnLine(line.text)
      if (amt !== null && amt !== 0) { endingBalance = amt; break }
    }
    if (endingBalance !== null) break
  }
  if (endingBalance === null) return null
  return { endingBalance, endDate: detectStatementEndDate(lines, fallbackYear) }
}
