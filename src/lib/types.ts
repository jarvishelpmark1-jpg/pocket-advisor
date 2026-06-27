export type AccountType = 'checking' | 'savings' | 'credit' | 'money_market' | 'investment' | 'loan' | 'manual_asset'

export interface Account {
  id?: number
  name: string
  type: AccountType
  institution: string
  lastFour?: string
  /**
   * Known reference balance at {@link anchorDate}. The account's *current*
   * balance is derived: anchorBalance + every transaction dated after the
   * anchor (see deriveAccountBalance). For credit/loan accounts this is the
   * amount owed (a positive number). Never edit this to "the live balance" —
   * editing re-anchors to a new (value, date) pair.
   */
  anchorBalance: number
  anchorDate: Date
  color: string
  createdAt: Date
  updatedAt: Date
}

export type CategoryId =
  | 'housing' | 'utilities' | 'groceries' | 'dining' | 'transportation'
  | 'auto' | 'healthcare' | 'entertainment' | 'shopping' | 'personal_care'
  | 'education' | 'travel' | 'subscriptions' | 'insurance' | 'savings_investment'
  | 'debt_payment' | 'gifts_donations' | 'pets' | 'kids_family'
  | 'income_salary' | 'income_freelance' | 'income_interest' | 'income_refund' | 'income_other'
  | 'transfer' | 'atm_cash' | 'fees' | 'other'

export interface Category {
  id: CategoryId
  name: string
  icon: string
  color: string
  group: 'needs' | 'wants' | 'savings' | 'income' | 'transfer'
}

export interface Transaction {
  id?: number
  accountId: number
  date: Date
  description: string
  originalDescription: string
  amount: number
  categoryId: CategoryId | null
  confidence: number
  isReviewed: boolean
  isRecurring: boolean
  merchantName: string | null
  notes: string
  /** id of the opposite leg when this is one side of an internal transfer / card payment, else null */
  transferPairId: number | null
  /** how this transaction entered the ledger */
  source: 'import' | 'manual'
  /** id of the originating Upload, or 0 for manually-entered transactions */
  uploadId: number
  createdAt: Date
}

export interface Upload {
  id?: number
  accountId: number
  filename: string
  transactionCount: number
  autoClassified: number
  needsReview: number
  uploadedAt: Date
  periodStart: Date | null
  periodEnd: Date | null
}

export interface UserRule {
  id?: number
  pattern: string
  categoryId: CategoryId
  createdAt: Date
}

export type GoalKind = 'house' | 'emergency' | 'savings' | 'debt_payoff' | 'custom'

export interface Goal {
  id?: number
  kind: GoalKind
  name: string
  target: number
  /** amount set aside so far (manually tracked) */
  current: number
  /** optional intended monthly contribution */
  monthlyContribution: number
  createdAt: Date
  updatedAt: Date
}

export interface MonthlySnapshot {
  id?: number
  month: string
  totalIncome: number
  totalExpenses: number
  totalSavings: number
  savingsRate: number
  netWorth: number
  categoryBreakdown: Record<string, number>
  createdAt: Date
}

export interface RecurringTransaction {
  merchantName: string
  categoryId: CategoryId | null
  averageAmount: number
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'
  lastSeen: Date
  count: number
}

export interface ClassificationResult {
  categoryId: CategoryId
  confidence: number
  source: 'merchant_db' | 'pattern' | 'keyword' | 'user_rule' | 'amount_heuristic' | 'recurring'
  merchantName: string | null
}

export interface ParsedTransaction {
  date: Date
  description: string
  amount: number
  type?: 'credit' | 'debit'
}

/**
 * The statement's closing position, when a parser can detect it. `endingBalance`
 * is the value as it appears in the file: signed cash for OFX (negative = owed),
 * the printed amount for PDF/CSV. The upload pipeline normalizes it into the
 * account's anchor terms (see processUpload).
 */
export interface StatementMetadata {
  endingBalance: number
  endDate: Date | null
}

/** What a parser returns: the transactions plus optional statement-level metadata. */
export interface ParseResult {
  transactions: ParsedTransaction[]
  statement: StatementMetadata | null
}

export interface UploadResult {
  total: number
  autoClassified: number
  needsReview: number
  duplicatesSkipped: number
  transfersMatched: number
  transactions: Transaction[]
  /** set when the statement's ending balance re-anchored the account */
  anchorUpdated: { balance: number; date: Date; isLiability: boolean } | null
}
