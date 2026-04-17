export type AccountType = 'checking' | 'savings' | 'credit' | 'money_market' | 'investment' | 'loan'

export interface Account {
  id?: number
  name: string
  type: AccountType
  institution: string
  lastFour?: string
  balance: number
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

export interface UploadResult {
  total: number
  autoClassified: number
  needsReview: number
  duplicatesSkipped: number
  transactions: Transaction[]
}
