// Pure (no pdfjs, no DB) statement identification: given a file's content —
// OFX tags, PDF text lines, or just the filename — work out WHOSE statement it
// is (institution), WHAT it is (checking/savings/credit/loan), and WHICH
// account it belongs to (last four digits). The upload flow uses this to stop
// asking the user questions the file can already answer.

/** The subset of account types a statement file can actually be. */
export type StatementAccountType = 'checking' | 'savings' | 'credit' | 'loan'

export interface StatementIdentity {
  /** Canonical institution name ("Bank of America"), or null when unrecognized. */
  institution: string | null
  accountType: StatementAccountType | null
  lastFour: string | null
}

export const EMPTY_IDENTITY: StatementIdentity = {
  institution: null,
  accountType: null,
  lastFour: null,
}

interface BankDef {
  /** Tested against statement text (word spacing intact). */
  pattern: RegExp
  /** Tested against the filename with all separators removed ("chase3477activity"). */
  filePattern: RegExp
  name: string
  /** Only set when the brand IS one product (Apple Card can't be a checking account). */
  type?: StatementAccountType
}

// Order matters: more specific brands before their parent (Apple Savings and
// Apple Card both mention Goldman Sachs; "Chase" must not swallow "JPMorgan").
const BANKS: BankDef[] = [
  { pattern: /apple\s*savings/i, filePattern: /applesavings/, name: 'Apple Savings', type: 'savings' },
  { pattern: /apple\s*card/i, filePattern: /applecard/, name: 'Apple Card', type: 'credit' },
  { pattern: /bank\s*of\s*america/i, filePattern: /bankofamerica|bofa/, name: 'Bank of America' },
  { pattern: /wells\s*fargo/i, filePattern: /wellsfargo/, name: 'Wells Fargo' },
  { pattern: /capital\s*one/i, filePattern: /capitalone|capone/, name: 'Capital One' },
  { pattern: /american\s*express|\bamex\b/i, filePattern: /americanexpress|amex/, name: 'American Express' },
  { pattern: /jpmorgan|\bchase\b/i, filePattern: /chase/, name: 'Chase' },
  { pattern: /\bdiscover\b/i, filePattern: /discover/, name: 'Discover' },
  { pattern: /citibank|\bciti\b/i, filePattern: /citibank|citicard|\bciti\b/, name: 'Citi' },
  { pattern: /u\.?\s?s\.?\s*bank|elan\s*financial/i, filePattern: /usbank/, name: 'US Bank' },
  { pattern: /navy\s*federal/i, filePattern: /navyfederal|nfcu/, name: 'Navy Federal' },
  { pattern: /\busaa\b/i, filePattern: /usaa/, name: 'USAA' },
  { pattern: /goldman\s*sachs|\bmarcus\b/i, filePattern: /goldman|marcus/, name: 'Goldman Sachs' },
  { pattern: /\bsofi\b/i, filePattern: /sofi/, name: 'SoFi' },
  { pattern: /\bally\b/i, filePattern: /\bally\b/, name: 'Ally' },
  { pattern: /\bpnc\b/i, filePattern: /pnc/, name: 'PNC' },
  { pattern: /td\s*bank/i, filePattern: /tdbank/, name: 'TD Bank' },
  { pattern: /\btruist\b/i, filePattern: /truist/, name: 'Truist' },
  { pattern: /fifth\s*third/i, filePattern: /fifththird|53bank/, name: 'Fifth Third' },
  { pattern: /\bsynchrony\b/i, filePattern: /synchrony/, name: 'Synchrony' },
  { pattern: /barclaycard|\bbarclays\b/i, filePattern: /barclay/, name: 'Barclays' },
  { pattern: /charles\s*schwab|\bschwab\b/i, filePattern: /schwab/, name: 'Charles Schwab' },
  { pattern: /\bfidelity\b/i, filePattern: /fidelity/, name: 'Fidelity' },
  { pattern: /\bregions\b/i, filePattern: /regions/, name: 'Regions' },
  { pattern: /key\s*bank/i, filePattern: /keybank/, name: 'KeyBank' },
  { pattern: /\bhuntington\b/i, filePattern: /huntington/, name: 'Huntington' },
  { pattern: /citizens\s*bank/i, filePattern: /citizens/, name: 'Citizens' },
  { pattern: /m\s*&\s*t\s*bank/i, filePattern: /mtbank|mandt/, name: 'M&T Bank' },
  { pattern: /bmo\s*(harris|bank)/i, filePattern: /bmo/, name: 'BMO' },
]

