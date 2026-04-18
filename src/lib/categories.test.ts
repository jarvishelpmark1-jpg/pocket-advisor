import { describe, it, expect } from 'vitest'
import { getCategoryColor, getCategoryName, CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, CATEGORY_MAP } from './categories'

describe('getCategoryColor', () => {
  it('returns correct color for known categories', () => {
    expect(getCategoryColor('groceries')).toBe('#10B981')
    expect(getCategoryColor('dining')).toBe('#F97316')
    expect(getCategoryColor('housing')).toBe('#8B5CF6')
  })

  it('returns fallback for null', () => {
    expect(getCategoryColor(null)).toBe('#6B7280')
  })

  it('returns fallback for unknown category', () => {
    expect(getCategoryColor('nonexistent' as any)).toBe('#6B7280')
  })
})

describe('getCategoryName', () => {
  it('returns correct name for known categories', () => {
    expect(getCategoryName('groceries')).toBe('Groceries')
    expect(getCategoryName('dining')).toBe('Dining')
    expect(getCategoryName('income_salary')).toBe('Salary')
  })

  it('returns Uncategorized for null', () => {
    expect(getCategoryName(null)).toBe('Uncategorized')
  })

  it('returns Other for unknown category', () => {
    expect(getCategoryName('nonexistent' as any)).toBe('Other')
  })
})

describe('CATEGORIES', () => {
  it('has unique ids', () => {
    const ids = CATEGORIES.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every category has all required fields', () => {
    for (const cat of CATEGORIES) {
      expect(cat.id).toBeTruthy()
      expect(cat.name).toBeTruthy()
      expect(cat.icon).toBeTruthy()
      expect(cat.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(['needs', 'wants', 'savings', 'income', 'transfer']).toContain(cat.group)
    }
  })

  it('CATEGORY_MAP contains all categories', () => {
    expect(CATEGORY_MAP.size).toBe(CATEGORIES.length)
  })
})

describe('category filters', () => {
  it('EXPENSE_CATEGORIES excludes income and transfers', () => {
    for (const cat of EXPENSE_CATEGORIES) {
      expect(cat.group).not.toBe('income')
      expect(cat.group).not.toBe('transfer')
      expect(cat.group).not.toBe('savings')
    }
  })

  it('INCOME_CATEGORIES only contains income', () => {
    for (const cat of INCOME_CATEGORIES) {
      expect(cat.group).toBe('income')
    }
  })
})
