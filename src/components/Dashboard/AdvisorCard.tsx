import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { getBriefing, type RangeKey, type AdvisorParagraph } from '../../lib/advisor'
import { Card } from '../shared/Card'

// Bubble accents by tone — quiet, not christmas lights. The closing move is
// the only loud one on purpose: a good advisor ends with one ask.
const TONE_STYLES: Record<AdvisorParagraph['tone'], string> = {
  caveat: 'bg-warning/5 border border-warning/30',
  opening: 'bg-bg-elevated',
  win: 'bg-bg-elevated border border-income/20',
  watch: 'bg-bg-elevated border border-warning/20',
  move: 'bg-accent/10 border border-accent/25',
}

/**
 * The briefing: what a good advisor would say about this stretch of your
 * money, written from the real numbers. Rendered as a conversation, because
 * that's what it is.
 */
export function AdvisorCard({ range }: { range: RangeKey }) {
  const paragraphs = useLiveQuery(() => getBriefing(range), [range])

  if (!paragraphs || paragraphs.length === 0) return null

  return (
    <Card>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center flex-shrink-0">
          <Sparkles size={15} className="text-accent" />
        </div>
        <div>
          <h3 className="text-text-primary text-sm font-semibold leading-tight">Your advisor</h3>
          <p className="text-text-muted text-[10px]">reading your actual numbers, nobody else's</p>
        </div>
      </div>

      <div className="space-y-2">
        {paragraphs.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`rounded-2xl rounded-tl-md px-3.5 py-2.5 ${TONE_STYLES[p.tone]}`}
          >
            <p className="text-text-primary text-xs leading-relaxed">{p.text}</p>
          </motion.div>
        ))}
      </div>
    </Card>
  )
}