// Each signal votes for a type; the winner needs a clear margin so a checking
// statement with one stray "savings" mention doesn't get misfiled. Patterns are
// matched against the statement's HEADER region only — transaction descriptions
// ("CHASE CREDIT CARD PAYMENT") would poison a full-document scan.
const TYPE_SIGNALS: { type: StatementAccountType; pattern: RegExp; weight: number }[] = [
  { type: 'credit', pattern: /minimum\s+payment/i, weight: 3 },
  { type: 'credit', pattern: /credit\s+(limit|line)/i, weight: 3 },
  { type: 'credit', pattern: /card\s?member/i, weight: 2 },
  { type: 'credit', pattern: /credit\s+card/i, weight: 2 },
  { type: 'credit', pattern: /(purchase|cash\s+advance)s?\s+a\.?p\.?r/i, weight: 2 },
  { type: 'credit', pattern: /new\s+balance/i, weight: 1 },
  { type: 'credit', pattern: /payment\s+due\s+date/i, weight: 1 },
  { type: 'loan', pattern: /mortgage/i, weight: 3 },
  { type: 'loan', pattern: /escrow/i, weight: 2 },
  { type: 'loan', pattern: /(principal\s+balance|outstanding\s+principal)/i, weight: 3 },
  { type: 'loan', pattern: /amount\s+financed/i, weight: 2 },
  { type: 'savings', pattern: /savings\s+(account|summary|statement)/i, weight: 3 },
  { type: 'savings', pattern: /annual\s+percentage\s+yield|\bapy\b/i, weight: 2 },
  { type: 'savings', pattern: /interest\s+earned/i, weight: 1 },
  { type: 'checking', pattern: /checking\s+(account|summary|statement)/i, weight: 3 },
  { type: 'checking', pattern: /safebalance|advantage\s+banking/i, weight: 2 },
  { type: 'checking', pattern: /checks\s+paid/i, weight: 2 },
  { type: 'checking', pattern: /overdraft/i, weight: 1 },
]

function findBank(text: string): BankDef | null {
  for (const bank of BANKS) {
    if (bank.pattern.test(text)) return bank
  }
  return null
}

function scoreType(headerText: string): StatementAccountType | null {
  const scores = new Map<StatementAccountType, number>()
  for (const signal of TYPE_SIGNALS) {
    if (signal.pattern.test(headerText)) {
      scores.set(signal.type, (scores.get(signal.type) ?? 0) + signal.weight)
    }
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1])
  if (ranked.length === 0) return null
  const [winner, score] = ranked[0]
  const runnerUp = ranked[1]?.[1] ?? 0
  // A weak or contested vote is worse than admitting we don't know.
  if (score < 2 || score === runnerUp) return null
  return winner
}

