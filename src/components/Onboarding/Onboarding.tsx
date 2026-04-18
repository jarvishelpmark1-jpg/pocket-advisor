import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Brain, BarChart3, Shield, ChevronRight } from 'lucide-react'
import { saveSettings } from '../../lib/settings'

const STEPS = [
  {
    icon: Upload,
    color: '#6366F1',
    title: 'Upload Your Statements',
    description: 'Drop a PDF, CSV, or OFX file from your bank. We support all major formats.',
  },
  {
    icon: Brain,
    color: '#10B981',
    title: 'Auto-Categorization',
    description: 'Transactions are automatically classified using 300+ merchant patterns. The more you use it, the smarter it gets.',
  },
  {
    icon: BarChart3,
    color: '#F59E0B',
    title: 'Insights That Matter',
    description: 'See where your money goes with spending breakdowns, trends, savings rate tracking, and budget alerts.',
  },
  {
    icon: Shield,
    color: '#3B82F6',
    title: 'Private By Design',
    description: 'All data stays on your device. Nothing is sent to any server, ever. Back up anytime from Settings.',
  },
]

export function Onboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      saveSettings({ hasCompletedOnboarding: true })
      onComplete()
    }
  }

  const handleSkip = () => {
    saveSettings({ hasCompletedOnboarding: true })
    onComplete()
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center"
          >
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mb-8"
              style={{ backgroundColor: current.color + '15' }}
            >
              <current.icon size={36} style={{ color: current.color }} />
            </div>

            <h1 className="text-text-primary text-xl font-bold mb-3 max-w-xs">
              {current.title}
            </h1>
            <p className="text-text-muted text-sm leading-relaxed max-w-xs">
              {current.description}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-8 pb-12 space-y-4">
        <div className="flex justify-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-accent' : 'w-1.5 bg-bg-elevated'
              }`}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="w-full flex items-center justify-center gap-2 bg-accent text-white py-3.5 rounded-2xl font-semibold text-sm active:scale-[0.98] transition-transform"
        >
          {isLast ? 'Get Started' : 'Next'}
          <ChevronRight size={16} />
        </button>

        {!isLast && (
          <button
            onClick={handleSkip}
            className="w-full text-text-muted text-xs py-2"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}
