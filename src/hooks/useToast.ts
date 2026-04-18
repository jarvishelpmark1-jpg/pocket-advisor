import { useContext } from 'react'
import { ToastContext } from '../lib/toast-context'

export function useToast() {
  return useContext(ToastContext)
}