// "Account ending in 1234" / "Card ending 1234" / "•••• 1234" / "XXXX-1234",
// or a full account number printed after an "Account number:" label.
const LAST_FOUR_PATTERNS = [
  /(?:account|card|acct\.?)\s*(?:number|no\.?|#)?\s*(?:ending|ends)\s*(?:in|with)?\s*:?\s*(\d{4})\b/i,
  /ending\s+in\s+(\d{4})\b/i,
  /[x*•·]{2,}\s?-?\s?(\d{4})\b/i,
]

const ACCOUNT_NUMBER_LABEL = /(?:account|card|acct\.?)\s*(?:number|no\.?|#)/i

function findLastFour(lines: string[]): string | null {
  for (const line of lines) {
    for (const pattern of LAST_FOUR_PATTERNS) {
      const m = line.match(pattern)
      if (m) return m[1]
    }
    // Full (unmasked) account number on a labeled line — require a long digit
    // run so "Account number of items: 3" can't produce garbage.
    if (ACCOUNT_NUMBER_LABEL.test(line)) {
      const digits = line.replace(ACCOUNT_NUMBER_LABEL, '').replace(/\D/g, '')
      if (digits.length >= 8) return digits.slice(-4)
    }
  }
  return null
}

/** How many lines from the top of a statement count as its header region. */
const HEADER_LINES = 60

/** Identify a statement from its extracted text lines (PDF path). */
export function identifyStatementText(lines: string[]): StatementIdentity {
  const header = lines.slice(0, HEADER_LINES)
  const headerText = header.join('\n')
  const bank = findBank(headerText)
  return {
    institution: bank?.name ?? null,
    accountType: bank?.type ?? scoreType(headerText),
    lastFour: findLastFour(header),
  }
}

const OFX_TYPE_MAP: Record<string, StatementAccountType> = {
  CHECKING: 'checking',
  SAVINGS: 'savings',
  MONEYMRKT: 'savings',
  CREDITLINE: 'loan',
}

/** Identify a statement from raw OFX/QFX content — the most reliable source. */
export function identifyOFX(content: string): StatementIdentity {
  // A credit-card statement uses a whole separate OFX message set.
  const isCard = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>|<CCACCTFROM>/i.test(content)
  const rawType = content.match(/<ACCTTYPE>\s*([A-Za-z]+)/)?.[1]?.toUpperCase()
  const accountType = isCard ? 'credit' : rawType ? OFX_TYPE_MAP[rawType] ?? null : null

  const acctId = content.match(/<ACCTID>\s*([^<\n\r]+)/)?.[1]?.trim() ?? ''
  const digits = acctId.replace(/\D/g, '')
  const lastFour = digits.length >= 4 ? digits.slice(-4) : null

  const bank = findBank(content)
  const org = content.match(/<ORG>\s*([^<\n\r]+)/)?.[1]?.trim()
  // <ORG> is sometimes a routing code ("B1") — only trust it when it reads
  // like a name.
  const institution = bank?.name ?? (org && /[A-Za-z]{3}/.test(org) ? org : null)

  return {
    institution,
    accountType: accountType ?? bank?.type ?? null,
    lastFour,
  }
}

/**
 * Identify from the filename alone — the CSV fallback ("Chase3477_Activity_
 * 20260601.CSV"). Dates and long reference numbers are stripped first so a
 * statement date can't masquerade as a card's last four.
 */
export function identifyFilename(filename: string): StatementIdentity {
  const base = filename.replace(/\.[a-z0-9]+$/i, '')
  const squashed = base.toLowerCase().replace(/[^a-z0-9]/g, '')
  const bank = BANKS.find((b) => b.filePattern.test(squashed)) ?? null

  const withoutDates = base
    .replace(/\d{4}[-_.]?\d{2}[-_.]?\d{2}/g, ' ')
    .replace(/\d{5,}/g, ' ')
  const runs = withoutDates.match(/\d{4}/g) ?? []
  // A 19xx/20xx run is far more likely a year than a card number.
  const lastFour = runs.find((r) => !/^(19|20)\d{2}$/.test(r)) ?? null

  return {
    institution: bank?.name ?? null,
    accountType: bank?.type ?? null,
    lastFour,
  }
}

/** Field-wise merge: the primary (file content) wins; the fallback fills gaps. */
export function mergeIdentities(
  primary: StatementIdentity,
  fallback: StatementIdentity
): StatementIdentity {
  return {
    institution: primary.institution ?? fallback.institution,
    accountType: primary.accountType ?? fallback.accountType,
    lastFour: primary.lastFour ?? fallback.lastFour,
  }
}

const TYPE_NAME_LABELS: Record<StatementAccountType, string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit Card',
  loan: 'Loan',
}

/** Human label for a detected type ("credit card"), for confirm-card copy. */
export function identityTypeLabel(type: StatementAccountType): string {
  return TYPE_NAME_LABELS[type].toLowerCase()
}

/**
 * Prefilled name for a new account: "Capital One Credit Card ••1234".
 * Skips the type word when the brand already says it ("Apple Card").
 * Returns '' when nothing was identified — the caller should fall back to a
 * plain text input.
 */
export function suggestedAccountName(identity: StatementIdentity): string {
  const parts: string[] = []
  if (identity.institution) parts.push(identity.institution)
  if (identity.accountType) {
    const label = TYPE_NAME_LABELS[identity.accountType]
    const redundant =
      identity.institution &&
      new RegExp(label.split(' ').pop()!, 'i').test(identity.institution)
    if (!redundant) parts.push(label)
  }
  if (identity.lastFour) parts.push(`••${identity.lastFour}`)
  return parts.join(' ')
}
