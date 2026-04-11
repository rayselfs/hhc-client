import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from '@heroui/react'
import i18n from '@renderer/i18n'
import { hhcPersistStorage, createKey } from '@renderer/lib/persist-storage'

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
  setTimezone: (tz: string) => void
  setHardwareAcceleration: (enabled: boolean) => void
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      timezone: DEFAULT_TIMEZONE,
      hardwareAcceleration: DEFAULT_HW_ACCEL,

      setTimezone: (tz: string) => {
        set({ timezone: tz })
      },

      setHardwareAcceleration: (enabled: boolean) => {
        set({ hardwareAcceleration: enabled })
      },

      resetToDefaults: () => {
        set({ timezone: DEFAULT_TIMEZONE, hardwareAcceleration: DEFAULT_HW_ACCEL })
        clearAllSiteData()
        toast.success(i18n.t('toast.settingsReset'))
      }
    }),
    {
      name: createKey('settings'),
      storage: hhcPersistStorage,
      version: 0
    }
  )
)
