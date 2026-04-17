import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, ListChecks, Layers } from 'lucide-react'
import { useUnreviewedTransactions } from '../../hooks/useTransactions'
import { ReviewCard } from './ReviewCard'
import { CategoryGrid } from './CategoryGrid'
import { EmptyState } from '../shared/EmptyState'
import { ProgressBar } from '../shared/ProgressBar'
import { formatCurrency } from '../../lib/formatters'
import type { Transaction, CategoryId } from '../../lib/types'
import { updateTransactionCategory, batchUpdateCategory } from '../../hooks/useTransactions'
import { learnFromCorrection } from '../../lib/classifier'

export function ReviewPage() {
  const transactions = useUnreviewedTransactions()
  const [currentIdx, setCurrentIdx] = useState(0)
  const [mode, setMode] = useState<'single' | 'batch'>('single')
  const [completedCount, setCompletedCount] = useState(0)

  const grouped = useMemo(() => {
    if (!transactions) return []
    const groups: Record<string, Transaction[]> = {}
    for (const txn of transactions) {
      const key = txn.merchantName || txn.description.slice(0, 15).toUpperCase()
      if (!groups[key]) groups[key] = []
      groups[key].push(txn)
    }
    return Object.entries(groups)
      .filter(([, txns]) => txns.length > 1)
      .sort((a, b) => b[1].length - a[1].length)
  }, [transactions])

  if (!transactions) return null

  if (transactions.length === 0) {
    return (
      <div className="min-h-full flex flex-col">
        <div className="px-4 pt-14 pb-4">
          <h1 className="text-text-primary text-lg font-bold">Review</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<CheckCircle size={28} />}
            title="All Caught Up"
            description="Every transaction has been categorized. Upload a new statement to continue."
          />
        </div>
      </div>
    )
  }

  const current = mode === 'single' ? transactions[currentIdx] : null
  const total = transactions.length
  const reviewed = completedCount

  const handleClassify = async (txn: Transaction, categoryId: CategoryId) => {
    await updateTransactionCategory(txn.id!, categoryId)
    await learnFromCorrection(txn.description, categoryId)
    setCompletedCount(c => c + 1)

    if (mode === 'single') {
      if (currentIdx >= transactions.length - 1) {
        setCurrentIdx(0)
      }
    }
  }

  const handleBatchClassify = async (txns: Transaction[], categoryId: CategoryId) => {
    const ids = txns.map(t => t.id!).filter(Boolean)
    await batchUpdateCategory(ids, categoryId)
    if (txns[0]) {
      await learnFromCorrection(txns[0].description, categoryId)
    }
    setCompletedCount(c => c + txns.length)
  }

  const handleSkip = () => {
    setCurrentIdx(i => Math.min(i + 1, transactions.length - 1))
  }

  return (
    <div className="min-h-full pb-4">
      <div className="px-4 pt-14 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-text-primary text-lg font-bold">Review</h1>
            <p className="text-text-muted text-xs">
              {total} transaction{total !== 1 ? 's' : ''} need{total === 1 ? 's' : ''} your input
            </p>
          </div>
          <div className="flex gap-1 bg-bg-elevated rounded-lg p-0.5">
            <button
              onClick={() => setMode('single')}
              className={`p-1.5 rounded-md transition-colors ${mode === 'single' ? 'bg-bg-card text-accent' : 'text-text-muted'}`}
            >
              <ListChecks size={16} />
            </button>
            <button
              onClick={() => setMode('batch')}
              className={`p-1.5 rounded-md transition-colors ${mode === 'batch' ? 'bg-bg-card text-accent' : 'text-text-muted'}`}
            >
              <Layers size={16} />
            </button>
          </div>
        </div>

        {reviewed > 0 && (
          <div className="mb-3">
            <ProgressBar
              value={reviewed}
              max={reviewed + total}
              color="#10B981"
              height={3}
              showLabel
              label={`${reviewed} classified this session`}
            />
          </div>
        )}
      </div>

      <div className="px-4">
        {mode === 'single' && current && (
          <AnimatePresence mode="popLayout">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.2 }}
            >
              <ReviewCard
                transaction={current}
                onClassify={(catId) => handleClassify(current, catId)}
                onSkip={handleSkip}
                remaining={total - currentIdx}
              />
            </motion.div>
          </AnimatePresence>
        )}

        {mode === 'batch' && (
          <div className="space-y-3">
            {grouped.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-text-muted text-xs">No groups found. Switch to single mode.</p>
              </div>
            ) : (
              grouped.map(([key, txns]) => (
                <BatchGroup
                  key={key}
                  name={key}
                  transactions={txns}
                  onClassify={(catId) => handleBatchClassify(txns, catId)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BatchGroup({
  name,
  transactions,
  onClassify,
}: {
  name: string
  transactions: Transaction[]
  onClassify: (catId: CategoryId) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const total = transactions.reduce((s, t) => s + Math.abs(t.amount), 0)

  return (
    <div className="bg-bg-card rounded-2xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-[10px] font-bold flex-shrink-0">
          {transactions.length}x
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-text-primary text-sm truncate">{name}</p>
          <p className="text-text-muted text-[10px]">
            {transactions.length} transactions · {formatCurrency(total)}
          </p>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-4">
              <CategoryGrid onSelect={onClassify} suggestedId={transactions[0]?.categoryId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
