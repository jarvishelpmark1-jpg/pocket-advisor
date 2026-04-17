import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, FileText, Clock, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import { db } from '../../lib/db'
import { DropZone } from './DropZone'
import { ProcessingView } from './ProcessingView'
import { UploadResults } from './UploadResults'
import { AddAccountModal } from '../Accounts/AddAccountModal'
import { Card } from '../shared/Card'
import type { Account, UploadResult } from '../../lib/types'

type Phase = 'idle' | 'select-account' | 'processing' | 'results'

export function UploadPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [showAddAccount, setShowAddAccount] = useState(false)

  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? []
  const uploads = useLiveQuery(() => db.uploads.orderBy('uploadedAt').reverse().limit(10).toArray()) ?? []
  const navigate = useNavigate()

  const handleFileDrop = (f: File) => {
    setFile(f)
    if (accounts.length === 1) {
      setSelectedAccount(accounts[0])
      setPhase('processing')
    } else if (accounts.length === 0) {
      setShowAddAccount(true)
    } else {
      setPhase('select-account')
    }
  }

  const handleAccountSelect = (account: Account) => {
    setSelectedAccount(account)
    setPhase('processing')
  }

  const handleProcessingComplete = (r: UploadResult) => {
    setResult(r)
    setPhase('results')
  }

  const handleReset = () => {
    setPhase('idle')
    setFile(null)
    setSelectedAccount(null)
    setResult(null)
  }

  const handleAccountAdded = async () => {
    setShowAddAccount(false)
    const accts = await db.accounts.toArray()
    if (accts.length > 0 && file) {
      setSelectedAccount(accts[accts.length - 1])
      setPhase('processing')
    }
  }

  return (
    <div className="min-h-full pb-4">
      <div className="px-4 pt-14 pb-4">
        <h1 className="text-text-primary text-lg font-bold">Upload Statement</h1>
        <p className="text-text-muted text-xs mt-0.5">CSV, OFX, or QFX files from your bank</p>
      </div>

      <div className="px-4 space-y-4">
        {phase === 'idle' && <DropZone onFile={handleFileDrop} />}

        {phase === 'select-account' && (
          <Card>
            <p className="text-text-primary text-sm font-medium mb-3">Select account for this statement</p>
            <div className="space-y-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleAccountSelect(a)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-accent/40 hover:bg-bg-elevated transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: a.color + '20', color: a.color }}>
                    {a.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-text-primary text-sm">{a.name}</p>
                    <p className="text-text-muted text-[10px]">{a.institution} · {a.type}</p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setShowAddAccount(true)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-accent/40 transition-colors"
              >
                <Plus size={16} />
                Add new account
              </button>
            </div>
          </Card>
        )}

        {phase === 'processing' && file && selectedAccount && (
          <ProcessingView
            file={file}
            accountId={selectedAccount.id!}
            onComplete={handleProcessingComplete}
            onError={() => handleReset()}
          />
        )}

        {phase === 'results' && result && (
          <UploadResults
            result={result}
            onReview={() => navigate('/review')}
            onDone={handleReset}
          />
        )}

        {uploads.length > 0 && phase === 'idle' && (
          <div>
            <h3 className="text-text-secondary text-xs font-medium mb-2 flex items-center gap-1.5">
              <Clock size={12} />
              Recent Uploads
            </h3>
            <div className="space-y-2">
              {uploads.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-border">
                  <FileText size={16} className="text-text-muted flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-xs truncate">{u.filename}</p>
                    <p className="text-text-muted text-[10px]">
                      {u.transactionCount} transactions · {format(u.uploadedAt, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <CheckCircle size={14} className="text-income flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AddAccountModal
        open={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onSave={handleAccountAdded}
      />
    </div>
  )
}
