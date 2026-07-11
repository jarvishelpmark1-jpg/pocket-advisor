import { useState, useEffect, useRef } from 'react'
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
  queueLabel,
  onComplete,
  onError,
}: {
  file: File
  accountId: number
  /** e.g. "File 2 of 7" when processing a batch */
  queueLabel?: string
  onComplete: (result: UploadResult) => void
  onError: (message: string) => void
}) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Reading file...')
  const [error, setError] = useState<string | null>(null)

  // The import must run exactly once per file: re-renders mid-import (live
  // queries fire as rows land) and StrictMode's double effect pass must attach
  // to the in-flight run, not start a second one — concurrent runs race past
  // the duplicate check and double-import the whole statement.
  const jobRef = useRef<{ file: File; accountId: number; promise: Promise<UploadResult> } | null>(null)
  const onProgressRef = useRef<(pct: number) => void>(() => {})

  useEffect(() => {
    let cancelled = false

    onProgressRef.current = (pct) => {
      if (cancelled) return
      setProgress(pct)
      if (pct < 30) setStatus('Classifying transactions...')
      else if (pct < 70) setStatus('Analyzing patterns...')
      else setStatus('Finalizing...')
    }

    if (!jobRef.current || jobRef.current.file !== file || jobRef.current.accountId !== accountId) {
      setError(null)
      setProgress(5)
      setStatus('Parsing transactions...')
      jobRef.current = {
        file,
        accountId,
        promise: processUpload(file, accountId, (pct) => onProgressRef.current(pct)),
      }
    }

    jobRef.current.promise
      .then((result) => {
        if (cancelled) return
        setProgress(100)
        setStatus('Complete!')
        setTimeout(() => onComplete(result), 400)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Processing failed')
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, accountId])

  if (error) {
    return (
      <Card className="text-center">
        <div className="w-12 h-12 rounded-full bg-expense/10 flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={24} className="text-expense" />
        </div>
        <p className="text-text-primary text-sm font-medium mb-1">Couldn't import {file.name}</p>
        <p className="text-text-muted text-xs mb-4">{error}</p>
        <Button variant="secondary" onClick={() => onError(error)}>Continue</Button>
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
      <p className="text-text-muted text-[10px] font-mono mt-2">
        {queueLabel ? `${queueLabel} · ` : ''}{file.name}
      </p>
    </Card>
  )
}
