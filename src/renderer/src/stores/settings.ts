import { create } from 'zustand'
import { createStorageKey } from '@renderer/lib/utils'

const SETTINGS_STORAGE_KEY = createStorageKey('settings')

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

interface SettingsData {
  timezone: string
  hardwareAcceleration: boolean
}

const DEFAULT_SETTINGS: SettingsData = {
  timezone: 'Asia/Taipei',
  hardwareAcceleration: true
}

function loadInitialSettings(): SettingsData {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (
        parsed &&
        typeof parsed.timezone === 'string' &&
        typeof parsed.hardwareAcceleration === 'boolean'
      ) {
        return parsed
      }
    }
  } catch {
    // silent fail
  }
  return DEFAULT_SETTINGS
}

export interface SettingsStore extends SettingsData {
  setTimezone: (tz: string) => void
  setHardwareAcceleration: (enabled: boolean) => void
  resetToDefaults: () => void
}

const _initialSettings = loadInitialSettings()

export const useSettingsStore = create<SettingsStore>()((set, get) => ({
  timezone: _initialSettings.timezone,
  hardwareAcceleration: _initialSettings.hardwareAcceleration,

  setTimezone: (tz: string) => {
    set({ timezone: tz })
    const s = get()
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          timezone: s.timezone,
          hardwareAcceleration: s.hardwareAcceleration
        })
      )
    } catch {
      // silent fail
    }
  },

  setHardwareAcceleration: (enabled: boolean) => {
    set({ hardwareAcceleration: enabled })
    const s = get()
    try {
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          timezone: s.timezone,
          hardwareAcceleration: s.hardwareAcceleration
        })
      )
    } catch {
      // silent fail
    }
  },

  resetToDefaults: () => {
    set(DEFAULT_SETTINGS)
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS))
    } catch {
      // silent fail
    }
  }
}))
