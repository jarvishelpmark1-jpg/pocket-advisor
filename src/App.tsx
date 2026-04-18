import { lazy, Suspense, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './components/Dashboard/Dashboard'
import { Onboarding } from './components/Onboarding/Onboarding'
import { getSettings } from './lib/settings'

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

  if (!onboarded) {
    return (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Onboarding onComplete={() => setOnboarded(true)} />
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
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
    </BrowserRouter>
  )
}
