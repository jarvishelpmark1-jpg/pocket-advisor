import { useNavigate } from 'react-router-dom'
import { Upload, ListChecks } from 'lucide-react'
import { Card } from '../shared/Card'
import { useReviewCount } from '../../hooks/useTransactions'

export function QuickActions() {
  const navigate = useNavigate()
  const reviewCount = useReviewCount() ?? 0

  return (
    <Card padding="sm" className="flex flex-col gap-2">
      <button
        onClick={() => navigate('/upload')}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10 text-accent text-xs font-medium active:scale-95 transition-transform"
      >
        <Upload size={14} />
        Upload
      </button>
      <button
        onClick={() => navigate('/review')}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-elevated text-text-secondary text-xs font-medium active:scale-95 transition-transform"
      >
        <ListChecks size={14} />
        Review
        {reviewCount > 0 && (
          <span className="ml-auto bg-expense/20 text-expense text-[10px] px-1.5 py-0.5 rounded-full font-bold">
            {reviewCount}
          </span>
        )}
      </button>
    </Card>
  )
}
