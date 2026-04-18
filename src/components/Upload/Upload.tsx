import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { FileText, Clock, CheckCircle, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { db, clearAllData } from '../../lib/db'
import { DropZone } from './DropZone'
import { ProcessingView } from './ProcessingView'
import { UploadResults } from './UploadResults'
import { Card } from '../shared/Card'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import type { Account, UploadResult } from '../../lib/types'

const COLORS = ['#6366F1', '#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#A855F7', '#EC4899', '#06B6D4']

type Phase = 'idle' | 'select-account' | 'processing' | 'results'

export function UploadPage() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const { toast } = useToast()

  const accounts = useLiveQuery(() => db.accounts.toArray()) ?? []
  const uploads = useLiveQuery(() => db.uploads.orderBy('uploadedAt').reverse().limit(10).toArray()) ?? []
  const txnCount = useLiveQuery(() => db.transactions.count()) ?? 0
  const navigate = useNavigate()

  const autoCreateAccount = async (): Promise<Account> => {
    const count = await db.accounts.count()
    const name = count === 0 ? 'My Account' : `Account ${count + 1}`
    const color = COLORS[count % COLORS.length]
    const id = await db.accounts.add({
      name,
      type: 'checking',
      institution: '',
      balance: 0,
      color,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return { id: id as number, name, type: 'checking', institution: '', balance: 0, color, createdAt: new Date(), updatedAt: new Date() }
  }

  const handleFileDrop = async (f: File) => {
    setFile(f)

    let account: Account | null = null
    if (accounts.length === 0) {
      account = await autoCreateAccount()
    } else if (accounts.length === 1) {
      account = accounts[0]
    }

    if (account) {
      setSelectedAccount(account)
      setPhase('processing')
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

  const handleClearAll = async () => {
    await clearAllData()
    handleReset()
    setConfirmClear(false)
    toast('All data cleared')
  }

  return (
    <div className="min-h-full pb-4">
      <div className="px-4 pt-14 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-text-primary text-lg font-bold">Upload Statement</h1>
            <p className="text-text-muted text-xs mt-0.5">Drop a PDF, CSV, OFX, or QFX file</p>
          </div>
          {txnCount > 0 && phase === 'idle' && (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-expense text-[11px] font-medium bg-expense/10 active:scale-95 transition-transform"
              aria-label="Clear all data and start fresh"
            >
              <Trash2 size={12} />
              Start Fresh
            </button>
          )}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {phase === 'idle' && <DropZone onFile={handleFileDrop} />}

        {phase === 'select-account' && (
          <Card>
            <p className="text-text-primary text-sm font-medium mb-3">Which account is this statement for?</p>
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
                    <p className="text-text-muted text-[10px]">{a.institution || a.type}</p>
                  </div>
                </button>
              ))}
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

      <ConfirmDialog
        open={confirmClear}
        title="Start Fresh"
        message="This removes all accounts, transactions, uploads, and learned rules. You cannot undo this."
        confirmLabel="Clear Everything"
        variant="danger"
        onConfirm={handleClearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  )
}
