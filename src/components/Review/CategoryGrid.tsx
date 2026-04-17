import { motion } from 'framer-motion'
import { ALL_REVIEW_CATEGORIES, INCOME_CATEGORIES } from '../../lib/categories'
import type { CategoryId } from '../../lib/types'

interface CategoryGridProps {
  onSelect: (id: CategoryId) => void
  suggestedId?: CategoryId | null
  showIncome?: boolean
}

export function CategoryGrid({ onSelect, suggestedId, showIncome = false }: CategoryGridProps) {
  const categories = showIncome ? [...ALL_REVIEW_CATEGORIES, ...INCOME_CATEGORIES] : ALL_REVIEW_CATEGORIES

  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map((cat) => {
        const isSuggested = cat.id === suggestedId
        return (
          <motion.button
            key={cat.id}
            whileTap={{ scale: 0.9 }}
            onClick={() => onSelect(cat.id)}
            className={`
              flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl
              transition-colors text-center
              ${isSuggested
                ? 'bg-accent/15 border border-accent/30 ring-1 ring-accent/20'
                : 'bg-bg-elevated border border-transparent hover:bg-bg-hover'
              }
            `}
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold"
              style={{ backgroundColor: cat.color + '20', color: cat.color }}
            >
              {cat.name.slice(0, 1)}
            </div>
            <span className="text-[9px] text-text-secondary leading-tight font-medium">
              {cat.name}
            </span>
            {isSuggested && (
              <span className="text-[7px] text-accent font-bold">SUGGESTED</span>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
