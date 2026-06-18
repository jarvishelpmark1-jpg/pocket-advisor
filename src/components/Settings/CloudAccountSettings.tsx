import { useEffect, useState } from 'react'
import { RefreshCw, LogOut } from 'lucide-react'
import { supabase, isCloudEnabled } from '../../lib/supabase'
import { pushSnapshot } from '../../lib/cloud-sync'
import { Button } from '../shared/Button'
import { useToast } from '../../hooks/useToast'

export function CloudAccountSettings() {
  const { toast } = useToast()
  const [email, setEmail] = useState<string>('')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''))
  }, [])

  if (!isCloudEnabled()) return null

  const handleSync = async () => {
    setSyncing(true)
    try {
      await pushSnapshot()
      toast('Synced to the cloud')
    } catch {
      toast('Sync failed — check your connection', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const handleSignOut = async () => {
    await supabase?.auth.signOut()
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-text-primary text-sm font-medium">Signed in</p>
        <p className="text-text-muted text-[11px]">{email || 'Loading…'}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="sm" onClick={handleSync} icon={<RefreshCw size={14} />} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
        <Button variant="secondary" size="sm" onClick={handleSignOut} icon={<LogOut size={14} />}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
