import { describe, it, expect } from 'vitest'
import { planImports, type PlanEntry } from './upload-plan'
import type { ParsedStatementFile } from './upload-processor'
import type { StatementIdentity } from './statement-identify'
import type { Account, AccountType } from './types'

let nextKey = 0

function entry(
  filename: string,
  identity: Partial<StatementIdentity> = {}
): PlanEntry {
  const parsed: ParsedStatementFile = {
    filename,
    kind: 'pdf',
    transactions: [{ date: new Date(2026, 5, 1), description: 'X', amount: -1 }],
    statement: null,
    identity: { institution: null, accountType: null, lastFour: null, ...identity },
    periodStart: new Date(2026, 4, 9),
    periodEnd: new Date(2026, 5, 8),
  }
  return { key: nextKey++, parsed }
}

function account(id: number, over: Partial<Account> & { type?: AccountType } = {}): Account {
  return {
    id,
    name: over.name ?? 'Account',
    type: over.type ?? 'checking',
    institution: over.institution ?? '',
    lastFour: over.lastFour,
    anchorBalance: 0,
    anchorDate: new Date(2026, 5, 1),
    color: '#000',
    createdAt: new Date(2026, 5, 1),
    updatedAt: new Date(2026, 5, 1),
  }
}

describe('planImports', () => {
  it('groups a year of statements for one existing account into a single confirm', () => {
    const accounts = [account(1, { name: 'Chase Card', lastFour: '3477', type: 'credit' })]
    const entries = Array.from({ length: 12 }, (_, i) =>
      entry(`statement-${i}.pdf`, { institution: 'Chase', lastFour: '3477', accountType: 'credit' })
    )
    const plan = planImports(entries, accounts, [])
    expect(plan).toHaveLength(1)
    expect(plan[0].target).toEqual({ kind: 'existing', accountId: 1, reason: 'fingerprint' })
    expect(plan[0].entryKeys).toHaveLength(12)
  })

  it('proposes one new account when files disagree only by missing fields', () => {
    // Some Apple Card PDFs surface the last four, some don't — same account.
    const entries = [
      entry('apple-jan.pdf', { institution: 'Apple Card', accountType: 'credit' }),
      entry('apple-feb.pdf', { institution: 'Apple Card', accountType: 'credit', lastFour: '9001' }),
    ]
    const plan = planImports(entries, [], [])
    expect(plan).toHaveLength(1)
    expect(plan[0].target).toEqual({ kind: 'new', name: 'Apple Card ••9001', type: 'credit' })
  })

  it('keeps two different card numbers as two proposed accounts', () => {
    const entries = [
      entry('a.pdf', { institution: 'Chase', accountType: 'credit', lastFour: '3477' }),
      entry('b.pdf', { institution: 'Chase', accountType: 'credit', lastFour: '8821' }),
    ]
    const plan = planImports(entries, [], [])
    expect(plan).toHaveLength(2)
  })

  it('proposes a new account for a first-ever import even with no identity', () => {
    const plan = planImports([entry('mystery.csv')], [], [])
    expect(plan).toHaveLength(1)
    expect(plan[0].target.kind).toBe('new')
  })

  it('asks instead of guessing when accounts exist and the file has no identity', () => {
    const plan = planImports([entry('mystery.csv')], [account(1)], [])
    expect(plan[0].target).toEqual({ kind: 'unresolved' })
  })

  it('lets the deep-link preset fill gaps but never override the file', () => {
    const entries = [entry('capone.pdf', { institution: 'Capital One', accountType: 'credit' })]
    const plan = planImports(entries, [], [], { name: 'CAPITAL ONE', type: 'loan' })
    // file says credit — preset's 'loan' must not win
    expect(plan[0].target).toEqual({ kind: 'new', name: 'Capital One Credit Card', type: 'credit' })
  })

  it('routes a deep-linked file to its existing account instead of creating a duplicate', () => {
    const accounts = [account(1, { name: 'Capital One Venture', type: 'credit' })]
    const entries = [entry('capone.pdf', { institution: 'Capital One', accountType: 'credit' })]
    const plan = planImports(entries, accounts, [], { name: 'CAPITAL ONE', type: 'credit' })
    expect(plan[0].target).toEqual({ kind: 'existing', accountId: 1, reason: 'institution' })
  })

  it('splits matched and unmatched files into separate groups', () => {
    const accounts = [account(1, { name: 'Chase Checking', institution: 'Chase' })]
    const entries = [
      entry('chase.pdf', { institution: 'Chase' }),
      entry('boa.pdf', { institution: 'Bank of America', accountType: 'checking' }),
    ]
    const plan = planImports(entries, accounts, [])
    expect(plan).toHaveLength(2)
    expect(plan[0].target.kind).toBe('existing')
    expect(plan[1].target.kind).toBe('new')
  })
})
