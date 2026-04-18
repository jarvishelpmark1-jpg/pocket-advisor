import type { CategoryId, ClassificationResult, ParsedTransaction, UserRule } from './types'
import { matchMerchant } from './merchants'
import { db } from './db'

const KEYWORD_MAP: Record<string, CategoryId> = {
  'GROCERY': 'groceries', 'GROCER': 'groceries', 'SUPERMARKET': 'groceries',
  'FOOD LION': 'groceries', 'MARKET BASKET': 'groceries',

  'RESTAURANT': 'dining', 'CAFE': 'dining', 'COFFEE': 'dining', 'GRILL': 'dining',
  'BAR ': 'dining', 'BREW': 'dining', 'PIZZA': 'dining', 'SUSHI': 'dining',
  'BISTRO': 'dining', 'TAVERN': 'dining', 'PUB ': 'dining', 'DINER': 'dining',
  'BAKERY': 'dining', 'EATERY': 'dining', 'KITCHEN': 'dining', 'TAQUERIA': 'dining',
  'BURRITO': 'dining', 'WINGS': 'dining', 'BBQ': 'dining', 'STEAKHOUSE': 'dining',
  'RAMEN': 'dining', 'POKE': 'dining', 'SMOOTHIE': 'dining', 'DONUT': 'dining',
  'BAGEL': 'dining', 'SANDWICH': 'dining', 'CATERING': 'dining',
  'NOODLE': 'dining', 'WOK ': 'dining', 'THAI ': 'dining',

  'GAS STATION': 'transportation', 'FUEL': 'transportation', 'GASOLINE': 'transportation',
  'PETROL': 'transportation',

  'ELECTRIC': 'utilities', 'WATER BILL': 'utilities', 'INTERNET': 'utilities',
  'CABLE': 'utilities', 'PHONE BILL': 'utilities', 'WIRELESS': 'utilities',
  'BROADBAND': 'utilities', 'SEWER': 'utilities', 'TRASH': 'utilities',
  'WASTE MGMT': 'utilities', 'WASTE MANAGEMENT': 'utilities',

  'DOCTOR': 'healthcare', 'HOSPITAL': 'healthcare', 'MEDICAL': 'healthcare',
  'PHARMACY': 'healthcare', 'CLINIC': 'healthcare', 'URGENT CARE': 'healthcare',
  'DENTIST': 'healthcare', 'DENTAL': 'healthcare', 'THERAPY': 'healthcare',
  'CHIROPR': 'healthcare', 'DERMAT': 'healthcare', 'OPTOM': 'healthcare',
  'LABORAT': 'healthcare', 'DIAGNOS': 'healthcare', 'HEALTH ': 'healthcare',

  'GYM': 'personal_care', 'FITNESS': 'personal_care',
  'SALON': 'personal_care', 'BARBER': 'personal_care', 'SPA ': 'personal_care',
  'NAILS': 'personal_care', 'BEAUTY': 'personal_care', 'YOGA': 'personal_care',

  'AMAZON': 'shopping', 'ONLINE PURCHASE': 'shopping', 'RETAIL': 'shopping',
  'OUTLET': 'shopping', 'APPAREL': 'shopping', 'FURNITURE': 'shopping',
  'HARDWARE': 'shopping', 'JEWELRY': 'shopping',

  'INSURANCE': 'insurance', 'PREMIUM': 'insurance',

  'TUITION': 'education', 'SCHOOL': 'education', 'UNIVERSITY': 'education',
  'COLLEGE': 'education',

  'DAYCARE': 'kids_family', 'CHILD CARE': 'kids_family', 'CHILDCARE': 'kids_family',
  'PRESCHOOL': 'kids_family',

  'PET ': 'pets', 'VET ': 'pets', 'VETERINAR': 'pets', 'KENNEL': 'pets',

  'DONATION': 'gifts_donations', 'CHARITY': 'gifts_donations', 'TITHE': 'gifts_donations',
  'CHURCH': 'gifts_donations', 'NONPROFIT': 'gifts_donations', 'OFFERING': 'gifts_donations',

  'HOTEL': 'travel', 'MOTEL': 'travel', 'AIRLINE': 'travel', 'FLIGHT': 'travel',
  'RESORT': 'travel', 'CRUISE': 'travel', 'AIRPORT': 'travel',

  'RENT ': 'housing', 'MORTGAGE': 'housing', 'LEASE ': 'housing',
  'LANDLORD': 'housing', 'HOA ': 'housing',

  'SUBSCRIPTION': 'subscriptions', 'MEMBERSHIP': 'subscriptions',

  'OVERDRAFT': 'fees', 'NSF': 'fees', 'INSUFFICIENT': 'fees',
  'LATE FEE': 'fees', 'PENALTY': 'fees', 'SERVICE FEE': 'fees',
  'MAINTENANCE FEE': 'fees', 'MONTHLY FEE': 'fees',

  'STUDENT LOAN': 'debt_payment', 'LOAN PMT': 'debt_payment',
  'MINIMUM PAYMENT': 'debt_payment',

  'CAR WASH': 'auto', 'OIL CHANGE': 'auto', 'TIRE': 'auto', 'AUTO REPAIR': 'auto',
  'MECHANIC': 'auto', 'JIFFY LUBE': 'auto', 'AUTOZONE': 'auto',

  'MOVIE': 'entertainment', 'CINEMA': 'entertainment', 'THEATER': 'entertainment',
  'CONCERT': 'entertainment', 'TICKET': 'entertainment', 'BOWLING': 'entertainment',
  'ARCADE': 'entertainment', 'MUSEUM': 'entertainment',

  'ATM': 'atm_cash', 'CASH WITHDRAWAL': 'atm_cash', 'WITHDRAW': 'atm_cash',
}

