import { useState } from 'react'
import { Modal } from '../shared/Modal'
import { Button } from '../shared/Button'
import { useToast } from '../../hooks/useToast'
import { hasPin, setPin, clearPin } from '../../lib/applock'

export function AppLockSettings() {
  const { toast } = useToast()
  const [enabled, setEnabled] = useState(hasPin())
  const [showSetup, setShowSetup] = useState(false)

  const handleDisable = () => {
    clearPin()
    setEnabled(false)
    toast('App lock turned off')
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-text-primary text-sm font-medium">App Lock</p>
          <p className="text-text-muted text-[11px]">
            {enabled ? 'A PIN is required to open the app' : 'Require a PIN to open the app'}
          </p>
        </div>
        {enabled ? (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowSetup(true)}>Change</Button>
            <Button variant="danger" size="sm" onClick={handleDisable}>Turn off</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setShowSetup(true)}>Set up</Button>
        )}
      </div>

      {showSetup && (
        <PinSetupModal
          onClose={() => setShowSetup(false)}
          onDone={() => {
            setEnabled(true)
            setShowSetup(false)
            toast('App lock is on')
          }}
        />
      )}
    </>
  )
}

function PinSetupModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [pin, setPinValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const valid = /^\d{4}$/.test(pin)
  const matches = pin === confirm

  const handleSave = async () => {
    if (!valid) return setError('PIN must be 4 digits')
    if (!matches) return setError("PINs don't match")
    await setPin(pin)
    onDone()
  }

  const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 4)

  return (
    <Modal open onClose={onClose} title="Set App Lock PIN">
      <div className="space-y-4">
        <div>
          <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">New PIN</label>
          <input
            value={pin}
            onChange={(e) => { setPinValue(onlyDigits(e.target.value)); setError('') }}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="••••"
            className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-lg font-mono tracking-[0.5em] focus:border-accent focus:outline-none"
            autoFocus
          />
        </div>
        <div>
          <label className="text-text-muted text-[10px] font-medium uppercase tracking-wider mb-1.5 block">Confirm PIN</label>
          <input
            value={confirm}
            onChange={(e) => { setConfirm(onlyDigits(e.target.value)); setError('') }}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            placeholder="••••"
            className="w-full bg-bg-elevated border border-border rounded-xl px-3 py-2.5 text-text-primary text-lg font-mono tracking-[0.5em] focus:border-accent focus:outline-none"
          />
        </div>
        {error && <p className="text-expense text-xs">{error}</p>}
        <p className="text-text-muted text-[10px] leading-relaxed">
          The PIN protects this device. If you forget it, you'll need to clear the app's data to get back in.
        </p>
        <Button onClick={handleSave} fullWidth disabled={!valid || !matches}>Turn on App Lock</Button>
      </div>
    </Modal>
  )
}
