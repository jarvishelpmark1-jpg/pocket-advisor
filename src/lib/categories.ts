import type { Category, CategoryId } from './types'

export const CATEGORIES: Category[] = [
  { id: 'housing', name: 'Housing', icon: 'Home', color: '#8B5CF6', group: 'needs' },
  { id: 'utilities', name: 'Utilities', icon: 'Zap', color: '#F59E0B', group: 'needs' },
  { id: 'groceries', name: 'Groceries', icon: 'ShoppingCart', color: '#10B981', group: 'needs' },
  { id: 'dining', name: 'Dining', icon: 'UtensilsCrossed', color: '#F97316', group: 'wants' },
  { id: 'transportation', name: 'Transport', icon: 'Car', color: '#06B6D4', group: 'needs' },
  { id: 'auto', name: 'Auto', icon: 'Wrench', color: '#64748B', group: 'needs' },
  { id: 'healthcare', name: 'Healthcare', icon: 'Heart', color: '#EF4444', group: 'needs' },
  { id: 'entertainment', name: 'Entertainment', icon: 'Tv', color: '#EC4899', group: 'wants' },
  { id: 'shopping', name: 'Shopping', icon: 'ShoppingBag', color: '#A855F7', group: 'wants' },
  { id: 'personal_care', name: 'Personal Care', icon: 'Sparkles', color: '#F472B6', group: 'wants' },
  { id: 'education', name: 'Education', icon: 'GraduationCap', color: '#3B82F6', group: 'needs' },
  { id: 'travel', name: 'Travel', icon: 'Plane', color: '#14B8A6', group: 'wants' },
  { id: 'subscriptions', name: 'Subscriptions', icon: 'Repeat', color: '#8B5CF6', group: 'wants' },
  { id: 'insurance', name: 'Insurance', icon: 'Shield', color: '#6366F1', group: 'needs' },
  { id: 'savings_investment', name: 'Savings', icon: 'PiggyBank', color: '#10B981', group: 'savings' },
  { id: 'debt_payment', name: 'Debt Payment', icon: 'CreditCard', color: '#EF4444', group: 'needs' },
  { id: 'gifts_donations', name: 'Gifts', icon: 'Gift', color: '#F472B6', group: 'wants' },
  { id: 'pets', name: 'Pets', icon: 'Dog', color: '#D97706', group: 'wants' },
  { id: 'kids_family', name: 'Family', icon: 'Users', color: '#8B5CF6', group: 'needs' },
  { id: 'income_salary', name: 'Salary', icon: 'Briefcase', color: '#10B981', group: 'income' },
  { id: 'income_freelance', name: 'Freelance', icon: 'Laptop', color: '#34D399', group: 'income' },
  { id: 'income_interest', name: 'Interest', icon: 'TrendingUp', color: '#6EE7B7', group: 'income' },
  { id: 'income_refund', name: 'Refund', icon: 'RotateCcw', color: '#A7F3D0', group: 'income' },
  { id: 'income_other', name: 'Other Income', icon: 'DollarSign', color: '#059669', group: 'income' },
  { id: 'transfer', name: 'Transfer', icon: 'ArrowLeftRight', color: '#6B7280', group: 'transfer' },
  { id: 'atm_cash', name: 'ATM / Cash', icon: 'Banknote', color: '#9CA3AF', group: 'transfer' },
  { id: 'fees', name: 'Fees', icon: 'AlertCircle', color: '#EF4444', group: 'needs' },
  { id: 'other', name: 'Other', icon: 'MoreHorizontal', color: '#6B7280', group: 'wants' },
]

export const CATEGORY_MAP = new Map<CategoryId, Category>(
  CATEGORIES.map(c => [c.id, c])
)

export function getCategoryColor(id: CategoryId | null): string {
  if (!id) return '#6B7280'
  return CATEGORY_MAP.get(id)?.color ?? '#6B7280'
}

export function getCategoryName(id: CategoryId | null): string {
  if (!id) return 'Uncategorized'
  return CATEGORY_MAP.get(id)?.name ?? 'Other'
}

export const EXPENSE_CATEGORIES = CATEGORIES.filter(c => c.group === 'needs' || c.group === 'wants')
export const INCOME_CATEGORIES = CATEGORIES.filter(c => c.group === 'income')
export const ALL_REVIEW_CATEGORIES = [...EXPENSE_CATEGORIES, ...CATEGORIES.filter(c => c.group === 'transfer')]
