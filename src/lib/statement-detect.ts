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

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
}

// "June 8, 2026" / "Jun 8 2026" / "December 31st, 2025" — many banks (e.g. Bank
// of America) print the close as a textual date, which the numeric parser misses.
function parseTextualDate(s: string, fallbackYear?: number): Date | null {
  const m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/)
  if (!m) return null
  const month = MONTHS[m[1].toLowerCase()]
  if (month === undefined) return null
  const day = parseInt(m[2])
  const year = m[3] ? parseInt(m[3]) : (fallbackYear || new Date().getFullYear())
  if (day < 1 || day > 31) return null
  const d = new Date(year, month, day)
  return isNaN(d.getTime()) ? null : d
}

// Either format, textual first (a numeric date never starts with a month word).
function parseDateFlexible(s: string, fallbackYear?: number): Date | null {
  return parseTextualDate(s, fallbackYear) ?? parseDateStr(s, fallbackYear)
}

const BALANCE_EXCLUDE = /(beginning|opening|previous|prior|available|minimum|average|year[- ]?to[- ]?date|ytd)/i
const BALANCE_TIERS = [/new\s+balance/i, /ending\s+balance/i, /closing\s+balance/i, /statement\s+balance/i]

function lastMoneyOnLine(text: string): number | null {
  const matches = text.match(new RegExp(MONEY_PATTERN.source, 'g'))
  if (!matches || matches.length === 0) return null
  return parseMoneyStr(matches[matches.length - 1])
}

function detectStatementEndDate(lines: { text: string }[], fallbackYear?: number): Date | null {
  // Ranges — the closing date is the second (later) one. Both numeric and
  // textual ("for May 8, 2026 to June 8, 2026", a common Bank of America header).
  const rangePatterns = [
    /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*(?:-|–|—|to|through|thru)\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /([A-Za-z]{3,9}\.?\s+\d{1,2}(?:,?\s*\d{4})?)\s*(?:-|–|—|to|through|thru)\s*([A-Za-z]{3,9}\.?\s+\d{1,2},?\s*\d{4})/i,
  ]
  const singlePatterns = [
    /(?:statement|closing|ending|billing)\s*(?:cycle\s*)?(?:date|period)?\D{0,16}(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /as of\s+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /(?:statement|closing|billing)\s*(?:cycle\s*)?(?:date|period|ending)?\D{0,8}([A-Za-z]{3,9}\.?\s+\d{1,2},?\s*\d{4})/i,
  ]
  for (const line of lines) {
    for (const rp of rangePatterns) {
      const m = line.text.match(rp)
      if (m) {
        const d = parseDateFlexible(m[2], fallbackYear)
        if (d) return d
      }
    }
    for (const sp of singlePatterns) {
      const m = line.text.match(sp)
      if (m) {
        const d = parseDateFlexible(m[1], fallbackYear)
        if (d) return d
      }
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
  // The balance line often carries the close date too ("Ending balance on
  // June 8, 2026  $2,898.78") — the most reliable source, so capture it here.
  let balanceLineDate: Date | null = null
  for (const tier of BALANCE_TIERS) {
    for (const line of lines) {
      if (!tier.test(line.text) || BALANCE_EXCLUDE.test(line.text)) continue
      const amt = lastMoneyOnLine(line.text)
      if (amt !== null && amt !== 0) {
        endingBalance = amt
        balanceLineDate = parseDateFlexible(line.text, fallbackYear)
        break
      }
    }
    if (endingBalance !== null) break
  }
  if (endingBalance === null) return null
  return { endingBalance, endDate: balanceLineDate ?? detectStatementEndDate(lines, fallbackYear) }
}
