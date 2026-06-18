import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { TrendingUp, AlertTriangle, Target, Info, Sparkles } from 'lucide-react'
import { getInsights, type InsightKind } from '../../lib/insights'
import { Card } from '../shared/Card'

const STYLES: Record<InsightKind, { icon: typeof TrendingUp; color: string }> = {
  win: { icon: TrendingUp, color: '#10B981' },
  watch: { icon: AlertTriangle, color: '#F59E0B' },
  action: { icon: Target, color: '#6366F1' },
  fact: { icon: Info, color: '#6B7280' },
}

export function InsightsCard({ month, limit = 4 }: { month: string; limit?: number }) {
  const insights = useLiveQuery(() => getInsights(month), [month])

  if (insights === undefined) return null
  if (insights.length === 0) return null

  const shown = insights.slice(0, limit)

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={15} className="text-accent" />
        <h3 className="text-text-primary text-sm font-semibold">Highlights & Next Steps</h3>
      </div>

      <div className="space-y-2.5">
        {shown.map((insight, i) => {
          const { icon: Icon, color } = STYLES[insight.kind]
          return (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex gap-2.5"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: color + '18', color }}
              >
                <Icon size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-text-primary text-xs font-semibold leading-tight">{insight.title}</p>
                <p className="text-text-muted text-[11px] leading-snug mt-0.5">{insight.detail}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </Card>
  )
}
