import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw } from 'lucide-react'

export function UpdatePrompt() {
  const [needsUpdate, setNeedsUpdate] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (!reg) return
        const checkWaiting = () => {
          if (reg.waiting) setNeedsUpdate(true)
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setNeedsUpdate(true)
            }
          })
        })
        checkWaiting()
      })
    }
  }, [])

  const handleUpdate = () => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        window.location.reload()
      }
    })
  }

  return (
    <AnimatePresence>
      {needsUpdate && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-0 left-0 right-0 z-50 bg-accent text-white text-xs font-medium flex items-center justify-center gap-2 py-2.5 px-4 safe-top"
        >
          <RefreshCw size={12} />
          <span>A new version is available</span>
          <button
            onClick={handleUpdate}
            className="underline font-bold ml-1"
          >
            Update now
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
