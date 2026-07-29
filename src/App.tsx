import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard/Dashboard'
import { Onboarding } from './components/Onboarding/Onboarding'
import { LockScreen } from './components/Lock/LockScreen'
import { AuthGate } from './components/Auth/AuthGate'
import { ToastProvider } from './components/shared/Toast'
import { UpdatePrompt } from './components/shared/UpdatePrompt'
import { ErrorBoundary } from './components/shared/ErrorBoundary'
import { getSettings } from './lib/settings'
import { hasPin } from './lib/applock'
import { runStartupRepairs } from './lib/data-repair'

const UploadPage = lazy(() => import('./components/Upload/Upload').then(m => ({ default: m.UploadPage })))
const ReviewPage = lazy(() => import('./components/Review/Review').then(m => ({ default: m.ReviewPage })))
const AnalyticsPage = lazy(() => import('./components/Analytics/Analytics').then(m => ({ default: m.AnalyticsPage })))
const TransactionsPage = lazy(() => import('./components/Transactions/Transactions').then(m => ({ default: m.TransactionsPage })))
const SettingsPage = lazy(() => import('./components/Settings/Settings').then(m => ({ default: m.SettingsPage })))

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  const [onboarded, setOnboarded] = useState(() => getSettings().hasCompletedOnboarding)
  const [locked, setLocked] = useState(() => hasPin())

  // Re-lock whenever the app is backgrounded, so returning requires the PIN.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && hasPin()) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Launch-time self-heals (remove summary rows past parsers let in) plus the
  // net-worth snapshot refresh. Covers month rollover (first open in a new
  // month writes that month) and seeds the history chart. No-op until there
  // are accounts; idempotent, so the dev StrictMode double-run is safe.
  useEffect(() => {
    if (onboarded) void runStartupRepairs()
  }, [onboarded])

  if (!onboarded) {
    return (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Onboarding onComplete={() => setOnboarded(true)} />
      </BrowserRouter>
    )
  }

  return (
    <ErrorBoundary>
      <AuthGate>
        {locked && hasPin() ? (
          <LockScreen onUnlock={() => setLocked(false)} />
        ) : (
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <ToastProvider>
              <UpdatePrompt />
              <Layout>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/upload" element={<UploadPage />} />
                    <Route path="/review" element={<ReviewPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/transactions" element={<TransactionsPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Routes>
                </Suspense>
              </Layout>
            </ToastProvider>
          </BrowserRouter>
        )}
      </AuthGate>
    </ErrorBoundary>
  )
}
