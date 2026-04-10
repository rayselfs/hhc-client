import { create } from 'zustand'
import { createStorageKey } from '@renderer/lib/utils'
import { toast } from '@heroui/react'
import i18n from '@renderer/i18n'

const TIMEZONE_KEY = createStorageKey('timezone')
const HW_ACCEL_KEY = createStorageKey('hardwareAcceleration')

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
    // silent fail
  }
  try {
    sessionStorage.clear()
  } catch {
    // silent fail
  }
  clearIndexedDB()
  clearCacheAPI()
  clearCookies()
}

function loadTimezone(): string {
  try {
    const stored = localStorage.getItem(TIMEZONE_KEY)
    if (stored && typeof stored === 'string') return stored
  } catch {
    console.warn('[Settings] Failed to load timezone from storage')
  }
  return DEFAULT_TIMEZONE
}

function loadHardwareAcceleration(): boolean {
  try {
    const stored = localStorage.getItem(HW_ACCEL_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    console.warn('[Settings] Failed to load hardware acceleration from storage')
  }
  return DEFAULT_HW_ACCEL
}

export interface SettingsStore {
  timezone: string
  hardwareAcceleration: boolean
  setTimezone: (tz: string) => void
  setHardwareAcceleration: (enabled: boolean) => void
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsStore>()((set) => ({
  timezone: loadTimezone(),
  hardwareAcceleration: loadHardwareAcceleration(),

  setTimezone: (tz: string) => {
    set({ timezone: tz })
    try {
      localStorage.setItem(TIMEZONE_KEY, tz)
    } catch {
      toast.warning(i18n.t('toast.storageSaveFailed'))
    }
  },

  setHardwareAcceleration: (enabled: boolean) => {
    set({ hardwareAcceleration: enabled })
    try {
      localStorage.setItem(HW_ACCEL_KEY, String(enabled))
    } catch {
      toast.warning(i18n.t('toast.storageSaveFailed'))
    }
  },

  resetToDefaults: () => {
    set({ timezone: DEFAULT_TIMEZONE, hardwareAcceleration: DEFAULT_HW_ACCEL })
    clearAllSiteData()
    toast.success(i18n.t('toast.settingsReset'))
  }
}))
