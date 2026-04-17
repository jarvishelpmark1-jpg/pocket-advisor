import { motion } from 'framer-motion'
import { SkipForward, Calendar, Hash, Lightbulb } from 'lucide-react'
import { formatCurrency, formatDate, cleanDescription } from '../../lib/formatters'
import { getCategoryName } from '../../lib/categories'
import { Card } from '../shared/Card'
import { CategoryGrid } from './CategoryGrid'
import type { Transaction, CategoryId } from '../../lib/types'

interface ReviewCardProps {
  transaction: Transaction
  onClassify: (categoryId: CategoryId) => void
  onSkip: () => void
  remaining: number
}

export function ReviewCard({ transaction, onClassify, onSkip, remaining }: ReviewCardProps) {
  const hasGuess = transaction.categoryId !== null && transaction.confidence > 0

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-text-primary text-base font-semibold truncate">
              {transaction.merchantName || cleanDescription(transaction.description)}
            </p>
            {transaction.merchantName && (
              <p className="text-text-muted text-[10px] truncate mt-0.5">
                {cleanDescription(transaction.originalDescription)}
              </p>
            )}
          </div>
          <span
            className={`text-lg font-bold font-mono flex-shrink-0 ml-3 ${
              transaction.amount > 0 ? 'text-income' : 'text-text-primary'
            }`}
          >
            {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
          </span>
        </div>

        <div className="flex items-center gap-3 text-text-muted text-[11px]">
          <span className="flex items-center gap-1">
            <Calendar size={11} />
            {formatDate(transaction.date)}
          </span>
          <span className="flex items-center gap-1">
            <Hash size={11} />
            {remaining} left
          </span>
        </div>

        {hasGuess && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl border border-accent/20 bg-accent/5"
          >
            <Lightbulb size={12} className="text-accent flex-shrink-0" />
            <span className="text-accent text-xs">
              Might be <strong>{getCategoryName(transaction.categoryId)}</strong>
              <span className="text-accent/60 ml-1">({(transaction.confidence * 100).toFixed(0)}%)</span>
            </span>
            <button
              onClick={() => onClassify(transaction.categoryId!)}
              className="ml-auto text-[10px] font-semibold bg-accent text-white px-3 py-1 rounded-lg active:scale-95 transition-transform"
            >
              Confirm
            </button>
          </motion.div>
        )}
      </Card>

      <Card>
        <p className="text-text-muted text-[10px] font-medium mb-2">CHOOSE CATEGORY</p>
        <CategoryGrid
          onSelect={onClassify}
          suggestedId={transaction.categoryId}
          showIncome={transaction.amount > 0}
        />
      </Card>

      <button
        onClick={onSkip}
        className="w-full flex items-center justify-center gap-2 py-3 text-text-muted text-xs hover:text-text-secondary transition-colors"
      >
        <SkipForward size={12} />
        Skip for now
      </button>
    </div>
  )
}
