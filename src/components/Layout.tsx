import { type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Upload,
  ListChecks,
  BarChart3,
  Wallet,
} from 'lucide-react'
import { useReviewCount } from '../hooks/useTransactions'

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Home' },
  { path: '/upload', icon: Upload, label: 'Upload' },
  { path: '/review', icon: ListChecks, label: 'Review' },
  { path: '/analytics', icon: BarChart3, label: 'Insights' },
  { path: '/accounts', icon: Wallet, label: 'Accounts' },
]

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const reviewCount = useReviewCount() ?? 0

  return (
    <div className="h-full flex flex-col bg-bg-primary">
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        {children}
      </main>

      <nav className="flex-shrink-0 bg-bg-secondary/80 backdrop-blur-xl border-t border-border safe-bottom">
        <div className="flex items-center justify-around px-2 pt-2 pb-1 max-w-lg mx-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path
            const Icon = item.icon
            const showBadge = item.path === '/review' && reviewCount > 0

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative flex flex-col items-center gap-0.5 py-1 px-3 min-w-[56px]"
              >
                <div className="relative">
                  <Icon
                    size={22}
                    className={`transition-colors ${
                      isActive ? 'text-accent' : 'text-text-muted'
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2.5 bg-expense text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                      {reviewCount > 99 ? '99+' : reviewCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors ${
                    isActive ? 'text-accent' : 'text-text-muted'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-accent"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
