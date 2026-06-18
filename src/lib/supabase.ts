import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cloud login + sync is OPT-IN: it only turns on when these two env vars are
// present (set them in a .env file or your host's env settings). With no keys
// the whole app runs exactly as before, 100% local. See SETUP-CLOUD.md.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null

export function isCloudEnabled(): boolean {
  return supabase !== null
}
