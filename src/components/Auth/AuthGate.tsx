import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Wallet } from 'lucide-react'
import { supabase, isCloudEnabled } from '../../lib/supabase'
import { syncOnStart, startCloudSync } from '../../lib/cloud-sync'
import { Button } from '../shared/Button'

/**
 * Gates the app behind a cloud login WHEN cloud sync is configured. With no
 * Supabase keys this renders children immediately (local-only mode), so the
 * app is unchanged until the user wires up their account.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const cloud = isCloudEnabled()
  const [ready, setReady] = useState(!cloud)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!cloud || !supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [cloud])

  useEffect(() => {
    if (!cloud || !session) return
    let active = true
    ;(async () => {
      await syncOnStart()
      if (active) startCloudSync()
    })()
    return () => {
      active = false
    }
  }, [cloud, session])

  if (!cloud) return <>{children}</>
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!session) return <AuthScreen />
  return <>{children}</>
}

function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!supabase) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setNotice('Account created. If email confirmation is on, check your inbox, then sign in.')
        setMode('signin')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base px-8">
      <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center mb-4">
        <Wallet size={22} />
      </div>
      <h1 className="text-text-primary text-lg font-bold">Pocket Advisor</h1>
      <p className="text-text-muted text-xs mb-7">
        {mode === 'signin' ? 'Sign in to see your finances anywhere' : 'Create your account'}
      </p>

      <div className="w-full max-w-xs space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          placeholder="Email"
          className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm focus:border-accent focus:outline-none"
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          placeholder="Password"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-sm focus:border-accent focus:outline-none"
        />

        {error && <p className="text-expense text-xs">{error}</p>}
        {notice && <p className="text-income text-xs">{notice}</p>}

        <Button onClick={submit} fullWidth disabled={busy || !email || !password}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
        </Button>

        <button
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice('') }}
          className="w-full text-accent text-xs font-medium pt-1"
        >
          {mode === 'signin' ? 'Need an account? Create one' : 'Have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
