import { describe, it, expect } from 'vitest'
import { suggestSpokeImports, analyzeCoverage } from './import-suggestions'
import type { Transaction } from './types'

let id = 1
function txn(over: { amount: number; description?: string; categoryId?: Transaction['categoryId']; transferPairId?: number | null; merchantName?: string | null }): Transaction {
  return {
    id: id++,
    accountId: 1,
    date: new Date('2026-03-10'),
    description: over.description ?? 'x',
    originalDescription: over.description ?? 'x',
    amount: over.amount,
    categoryId: over.categoryId ?? null,
    confidence: 1,
    isReviewed: true,
    isRecurring: false,
    merchantName: over.merchantName ?? null,
    notes: '',
    transferPairId: over.transferPairId ?? null,
    source: 'import',
    uploadId: 1,
    createdAt: new Date('2026-03-10'),
  }
}

describe('suggestSpokeImports', () => {
  it('surfaces card/loan payments ranked by total dollars', () => {
    const txns = [
      txn({ amount: -400, description: 'CHASE CREDIT CARD PAYMENT', categoryId: 'debt_payment' }),
      txn({ amount: -350, description: 'CHASE CREDIT CARD PAYMENT', categoryId: 'debt_payment' }),
      txn({ amount: -1800, description: 'WELLS FARGO MORTGAGE PAYMENT', categoryId: 'debt_payment' }),
      txn({ amount: -42, description: 'STARBUCKS', categoryId: 'dining' }),
    ]
    const s = suggestSpokeImports(txns)
    expect(s[0].label).toContain('WELLS')
    expect(s[0].total).toBe(1800)
    expect(s[1].total).toBe(750) // two Chase payments merged
    expect(s.find((x) => x.label.includes('STARBUCKS'))).toBeUndefined()
  })

  it('ignores transfers already matched to an imported account', () => {
    const txns = [
      txn({ amount: -500, description: 'ONLINE TRANSFER TO SAVINGS', categoryId: 'transfer', transferPairId: 99 }),
    ]
    expect(suggestSpokeImports(txns)).toEqual([])
  })

  it('filters out accounts already imported by label', () => {
    const txns = [txn({ amount: -400, description: 'AMEX PAYMENT', categoryId: 'debt_payment', merchantName: 'Amex' })]
    expect(suggestSpokeImports(txns, ['Amex Gold'])).toEqual([])
  })

  it('recognizes an already-imported account despite spacing and decoration', () => {
    // The old substring check missed this exact case and pushed users into
    // creating a duplicate account from the "Import next" button.
    const txns = [
      txn({ amount: -400, description: 'CAPITAL ONE ONLINE PMT', categoryId: 'debt_payment' }),
    ]
    expect(suggestSpokeImports(txns, ['Capital One Venture ••1234'])).toEqual([])
  })

  it('does not let a short token wipe out unrelated suggestions', () => {
    const txns = [
      txn({ amount: -1800, description: 'WELLS FARGO MORTGAGE PAYMENT', categoryId: 'debt_payment' }),
    ]
    expect(suggestSpokeImports(txns, ['BoA'])).toHaveLength(1)
  })

  it('keeps the destination last-four so the user can recognize the account', () => {
    // BofA wording: without the digits this used to label as the useless "BANKING CHK"
    const txns = [
      txn({ amount: -500, description: 'Online Banking transfer to CHK 5678', categoryId: 'transfer' }),
    ]
    const s = suggestSpokeImports(txns)
    expect(s[0].label).toBe('Checking ••5678')
    expect(s[0].sample).toBe('Online Banking transfer to CHK 5678')
  })

  it('splits transfers to two different accounts into two suggestions', () => {
    const txns = [
      txn({ amount: -500, description: 'Online Banking transfer to CHK 5678', categoryId: 'transfer' }),
      txn({ amount: -300, description: 'Online Banking transfer to CHK 3421', categoryId: 'transfer' }),
    ]
    expect(suggestSpokeImports(txns)).toHaveLength(2)
  })

  it('drops a suggestion whose last-four matches an imported account', () => {
    const txns = [
      txn({ amount: -500, description: 'Online Banking transfer to CHK 5678', categoryId: 'transfer' }),
    ]
    expect(suggestSpokeImports(txns, ['Her Checking', '••5678'])).toEqual([])
  })

  it('infers savings for a savings transfer so the deep link creates the right type', () => {
    const txns = [
      txn({ amount: -400, description: 'TRANSFER TO SAV 9012', categoryId: 'transfer' }),
    ]
    const s = suggestSpokeImports(txns)
    expect(s[0].label).toBe('Savings ••9012')
    expect(s[0].type).toBe('savings')
  })

  it('ignores regular spending', () => {
    const txns = [txn({ amount: -60, description: 'WHOLE FOODS', categoryId: 'groceries' })]
    expect(suggestSpokeImports(txns)).toEqual([])
  })

  it('infers account type so a deep-linked import is created with the right type', () => {
    const txns = [
      txn({ amount: -400, description: 'CHASE CREDIT CARD PAYMENT', categoryId: 'debt_payment' }),
      txn({ amount: -1800, description: 'WELLS FARGO MORTGAGE PAYMENT', categoryId: 'debt_payment' }),
      txn({ amount: -500, description: 'ONLINE TRANSFER TO BROKERAGE', categoryId: 'transfer' }),
    ]
    const s = suggestSpokeImports(txns)
    expect(s.find((x) => x.label.includes('CHASE'))?.type).toBe('credit')
    expect(s.find((x) => x.label.includes('WELLS'))?.type).toBe('loan')
    expect(s.find((x) => x.label.includes('BROKERAGE'))?.type).toBe('checking')
  })
})

describe('analyzeCoverage', () => {
  it('reports 100% when all outflow is real spending', () => {
    const txns = [
      txn({ amount: -60, description: 'WHOLE FOODS', categoryId: 'groceries' }),
      txn({ amount: -20, description: 'NETFLIX', categoryId: 'subscriptions' }),
      txn({ amount: 5000, description: 'PAYROLL', categoryId: 'income_salary' }),
    ]
    const c = analyzeCoverage(txns)
    expect(c.untracedTotal).toBe(0)
    expect(c.coveragePct).toBe(100)
  })

  it('counts money flowing to unimported accounts as untraced', () => {
    const txns = [
      txn({ amount: -100, description: 'WHOLE FOODS', categoryId: 'groceries' }), // traced
      txn({ amount: -300, description: 'AMEX PAYMENT', categoryId: 'debt_payment' }), // untraced
    ]
    const c = analyzeCoverage(txns)
    expect(c.tracedTotal).toBe(100)
    expect(c.untracedTotal).toBe(300)
    expect(c.coveragePct).toBe(25) // 100 / 400
    expect(c.suggestions[0].label).toContain('AMEX')
  })

  it('treats a reconciled transfer as traced', () => {
    const txns = [
      txn({ amount: -500, description: 'ONLINE TRANSFER', categoryId: 'transfer', transferPairId: 7 }),
    ]
    const c = analyzeCoverage(txns)
    expect(c.untracedTotal).toBe(0)
    expect(c.coveragePct).toBe(100)
  })

  it('still reports untraced money when the spoke is already imported (no suggestion to show)', () => {
    // CoverageCard relies on this: % can be < 100 with zero "import next" buttons.
    const txns = [txn({ amount: -300, description: 'AMEX PAYMENT', categoryId: 'debt_payment' })]
    const c = analyzeCoverage(txns, ['Amex'])
    expect(c.untracedTotal).toBe(300)
    expect(c.coveragePct).toBe(0)
    expect(c.suggestions).toEqual([])
  })
})
