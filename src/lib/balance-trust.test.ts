import { describe, it, expect } from 'vitest'
import { balanceTrust } from './balance-trust'
import type { Account, Upload } from './types'

const now = new Date(2026, 6, 12)

function account(over: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: 'Test',
    type: 'checking',
    institution: '',
    anchorBalance: 0,
    anchorDate: new Date(2026, 5, 8),
    color: '#000',
    createdAt: new Date(2026, 5, 8),
    updatedAt: new Date(2026, 5, 8),
    ...over,
  }
}

function upload(accountId: number, periodEnd: Date | null): Upload {
  return {
    accountId,
    filename: 'x.pdf',
    transactionCount: 5,
    autoClassified: 5,
    needsReview: 0,
    uploadedAt: new Date(2026, 5, 9),
    periodStart: new Date(2026, 4, 9),
    periodEnd,
  }
}

describe('balanceTrust', () => {
  it('reports never_set for a seed anchor', () => {
    const t = balanceTrust(account({ anchorSource: 'seed' }), [], now)
    expect(t.level).toBe('never_set')
  })

  it('reports statement provenance', () => {
    const t = balanceTrust(
      account({ anchorBalance: 2898.78, anchorSource: 'statement' }),
      [],
      now
    )
    expect(t.level).toBe('statement')
    expect(t.staleDays).toBe(34)
  })

  it('verified wins once the user confirms the current anchor', () => {
    const t = balanceTrust(
      account({
        anchorBalance: 2898.78,
        anchorSource: 'statement',
        anchorVerifiedAt: new Date(2026, 5, 9),
      }),
      [],
      now
    )
    expect(t.level).toBe('verified')
  })

  it('an old verification does not vouch for a newer anchor', () => {
    const t = balanceTrust(
      account({
        anchorBalance: 2898.78,
        anchorSource: 'statement',
        anchorVerifiedAt: new Date(2026, 4, 1), // verified an older anchor
      }),
      [],
      now
    )
    expect(t.level).toBe('statement')
  })

  describe('accounts created before anchorSource existed', () => {
    it('treats a $0 anchor stamped at creation as never set', () => {
      expect(balanceTrust(account(), [], now).level).toBe('never_set')
    })

    it('infers statement provenance from an upload ending at the anchor', () => {
      const a = account({ anchorBalance: 2898.78, createdAt: new Date(2026, 3, 1) })
      const t = balanceTrust(a, [upload(1, new Date(2026, 5, 6))], now)
      expect(t.level).toBe('statement')
    })

    it('falls back to manual when no upload explains the anchor', () => {
      const a = account({ anchorBalance: 500, createdAt: new Date(2026, 3, 1) })
      expect(balanceTrust(a, [upload(1, new Date(2026, 1, 1))], now).level).toBe('manual')
    })
  })
})
