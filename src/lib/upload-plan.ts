// Turns a pile of parsed statement files into an import plan the user can
// confirm at a glance: files matched to existing accounts group under that
// account, files that look like the same NEW account group together, and only
// files the evidence can't place are handed back as a question. This is the
// heart of "you drop files, the app asks yes/no questions".

import { matchStatementToAccount } from './account-match'
import {
  mergeIdentities,
  suggestedAccountName,
  type StatementIdentity,
} from './statement-identify'
import type { ParsedStatementFile } from './upload-processor'
import type { Account, AccountType, Upload } from './types'

export interface PlanEntry {
  /** caller's stable key for the file (index into its own list) */
  key: number
  parsed: ParsedStatementFile
}

export type ImportTarget =
  | { kind: 'existing'; accountId: number; reason: 'fingerprint' | 'institution' | 'filename' }
  | { kind: 'new'; name: string; type: AccountType }
  /** the evidence can't place this file — the user picks */
  | { kind: 'unresolved' }

export interface ImportGroup {
  key: string
  entryKeys: number[]
  /** merged identity across the group's files */
  identity: StatementIdentity
  target: ImportTarget
}

export interface ImportPreset {
  name: string
  type: AccountType
}

function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Two proposed-new identities describe the same account when no field
 * disagrees and at least one field agrees — "Apple Card" and
 * "Apple Card ••1234" merge (some PDFs surface the last four, some don't),
 * but two different card numbers never do.
 */
function compatibleIdentities(a: StatementIdentity, b: StatementIdentity): boolean {
  const fields: (keyof StatementIdentity)[] = ['institution', 'accountType', 'lastFour']
  let agreements = 0
  for (const f of fields) {
    const av = a[f]
    const bv = b[f]
    if (av !== null && bv !== null) {
      if (av !== bv) return false
      agreements++
    }
  }
  return agreements > 0
}

/**
 * Group parsed files into an import plan against the current accounts.
 * `preset` carries a guided "Import next: …" deep link — it only ever fills
 * gaps in a proposed new account, never overrides what a file says about
 * itself, and never bypasses matching to an existing account.
 */
export function planImports(
  entries: PlanEntry[],
  accounts: Account[],
  uploads: Upload[],
  preset?: ImportPreset | null
): ImportGroup[] {
  const existingGroups = new Map<number, ImportGroup>()
  const newGroups: ImportGroup[] = []
  const unresolvedGroups: ImportGroup[] = []

  for (const entry of entries) {
    const { identity } = entry.parsed
    const match = matchStatementToAccount(identity, entry.parsed.filename, accounts, uploads)

    if (match) {
      const g = existingGroups.get(match.accountId)
      if (g) {
        g.entryKeys.push(entry.key)
        g.identity = mergeIdentities(g.identity, identity)
      } else {
        existingGroups.set(match.accountId, {
          key: `acct:${match.accountId}`,
          entryKeys: [entry.key],
          identity,
          target: { kind: 'existing', accountId: match.accountId, reason: match.reason },
        })
      }
      continue
    }

    const identified = identity.institution !== null || identity.lastFour !== null

    if (identified) {
      // Fold into an existing proposed-new group when nothing contradicts.
      const g = newGroups.find((ng) => compatibleIdentities(ng.identity, identity))
      if (g) {
        g.entryKeys.push(entry.key)
        g.identity = mergeIdentities(g.identity, identity)
      } else {
        newGroups.push({
          key: `new:${squash(identity.institution ?? '')}:${identity.lastFour ?? ''}`,
          entryKeys: [entry.key],
          identity,
          target: { kind: 'new', name: '', type: 'checking' }, // filled below
        })
      }
      continue
    }

    if (accounts.length === 0) {
      // First-ever import: there's nothing to confuse it with, so propose a
      // new account even without an identity rather than blocking the user.
      newGroups.push({
        key: `first:${entry.key}`,
        entryKeys: [entry.key],
        identity,
        target: { kind: 'new', name: '', type: 'checking' },
      })
      continue
    }

    // No identity and accounts exist — guessing "new" here is how duplicate
    // accounts happen. Ask instead.
    unresolvedGroups.push({
      key: `file:${entry.key}`,
      entryKeys: [entry.key],
      identity,
      target: { kind: 'unresolved' },
    })
  }

  // Fill in the proposed name/type now that each new group's identity is
  // fully merged. The deep-link preset only fills what the file couldn't say.
  for (const g of newGroups) {
    const name = suggestedAccountName(g.identity) || preset?.name || ''
    const type = g.identity.accountType ?? preset?.type ?? 'checking'
    g.target = { kind: 'new', name, type }
  }

  return [...existingGroups.values(), ...newGroups, ...unresolvedGroups]
}
