import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Delete } from 'lucide-react'
import { verifyPin } from '../../lib/applock'

const PIN_LENGTH = 4

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  useEffect(() => {
    if (pin.length < PIN_LENGTH) return
    let active = true
    verifyPin(pin).then((ok) => {
      if (!active) return
      if (ok) onUnlock()
      else {
        setError(true)
        setTimeout(() => active && (setPin(''), setError(false)), 500)
      }
    })
    return () => {
      active = false
    }
  }, [pin, onUnlock])

  const press = (d: string) => setPin((p) => (p.length < PIN_LENGTH ? p + d : p))
  const back = () => setPin((p) => p.slice(0, -1))

  return (
    <div className="fixed inset-0 z-50 bg-bg-base flex flex-col items-center justify-center px-8">
      <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center mb-5">
        <Lock size={22} />
      </div>
      <h1 className="text-text-primary text-base font-semibold mb-1">Pocket Advisor</h1>
      <p className="text-text-muted text-xs mb-8">Enter your PIN to unlock</p>

      <motion.div
        animate={error ? { x: [0, -8, 8, -8, 8, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex gap-3 mb-10"
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
              i < pin.length
                ? error
                  ? 'bg-expense border-expense'
                  : 'bg-accent border-accent'
                : 'border-border'
            }`}
          />
        ))}
      </motion.div>

      <div className="grid grid-cols-3 gap-4 w-full max-w-[260px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => press(d)}>{d}</Key>
        ))}
        <div />
        <Key onClick={() => press('0')}>0</Key>
        <Key onClick={back} aria-label="Delete">
          <Delete size={20} />
        </Key>
      </div>
    </div>
  )
}

function Key({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      onClick={onClick}
      className="h-16 rounded-2xl bg-bg-elevated text-text-primary text-2xl font-light flex items-center justify-center active:bg-bg-hover active:scale-95 transition-all"
      {...props}
    >
      {children}
    </button>
  )
}
