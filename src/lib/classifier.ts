import type { CategoryId, ClassificationResult, ParsedTransaction, UserRule } from './types'
import { matchMerchant } from './merchants'
import { db } from './db'

const KEYWORD_MAP: Record<string, CategoryId> = {
  'GROCERY': 'groceries', 'GROCER': 'groceries', 'SUPERMARKET': 'groceries', 'FOOD LION': 'groceries',
  'RESTAURANT': 'dining', 'CAFE': 'dining', 'COFFEE': 'dining', 'GRILL': 'dining',
  'BAR ': 'dining', 'BREW': 'dining', 'PIZZA': 'dining', 'SUSHI': 'dining', 'BISTRO': 'dining',
  'TAVERN': 'dining', 'PUB ': 'dining', 'DINER': 'dining', 'BAKERY': 'dining',
  'GAS STATION': 'transportation', 'FUEL': 'transportation', 'GASOLINE': 'transportation',
  'ELECTRIC BILL': 'utilities', 'WATER BILL': 'utilities', 'INTERNET': 'utilities',
  'CABLE': 'utilities', 'PHONE BILL': 'utilities', 'WIRELESS': 'utilities',
  'DOCTOR': 'healthcare', 'HOSPITAL': 'healthcare', 'MEDICAL': 'healthcare',
  'PHARMACY': 'healthcare', 'CLINIC': 'healthcare', 'URGENT CARE': 'healthcare',
  'DENTIST': 'healthcare', 'DENTAL': 'healthcare', 'THERAPY': 'healthcare',
  'GYM': 'personal_care', 'FITNESS': 'personal_care',
  'SALON': 'personal_care', 'BARBER': 'personal_care', 'SPA': 'personal_care',
  'AMAZON': 'shopping', 'ONLINE PURCHASE': 'shopping',
  'INSURANCE': 'insurance', 'PREMIUM': 'insurance',
  'TUITION': 'education', 'SCHOOL': 'education', 'UNIVERSITY': 'education',
  'DAYCARE': 'kids_family', 'CHILD CARE': 'kids_family',
  'PET': 'pets', 'VET': 'pets', 'ANIMAL': 'pets',
  'DONATION': 'gifts_donations', 'CHARITY': 'gifts_donations', 'TITHE': 'gifts_donations',
  'CHURCH': 'gifts_donations', 'NONPROFIT': 'gifts_donations',
  'HOTEL': 'travel', 'MOTEL': 'travel', 'AIRLINE': 'travel', 'FLIGHT': 'travel',
  'RENT': 'housing', 'MORTGAGE': 'housing', 'LEASE': 'housing',
  'SUBSCRIPTION': 'subscriptions', 'MONTHLY FEE': 'subscriptions',
}

const AUTO_PAY_PATTERNS = [
  /AUTO\s*PAY/i, /AUTOPAY/i, /SCHEDULED\s*PMT/i, /RECURRING/i,
  /ONLINE\s*PMT/i, /BILL\s*PAY/i, /EPAY/i,
]

function classifyByKeywords(description: string): ClassificationResult | null {
  const upper = description.toUpperCase()
  for (const [keyword, category] of Object.entries(KEYWORD_MAP)) {
    if (upper.includes(keyword)) {
      return {
        categoryId: category,
        confidence: 0.55,
        source: 'keyword',
        merchantName: null,
      }
    }
  }
  return null
}

function classifyByAmountHeuristic(amount: number, description: string): ClassificationResult | null {
  const upper = description.toUpperCase()
  const absAmount = Math.abs(amount)

  if (amount > 0) {
    if (absAmount > 500 && /DIRECT|DEP|PAYROLL|ADP|GUSTO/i.test(upper)) {
      return { categoryId: 'income_salary', confidence: 0.85, source: 'amount_heuristic', merchantName: 'Payroll' }
    }
    if (absAmount < 5 && /INT|INTEREST/i.test(upper)) {
      return { categoryId: 'income_interest', confidence: 0.8, source: 'amount_heuristic', merchantName: 'Interest' }
    }
  }

  if (amount < 0 && absAmount < 20 && /SUBSCRIPTION|RECURRING|MONTHLY/i.test(upper)) {
    return { categoryId: 'subscriptions', confidence: 0.65, source: 'amount_heuristic', merchantName: null }
  }

  if (amount < 0 && absAmount > 500 && absAmount < 5000 && /RENT|LEASE|PROPERTY/i.test(upper)) {
    return { categoryId: 'housing', confidence: 0.75, source: 'amount_heuristic', merchantName: null }
  }

  return null
}

