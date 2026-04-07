import { createContext, useContext, useEffect, useState } from 'react'
import { isElectron } from '@renderer/lib/env'
import {
  THEME_DEFAULTS,
  THEME_STORAGE_KEY,
  ThemeContextValue,
  ThemePreference,
  ResolvedTheme
} from '../types/theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

/** Resolve a ThemePreference to a concrete ResolvedTheme */
function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'dark') return 'dark'
  if (pref === 'light') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  // Initialize from localStorage or fall back to default
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null
  const initialPref: ThemePreference =
    stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : THEME_DEFAULTS.preference

  const [preference, setPreferenceState] = useState<ThemePreference>(initialPref)
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveTheme(initialPref))

  // Apply theme to DOM whenever resolved changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.documentElement.style.colorScheme = resolved
  }, [resolved])

  // Persist preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, preference)
  }, [preference])

  // Sync Electron nativeTheme + boot restore (Electron only)
  useEffect(() => {
    if (!isElectron()) return
    window.electron.ipcRenderer.invoke('theme:set', preference)
  }, [preference])

  // Listen for system theme changes — ONE listener per environment
  useEffect(() => {
    if (isElectron()) {
      // Electron: listen ONLY to IPC (matchMedia double-fires with nativeTheme)
      const cleanup = window.electron.ipcRenderer.on(
        'theme:changed',
        (_event: Electron.IpcRendererEvent, data: { shouldUseDarkColors: boolean }) => {
          if (preference === 'system') {
            setResolved(data.shouldUseDarkColors ? 'dark' : 'light')
          }
        }
      )
      return cleanup
    } else {
      // Browser: listen ONLY to matchMedia
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

  // Update resolved theme when preference changes
  useEffect(() => {
    setResolved(resolveTheme(preference))
  }, [preference])

  const setPreference = (pref: ThemePreference): void => {
    setPreferenceState(pref)
  }

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
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
