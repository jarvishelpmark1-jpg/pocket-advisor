import type { CategoryId } from './types'

export type Theme = 'light' | 'dark' | 'system'

export interface AppSettings {
  theme: Theme
  hasCompletedOnboarding: boolean
  budgets: Partial<Record<CategoryId, number>>
  monthlyBudget: number
}

const STORAGE_KEY = 'pocket-advisor-settings'

const DEFAULTS: AppSettings = {
  theme: 'system',
  hasCompletedOnboarding: false,
  budgets: {},
  monthlyBudget: 0,
}

export function getSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { ...DEFAULTS }
    return { ...DEFAULTS, ...JSON.parse(stored) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(update: Partial<AppSettings>): AppSettings {
  const current = getSettings()
  const updated = { ...current, ...update }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: updated }))
  return updated
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}
