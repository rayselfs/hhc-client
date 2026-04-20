import { createContext, useContext, useEffect, useState } from 'react'
import { isElectron } from '@renderer/lib/env'
import { THEME_DEFAULTS, ThemeContextValue, ThemePreference, ResolvedTheme } from '../types/theme'
import { useSettingsStore } from '@renderer/stores/settings'

const ThemeContext = createContext<ThemeContextValue | null>(null)

const isProjectionWindow = window.location.hash.startsWith('#/projection')

function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'dark') return 'dark'
  if (pref === 'light') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const DARK_ONLY: ThemeContextValue = {
  preference: 'dark',
  resolved: 'dark',
  setPreference: () => {}
}

function ProjectionThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  useEffect(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = 'dark'
  }, [])

  return <ThemeContext.Provider value={DARK_ONLY}>{children}</ThemeContext.Provider>
}

function ControlThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const storedPref = useSettingsStore.getState().themePreference
  const initialPref: ThemePreference =
    storedPref === 'light' || storedPref === 'dark' || storedPref === 'system'
      ? storedPref
      : THEME_DEFAULTS.preference

  const [preference, setPreferenceState] = useState<ThemePreference>(initialPref)
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(initialPref))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.documentElement.style.colorScheme = resolved
  }, [resolved])

  useEffect(() => {
    if (!isElectron()) return
    window.api.theme.set(preference)
  }, [preference])

  useEffect(() => {
    if (isElectron()) {
      const cleanup = window.api.theme.onChanged((data) => {
        if (preference === 'system') {
          setResolved(data.shouldUseDarkColors ? 'dark' : 'light')
        }
      })
      return cleanup
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent): void => {
        if (preference === 'system') {
          setResolved(e.matches ? 'dark' : 'light')
        }
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [preference])

  useEffect(() => {
    setResolved(resolveTheme(preference))
  }, [preference])

  const setPreference = (pref: ThemePreference): void => {
    setPreferenceState(pref)
    useSettingsStore.getState().setThemePreference(pref)
  }

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return isProjectionWindow ? (
    <ProjectionThemeProvider>{children}</ProjectionThemeProvider>
  ) : (
    <ControlThemeProvider>{children}</ControlThemeProvider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