function cleanForClassification(description: string): string {
  let d = description.toUpperCase()

  d = d.replace(/^(POS\s*(DEBIT|PURCHASE|TRANS(ACTION)?)|DEBIT\s*CARD\s*(PURCHASE)?|CHECK\s*(CRD|CARD)\s*PURCHASE|VISA\s*(DEBIT|CHECK|PURCHASE)|MASTERCARD\s*(DEBIT|PURCHASE)?|PURCHASE\s*AUTHORIZED(\s*ON\s*\d{1,2}\/\d{1,2})?|RECURRING\s*(DEBIT|PAYMENT|PMT)|PRE\s*AUTH(ORIZED)?\s*(ACH|DEBIT)|ACH\s*(DEBIT|CREDIT|PAYMENT|PMT)|ELECTRONIC\s*(DEBIT|CREDIT|PMT|PAYMENT)|CHECKCARD\s*\d*|PENDING\s*|POINT\s*OF\s*SALE\s*)\s*[-–—:.]?\s*/i, '')

  d = d.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, '')
  d = d.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')

  d = d.replace(/\b(CARD|REF|TRACE|AUTH|CONF|SEQ|TRANS|TXN)\s*[#:]?\s*\d+/gi, '')
  d = d.replace(/#\d{3,}/g, '')
  d = d.replace(/\bX{2,}\d{2,4}\b/g, '')
  d = d.replace(/\b\d{6,}\b/g, '')

  d = d.replace(/\s+[A-Z]{2}\s+\d{5}(-\d{4})?\s*$/, '')
  d = d.replace(/\s+[A-Z]+\s+[A-Z]{2}\s*$/, '')

  d = d.replace(/\s+(US|USA|CA|UK|GB)\s*$/, '')

  d = d.replace(/\s*[-#]\s*\d+\s*$/, '')
  d = d.replace(/\s+STORE\s*#?\s*\d+/gi, '')

  d = d.replace(/^SQ\s*\*\s*/i, '')
  d = d.replace(/^TST\s*\*\s*/i, '')
  d = d.replace(/^SP\s*\*\s*/i, '')
  d = d.replace(/^IN\s*\*\s*/i, '')
  d = d.replace(/^PP\s*\*\s*/i, '')

  d = d.replace(/[*#]+/g, ' ')
  d = d.replace(/\s+/g, ' ').trim()

  return d
}

function classifyByKeywords(description: string): ClassificationResult | null {
  const cleaned = cleanForClassification(description)
  for (const [keyword, category] of Object.entries(KEYWORD_MAP)) {
    if (cleaned.includes(keyword)) {
      return {
        categoryId: category,
        confidence: 0.85,
        source: 'keyword',
        merchantName: null,
      }
    }
  }
  return null
}

function classifyByAmountHeuristic(amount: number, description: string): ClassificationResult | null {
  const upper = cleanForClassification(description)
  const absAmount = Math.abs(amount)

  if (amount > 0) {
    if (absAmount > 500 && /DIRECT|DEP|PAYROLL|ADP|GUSTO/i.test(upper)) {
      return { categoryId: 'income_salary', confidence: 0.95, source: 'amount_heuristic', merchantName: 'Payroll' }
    }
    if (absAmount < 5 && /INT|INTEREST/i.test(upper)) {
      return { categoryId: 'income_interest', confidence: 0.9, source: 'amount_heuristic', merchantName: 'Interest' }
    }
  }

  if (amount < 0 && absAmount < 25 && /SUBSCRIPTION|RECURRING|MONTHLY/i.test(upper)) {
    return { categoryId: 'subscriptions', confidence: 0.85, source: 'amount_heuristic', merchantName: null }
  }

  if (amount < 0 && absAmount > 500 && absAmount < 5000 && /RENT|LEASE|PROPERTY|LANDLORD/i.test(upper)) {
    return { categoryId: 'housing', confidence: 0.9, source: 'amount_heuristic', merchantName: null }
  }

  if (amount < 0 && absAmount > 50 && absAmount < 500 && /PAYMENT|PMT|PAY/i.test(upper) && /CARD|CREDIT|BALANCE/i.test(upper)) {
    return { categoryId: 'debt_payment', confidence: 0.85, source: 'amount_heuristic', merchantName: null }
  }

  return null
}

async function classifyByUserRules(description: string): Promise<ClassificationResult | null> {
  const rules = await db.userRules.toArray()
  const cleaned = cleanForClassification(description)

  for (const rule of rules) {
    if (cleaned.includes(rule.pattern.toUpperCase())) {
      return {
        categoryId: rule.categoryId,
        confidence: 0.98,
        source: 'user_rule',
        merchantName: null,
      }
    }
  }
  return null
}

const TRANSFER_PATTERNS = [
  /\bTRANSFER\b/i, /\bXFER\b/i, /\bTFR\b/i, /\bONLINE\s*TRANSFER/i,
  /\bBETWEEN\s*ACCT/i, /\bINTERNAL\s*TRANSFER/i,
  /\bWIRE\s*(IN|OUT|TRANSFER)/i, /\bACH\s*TRANSFER/i,
]

function isLikelyTransfer(description: string): boolean {
  return TRANSFER_PATTERNS.some(p => p.test(description))
}

const INCOME_PATTERNS: [RegExp, CategoryId, number][] = [
  [/DIRECT\s*DEP|PAYROLL|SALARY|WAGE|ADP\b|GUSTO|PAYCHEX/i, 'income_salary', 0.95],
  [/DIVIDEND/i, 'income_interest', 0.9],
  [/INTEREST\s*(?:PAID|EARN|CREDIT)|INT\s*(?:PAID|EARN)/i, 'income_interest', 0.9],
  [/REFUND|REBATE|CASHBACK|CASH\s*BACK/i, 'income_refund', 0.9],
  [/FREELANCE|CONTRACT|CONSULT|INVOICE/i, 'income_freelance', 0.85],
  [/TAX\s*REFUND|IRS\s*TREAS/i, 'income_refund', 0.95],
  [/DEPOSIT|DEP\b/i, 'income_other', 0.8],
]

function classifyIncome(description: string, amount: number): ClassificationResult {
  const cleaned = cleanForClassification(description)
  for (const [pattern, category, conf] of INCOME_PATTERNS) {
    if (pattern.test(cleaned)) {
      return { categoryId: category, confidence: conf, source: 'pattern', merchantName: null }
    }
  }

  if (amount > 500) {
    return { categoryId: 'income_salary', confidence: 0.75, source: 'pattern', merchantName: null }
  }

  return { categoryId: 'income_other', confidence: 0.7, source: 'pattern', merchantName: null }
}

const CHECK_PATTERN = /^CHECK\s*#?\s*\d*/i

export async function classifyTransaction(
  txn: ParsedTransaction
): Promise<ClassificationResult> {
  const desc = txn.description
  const cleaned = cleanForClassification(desc)

  const userResult = await classifyByUserRules(desc)
  if (userResult) return userResult

  const merchantResult = matchMerchant(desc)
  if (merchantResult) {
    return {
      categoryId: merchantResult.category,
      confidence: 0.95,
      source: 'merchant_db',
      merchantName: merchantResult.name,
    }
  }
  const cleanedMerchantResult = matchMerchant(cleaned)
  if (cleanedMerchantResult) {
    return {
      categoryId: cleanedMerchantResult.category,
      confidence: 0.95,
      source: 'merchant_db',
      merchantName: cleanedMerchantResult.name,
    }
  }

  if (CHECK_PATTERN.test(cleaned)) {
    return { categoryId: 'other', confidence: 0.7, source: 'pattern', merchantName: 'Check' }
  }

  if (isLikelyTransfer(desc)) {
    return { categoryId: 'transfer', confidence: 0.9, source: 'pattern', merchantName: null }
  }

  if (txn.amount > 0) {
    return classifyIncome(desc, txn.amount)
  }

  const amountResult = classifyByAmountHeuristic(txn.amount, desc)
  if (amountResult) return amountResult

  const keywordResult = classifyByKeywords(desc)
  if (keywordResult) return keywordResult

  return {
    categoryId: 'other',
    confidence: 0.5,
    source: 'keyword',
    merchantName: null,
  }
}

export async function learnFromCorrection(
  description: string,
  categoryId: CategoryId
): Promise<number> {
  const cleaned = cleanForClassification(description)
    .replace(/[#\d]{4,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const words = cleaned.split(' ')
  const pattern = words.length > 3
    ? words.slice(0, 3).join(' ')
    : cleaned

  if (pattern.length < 3) return 0

  const existing = await db.userRules.where('pattern').equals(pattern).first()
  if (existing) {
    await db.userRules.update(existing.id!, { categoryId })
  } else {
    await db.userRules.add({ pattern, categoryId, createdAt: new Date() })
  }

  const patternUpper = pattern.toUpperCase()
  const similar = await db.transactions
    .filter(t =>
      !t.isReviewed &&
      cleanForClassification(t.description).toUpperCase().includes(patternUpper)
    )
    .toArray()

  let applied = 0
  if (similar.length > 0) {
    await db.transaction('rw', db.transactions, async () => {
      for (const txn of similar) {
        await db.transactions.update(txn.id!, {
          categoryId,
          isReviewed: true,
          confidence: 0.98,
          merchantName: txn.merchantName,
        })
        applied++
      }
    })
  }

  return applied
}

export { cleanForClassification }
export { type UserRule }