async function classifyByUserRules(description: string): Promise<ClassificationResult | null> {
  const rules = await db.userRules.toArray()
  const upper = description.toUpperCase()

  for (const rule of rules) {
    if (upper.includes(rule.pattern.toUpperCase())) {
      return {
        categoryId: rule.categoryId,
        confidence: 0.95,
        source: 'user_rule',
        merchantName: null,
      }
    }
  }
  return null
}

function isLikelyTransfer(description: string): boolean {
  const upper = description.toUpperCase()
  const transferPatterns = [
    /TRANSFER/i, /XFER/i, /TFR/i, /ONLINE\s*TRANSFER/i,
    /SAVINGS/i, /CHECKING/i, /BETWEEN\s*ACCT/i,
  ]
  return transferPatterns.some(p => p.test(upper))
}

function isLikelyIncome(amount: number, description: string): boolean {
  if (amount <= 0) return false
  const incomePatterns = [
    /DIRECT\s*DEP/i, /PAYROLL/i, /SALARY/i, /WAGE/i,
    /ADP/i, /GUSTO/i, /PAYCHEX/i,
    /DIVIDEND/i, /INTEREST\s*(?:PAID|EARN)/i,
    /REFUND/i, /REBATE/i, /CASHBACK/i,
    /TAX\s*REFUND/i, /IRS\s*TREAS/i,
    /VENMO.*CASHOUT/i, /ZELLE.*FROM/i,
  ]
  return incomePatterns.some(p => p.test(description))
}

export async function classifyTransaction(
  txn: ParsedTransaction
): Promise<ClassificationResult> {
  const desc = txn.description

  const userResult = await classifyByUserRules(desc)
  if (userResult && userResult.confidence >= 0.9) return userResult

  const merchantResult = matchMerchant(desc)
  if (merchantResult) {
    return {
      categoryId: merchantResult.category,
      confidence: 0.9,
      source: 'merchant_db',
      merchantName: merchantResult.name,
    }
  }

  if (userResult) return userResult

  if (isLikelyTransfer(desc)) {
    return { categoryId: 'transfer', confidence: 0.75, source: 'pattern', merchantName: null }
  }

  if (isLikelyIncome(txn.amount, desc)) {
    const incomePatterns: [RegExp, CategoryId][] = [
      [/DIRECT\s*DEP|PAYROLL|SALARY|WAGE|ADP|GUSTO|PAYCHEX/i, 'income_salary'],
      [/DIVIDEND|INTEREST/i, 'income_interest'],
      [/REFUND|REBATE|CASHBACK/i, 'income_refund'],
      [/FREELANCE|CONTRACT|CONSULT/i, 'income_freelance'],
    ]
    for (const [pattern, category] of incomePatterns) {
      if (pattern.test(desc)) {
        return { categoryId: category, confidence: 0.8, source: 'pattern', merchantName: null }
      }
    }
    return { categoryId: 'income_other', confidence: 0.6, source: 'pattern', merchantName: null }
  }

  if (AUTO_PAY_PATTERNS.some(p => p.test(desc))) {
    const keywordResult = classifyByKeywords(desc)
    if (keywordResult) {
      keywordResult.confidence = Math.min(keywordResult.confidence + 0.1, 0.9)
      return keywordResult
    }
  }

  const keywordResult = classifyByKeywords(desc)
  if (keywordResult) return keywordResult

  const amountResult = classifyByAmountHeuristic(txn.amount, desc)
  if (amountResult) return amountResult

  return {
    categoryId: 'other',
    confidence: 0,
    source: 'keyword',
    merchantName: null,
  }
}

export async function learnFromCorrection(
  description: string,
  categoryId: CategoryId
): Promise<void> {
  const cleaned = description.replace(/[#\d]{4,}/g, '').replace(/\s+/g, ' ').trim()

  const words = cleaned.split(' ')
  const pattern = words.length > 3
    ? words.slice(0, 3).join(' ')
    : cleaned

  if (pattern.length < 3) return

  const existing = await db.userRules.where('pattern').equals(pattern).first()
  if (existing) {
    await db.userRules.update(existing.id!, { categoryId })
  } else {
    await db.userRules.add({ pattern, categoryId, createdAt: new Date() })
  }
}

export { type UserRule }
