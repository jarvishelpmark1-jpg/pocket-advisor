import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, AlertCircle } from 'lucide-react'
import { processUpload } from '../../lib/upload-processor'
import { Card } from '../shared/Card'
import { ProgressBar } from '../shared/ProgressBar'
import { Button } from '../shared/Button'
import type { UploadResult } from '../../lib/types'

export function ProcessingView({
  file,
  accountId,
  onComplete,
  onError,
}: {
  file: File
  accountId: number
  onComplete: (result: UploadResult) => void
  onError: () => void
}) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Reading file...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        setStatus('Parsing transactions...')
        setProgress(10)

        const result = await processUpload(file, accountId, (pct) => {
          if (!cancelled) {
            setProgress(10 + (pct * 0.8))
            if (pct < 30) setStatus('Classifying transactions...')
            else if (pct < 70) setStatus('Analyzing patterns...')
            else setStatus('Finalizing...')
          }
        })

        if (!cancelled) {
          setProgress(100)
          setStatus('Complete!')
          setTimeout(() => onComplete(result), 400)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Processing failed')
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [file, accountId, onComplete])

  if (error) {
    return (
      <Card className="text-center">
        <div className="w-12 h-12 rounded-full bg-expense/10 flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={24} className="text-expense" />
        </div>
        <p className="text-text-primary text-sm font-medium mb-1">Upload Failed</p>
        <p className="text-text-muted text-xs mb-4">{error}</p>
        <Button variant="secondary" onClick={onError}>Try Again</Button>
      </Card>
    )
  }

  return (
    <Card className="text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
        className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4"
      >
        <Loader2 size={24} className="text-accent" />
      </motion.div>

      <p className="text-text-primary text-sm font-medium mb-1">Processing</p>
      <p className="text-text-muted text-xs mb-4">{status}</p>

      <ProgressBar value={progress} color="#6366F1" height={4} />
      <p className="text-text-muted text-[10px] font-mono mt-2">{file.name}</p>
    </Card>
  )
}
