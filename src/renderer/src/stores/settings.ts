import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from '@heroui/react'
import i18n from '@renderer/i18n'
import { hhcPersistStorage, createKey } from '@renderer/lib/persist-storage'
import { ThemePreference } from '@renderer/types/theme'

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Taipei', labelKey: 'timezones.taipei' },
  { value: 'Asia/Tokyo', labelKey: 'timezones.tokyo' },
  { value: 'America/New_York', labelKey: 'timezones.newYork' },
  { value: 'America/Los_Angeles', labelKey: 'timezones.losAngeles' },
  { value: 'Asia/Kuala_Lumpur', labelKey: 'timezones.malaysia' },
  { value: 'Europe/Athens', labelKey: 'timezones.athens' },
  { value: 'Australia/Melbourne', labelKey: 'timezones.melbourne' },
  { value: 'Europe/London', labelKey: 'timezones.london' }
] as const

const DEFAULT_TIMEZONE = 'Asia/Taipei'
const DEFAULT_HW_ACCEL = true
const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'

function clearIndexedDB(): void {
  try {
    if (typeof indexedDB === 'undefined' || !indexedDB.databases) return
    indexedDB.databases().then((dbs) => {
      dbs.forEach((db) => {
        if (db.name) {
          try {
            indexedDB.deleteDatabase(db.name)
          } catch {
            //
          }
        }
      })
    })
  } catch {
    //
  }
}

function clearCacheAPI(): void {
  try {
    if (typeof caches === 'undefined') return
    caches.keys().then((names) => {
      names.forEach((name) => {
        caches.delete(name)
      })
    })
  } catch {
    //
  }
}

function clearCookies(): void {
  try {
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim()
      if (name) {
        document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`
      }
    })
  } catch {
    //
  }
}

function clearAllSiteData(): void {
  try {
    localStorage.clear()
  } catch {
    //
  }
  try {
    sessionStorage.clear()
  } catch {
    //
  }
  clearIndexedDB()
  clearCacheAPI()
  clearCookies()
}

export interface SettingsStore {
  timezone: string
  hardwareAcceleration: boolean
  themePreference: ThemePreference
  setTimezone: (tz: string) => void
  setHardwareAcceleration: (enabled: boolean) => void
  setThemePreference: (pref: ThemePreference) => void
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      timezone: DEFAULT_TIMEZONE,
      hardwareAcceleration: DEFAULT_HW_ACCEL,
      themePreference: DEFAULT_THEME_PREFERENCE,

      setTimezone: (tz: string) => {
        set({ timezone: tz })
      },

      setHardwareAcceleration: (enabled: boolean) => {
        set({ hardwareAcceleration: enabled })
      },

      setThemePreference: (pref: ThemePreference) => {
        set({ themePreference: pref })
      },

      resetToDefaults: () => {
        set({
          timezone: DEFAULT_TIMEZONE,
          hardwareAcceleration: DEFAULT_HW_ACCEL,
          themePreference: DEFAULT_THEME_PREFERENCE
        })
        clearAllSiteData()
        toast.success(i18n.t('toast.settingsReset'))
      }
    }),
    {
      name: createKey('settings'),
      storage: hhcPersistStorage,
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState as Record<string, unknown>
        if (version < 1) {
          let themePreference: ThemePreference = 'system'
          try {
            const oldTheme = localStorage.getItem('hhc-theme')
            if (oldTheme === 'dark' || oldTheme === 'light' || oldTheme === 'system') {
              themePreference = oldTheme
              localStorage.removeItem('hhc-theme')
            }
          } catch {
            //
          }
          return { ...state, themePreference }
        }
        return state
      },
      partialize: (state) => ({
        timezone: state.timezone,
        hardwareAcceleration: state.hardwareAcceleration,
        themePreference: state.themePreference
      })
    }
  )
)
