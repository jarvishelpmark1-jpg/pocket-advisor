import { db } from './db'
import type { Account, Transaction } from './types'

const DAY = 24 * 60 * 60 * 1000
const STALE_AFTER_DAYS = 21
const GAP_MIN_DAYS = 20

export interface AccountHealthIssue {
  account: Account
  kind: 'no_balance' | 'stale' | 'gap'
  /** stale: how far behind the newest data is */
  daysBehind?: number
  lastDataDate?: Date
  /** gap: the largest hole inside the imported range */
  gapStart?: Date
  gapEnd?: Date
}

/**
 * An account still on its creation seed (nobody ever set the balance) shows a
 * number that's just imported activity stacked on $0 — CSV imports carry no
 * balance, so this is common and reads like the app is broken. Flag it instead
 * of letting the guess pass as real. Accounts with recorded provenance are
 * exact (anchorSource === 'seed'); older rows fall back to the heuristic:
 * seed-looking anchor + all activity predating it (activity dated after the
 * anchor may mean the account genuinely started from zero, so stay quiet).
 */
export function hasUnsetBalance(account: Account, txns: { date: Date }[]): boolean {
  if (txns.length === 0) return false
  if (account.anchorSource) return account.anchorSource === 'seed'
  const seedLike =
    account.anchorBalance === 0 &&
    Math.abs(account.anchorDate.getTime() - account.createdAt.getTime()) < DAY
  if (!seedLike) return false
  return txns.every((t) => t.date.getTime() <= account.anchorDate.getTime())
}

export function assessAccounts(
  accounts: Account[],
  txnsByAccount: Map<number, Transaction[]>,
  now: Date = new Date()
): AccountHealthIssue[] {
  const issues: AccountHealthIssue[] = []

  for (const account of accounts) {
    if (account.type === 'manual_asset') continue
    const txns = txnsByAccount.get(account.id!) ?? []
    if (txns.length === 0) continue

    if (hasUnsetBalance(account, txns)) {
      issues.push({ account, kind: 'no_balance' })
    }

    const times = txns.map((t) => t.date.getTime()).sort((a, b) => a - b)
    const last = times[times.length - 1]
    const daysBehind = Math.floor((now.getTime() - last) / DAY)
    if (daysBehind > STALE_AFTER_DAYS) {
      issues.push({ account, kind: 'stale', daysBehind, lastDataDate: new Date(last) })
    }

    let worst = 0
    let worstStart = 0
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1]
      if (gap > worst) {
        worst = gap
        worstStart = times[i - 1]
      }
    }
    if (worst > GAP_MIN_DAYS * DAY) {
      issues.push({
        account,
        kind: 'gap',
        gapStart: new Date(worstStart),
        gapEnd: new Date(worstStart + worst),
      })
    }
  }

  // Most actionable first: fake balances beat stale data beats internal holes.
  const rank = { no_balance: 0, stale: 1, gap: 2 }
  return issues.sort((a, b) => rank[a.kind] - rank[b.kind])
}

export async function assessDataHealth(now: Date = new Date()): Promise<AccountHealthIssue[]> {
  const [accounts, txns] = await Promise.all([db.accounts.toArray(), db.transactions.toArray()])
  const byAccount = new Map<number, Transaction[]>()
  for (const t of txns) {
    const arr = byAccount.get(t.accountId)
    if (arr) arr.push(t)
    else byAccount.set(t.accountId, [t])
  }
  return assessAccounts(accounts, byAccount, now)
}
