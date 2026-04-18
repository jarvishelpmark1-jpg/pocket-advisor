import { useState, useCallback, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'
import { ToastContext } from '../../lib/toast-context'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      <div className="fixed bottom-24 left-4 right-4 flex flex-col items-center gap-2 pointer-events-none z-50">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = t.type === 'success' ? CheckCircle : t.type === 'error' ? AlertCircle : Info
            const bg = t.type === 'success' ? 'bg-income' : t.type === 'error' ? 'bg-expense' : 'bg-accent'
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                role="status"
                aria-live="polite"
                className={`${bg} text-white text-xs font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2`}
              >
                <Icon size={14} />
                {t.message}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
