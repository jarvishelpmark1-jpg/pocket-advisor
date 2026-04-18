import { useState, useEffect, useCallback } from 'react'
import { getSettings, saveSettings, resolveTheme, type Theme } from '../lib/settings'

export function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme)
  document.documentElement.setAttribute('data-theme', resolved)
  const metaTheme = document.querySelector('meta[name="theme-color"]')
  const metaScheme = document.querySelector('meta[name="color-scheme"]')
  if (metaTheme) metaTheme.setAttribute('content', resolved === 'dark' ? '#0B0F1A' : '#F8FAFC')
  if (metaScheme) metaScheme.setAttribute('content', resolved)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getSettings().theme)

  useEffect(() => {
    applyTheme(theme)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => { if (theme === 'system') applyTheme('system') }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    saveSettings({ theme: t })
  }, [])

  return { theme, setTheme, resolved: resolveTheme(theme) }
}
