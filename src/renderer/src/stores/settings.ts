import { create } from 'zustand'
import { createStorageKey } from '@renderer/lib/utils'

const TIMEZONE_KEY = createStorageKey('timezone')
const HW_ACCEL_KEY = createStorageKey('hardwareAcceleration')

export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Taipei', labelKey: 'timezones.taipei' },
  { value: 'Asia/Hong_Kong', labelKey: 'timezones.hongKong' },
  { value: 'Asia/Singapore', labelKey: 'timezones.singapore' },
  { value: 'Asia/Tokyo', labelKey: 'timezones.tokyo' },
  { value: 'Asia/Seoul', labelKey: 'timezones.seoul' },
  { value: 'America/New_York', labelKey: 'timezones.newYork' },
  { value: 'Europe/London', labelKey: 'timezones.london' },
  { value: 'Europe/Paris', labelKey: 'timezones.paris' },
  { value: 'UTC', labelKey: 'timezones.utc' }
]

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

function loadTimezone(): string {
  try {
    const stored = localStorage.getItem(TIMEZONE_KEY)
    if (stored && typeof stored === 'string') return stored
  } catch {
    // silent fail
  }
  return DEFAULT_TIMEZONE
}

function loadHardwareAcceleration(): boolean {
  try {
    const stored = localStorage.getItem(HW_ACCEL_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    // silent fail
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
      // silent fail
    }
  },

  setHardwareAcceleration: (enabled: boolean) => {
    set({ hardwareAcceleration: enabled })
    try {
      localStorage.setItem(HW_ACCEL_KEY, String(enabled))
    } catch {
      // silent fail
    }
  },

  resetToDefaults: () => {
    set({ timezone: DEFAULT_TIMEZONE, hardwareAcceleration: DEFAULT_HW_ACCEL })
    try {
      localStorage.clear()
    } catch {
      // silent fail
    }
    clearIndexedDB()
  }
}))
