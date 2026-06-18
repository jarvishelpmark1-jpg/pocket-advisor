import { db } from './db'
import { supabase } from './supabase'
import { exportBackup, importBackup } from './backup'

// Sync model: the entire dataset is a single JSON snapshot per user (reuses the
// tested backup serialization). On start we pull if the cloud copy is newer;
// thereafter every local change debounces a push. Snapshot-granularity
// last-write-wins is plenty for one household across their own devices.

const TABLE = 'snapshots'
const LAST_SYNC_KEY = 'pa_last_sync'

let started = false
let dirty = false
let suppress = false // true while importing a pulled snapshot, so it doesn't echo back

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export async function pushSnapshot(): Promise<void> {
  if (!supabase) return
  const userId = await currentUserId()
  if (!userId) return
  const json = await exportBackup()
  const updatedAt = new Date().toISOString()
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, data: JSON.parse(json), updated_at: updatedAt }, { onConflict: 'user_id' })
  if (error) throw error
  localStorage.setItem(LAST_SYNC_KEY, String(Date.parse(updatedAt)))
}

export async function pullSnapshot(): Promise<boolean> {
  if (!supabase) return false
  const userId = await currentUserId()
  if (!userId) return false
  const { data, error } = await supabase.from(TABLE).select('data, updated_at').eq('user_id', userId).maybeSingle()
  if (error || !data?.data) return false
  suppress = true
  try {
    await importBackup(JSON.stringify(data.data))
  } finally {
    suppress = false
  }
  if (data.updated_at) localStorage.setItem(LAST_SYNC_KEY, String(Date.parse(data.updated_at)))
  return true
}

/** On login/app-start, reconcile local and cloud once. */
export async function syncOnStart(): Promise<void> {
  if (!supabase) return
  const userId = await currentUserId()
  if (!userId) return

  const { data } = await supabase.from(TABLE).select('updated_at').eq('user_id', userId).maybeSingle()
  const cloudUpdated = data?.updated_at ? Date.parse(data.updated_at) : 0
  const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY) || 0)
  const localCount = (await db.transactions.count()) + (await db.accounts.count())

  if (cloudUpdated > 0 && (localCount === 0 || cloudUpdated > lastSync)) {
    await pullSnapshot()
  } else {
    await pushSnapshot()
  }
}

function markDirty() {
  if (!suppress) dirty = true
}

async function flush() {
  if (!dirty || !navigator.onLine) return
  dirty = false
  try {
    await pushSnapshot()
  } catch {
    dirty = true // retry on next tick
  }
}

/** Register change listeners + periodic/background flush. Idempotent. */
export function startCloudSync(): void {
  if (!supabase || started) return
  started = true

  const tables = [db.transactions, db.accounts, db.goals, db.uploads, db.userRules]
  for (const table of tables) {
    table.hook('creating', () => markDirty())
    table.hook('updating', () => markDirty())
    table.hook('deleting', () => markDirty())
  }

  setInterval(flush, 5000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
  window.addEventListener('online', () => void flush())
}
