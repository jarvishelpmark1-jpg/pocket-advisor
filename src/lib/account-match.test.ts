import { describe, it, expect } from 'vitest'
import { suggestAccountForFilename } from './account-match'
import type { Upload } from './types'

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
