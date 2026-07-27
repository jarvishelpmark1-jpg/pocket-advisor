import { describe, it, expect } from 'vitest'
import { suggestAccountForFilename, matchStatementToAccount } from './account-match'
import type { StatementIdentity } from './statement-identify'
import type { Account, AccountType, Upload } from './types'

function upload(filename: string, accountId: number): Upload {
  return {
    accountId,
    filename,
    transactionCount: 10,
    autoClassified: 8,
    needsReview: 2,
    uploadedAt: new Date(2026, 5, 1),
    periodStart: null,
    periodEnd: null,
  }
}

describe('suggestAccountForFilename', () => {
  it('matches a new month of a consistently-named export', () => {
    const past = [upload('eStmt_2026-05-08.pdf', 3), upload('eStmt_2026-04-08.pdf', 3)]
    expect(suggestAccountForFilename('eStmt_2026-06-08.pdf', past)).toBe(3)
  })

  it('keeps the last-4 in the name, so two cards at one bank stay distinct', () => {
    const past = [
      upload('Chase3477_Activity_20260501.CSV', 1),
      upload('Chase8821_Activity_20260501.CSV', 2),
    ]
    expect(suggestAccountForFilename('Chase3477_Activity_20260601.CSV', past)).toBe(1)
    expect(suggestAccountForFilename('Chase8821_Activity_20260601.CSV', past)).toBe(2)
  })

  it('refuses to guess when the same name maps to multiple accounts', () => {
    const past = [upload('statement.pdf', 1), upload('statement.pdf', 2)]
    expect(suggestAccountForFilename('statement.pdf', past)).toBeNull()
  })

  it('returns null with no prior uploads that match', () => {
    expect(suggestAccountForFilename('amex-june.pdf', [upload('chase-june.csv', 1)])).toBeNull()
  })
})

function account(
  id: number,
  over: Partial<Account> & { type?: AccountType } = {}
): Account {
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

function identity(over: Partial<StatementIdentity> = {}): StatementIdentity {
  return { institution: null, accountType: null, lastFour: null, ...over }
}

describe('matchStatementToAccount', () => {
  it('matches by last four before anything else', () => {
    const accounts = [
      account(1, { name: 'Chase Freedom', lastFour: '3477', type: 'credit' }),
      account(2, { name: 'Chase Sapphire', lastFour: '8821', type: 'credit' }),
    ]
    const m = matchStatementToAccount(identity({ lastFour: '8821' }), 'x.pdf', accounts, [])
    expect(m).toEqual({ accountId: 2, reason: 'fingerprint' })
  })

  it('matches by institution when only one account is at that bank', () => {
    const accounts = [
      account(1, { name: 'Everyday Card', institution: 'Capital One', type: 'credit' }),
      account(2, { name: 'Joint Checking', institution: 'Bank of America' }),
    ]
    const m = matchStatementToAccount(
      identity({ institution: 'Capital One', accountType: 'credit' }),
      'x.pdf',
      accounts,
      []
    )
    expect(m).toEqual({ accountId: 1, reason: 'institution' })
  })

  it('matches an institution written into the account name', () => {
    const accounts = [account(1, { name: 'Chase Checking' })]
    const m = matchStatementToAccount(identity({ institution: 'Chase' }), 'x.pdf', accounts, [])
    expect(m).toEqual({ accountId: 1, reason: 'institution' })
  })

  it('uses type to pick between two accounts at one bank', () => {
    const accounts = [
      account(1, { name: 'BofA Checking', institution: 'Bank of America', type: 'checking' }),
      account(2, { name: 'BofA Card', institution: 'Bank of America', type: 'credit' }),
    ]
    const m = matchStatementToAccount(
      identity({ institution: 'Bank of America', accountType: 'credit' }),
      'x.pdf',
      accounts,
      []
    )
    expect(m).toEqual({ accountId: 2, reason: 'institution' })
  })

  it('refuses to guess between two same-type accounts at one bank', () => {
    const accounts = [
      account(1, { name: 'My Checking', institution: 'Bank of America' }),
      account(2, { name: 'Her Checking', institution: 'Bank of America' }),
    ]
    expect(
      matchStatementToAccount(identity({ institution: 'Bank of America' }), 'x.pdf', accounts, [])
    ).toBeNull()
  })

  it('never attaches a new card number to an account with a different one', () => {
    const accounts = [account(1, { name: 'Chase Card', institution: 'Chase', lastFour: '3477', type: 'credit' })]
    expect(
      matchStatementToAccount(
        identity({ institution: 'Chase', accountType: 'credit', lastFour: '8821' }),
        'x.pdf',
        accounts,
        []
      )
    ).toBeNull()
  })

  it('falls back to the filename convention', () => {
    const accounts = [account(3, { name: 'Mystery' })]
    const uploads = [upload('eStmt_2026-05-08.pdf', 3)]
    const m = matchStatementToAccount(identity(), 'eStmt_2026-06-08.pdf', accounts, uploads)
    expect(m).toEqual({ accountId: 3, reason: 'filename' })
  })

  it('never matches a manual asset', () => {
    const accounts = [account(1, { name: 'House', type: 'manual_asset', institution: 'Chase' })]
    expect(
      matchStatementToAccount(identity({ institution: 'Chase' }), 'x.pdf', accounts, [])
    ).toBeNull()
  })
})
