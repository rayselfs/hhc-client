import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from '@heroui/react/toast'
import i18n from '@renderer/i18n'
import { hhcPersistStorage, createKey } from '@renderer/lib/persist-storage'
import { clearAllSiteData } from '@renderer/lib/site-data'
import { isElectron } from '@renderer/lib/env'
import { ThemePreference } from '@renderer/types/theme'
import type { WhisperModel } from '@shared/ipc-channels'
import type { SyncOfflinePolicy } from '@shared/types/folder'

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

export const AZURE_REGION_OPTIONS = [
  { value: 'eastasia', label: 'East Asia' },
  { value: 'southeastasia', label: 'Southeast Asia' },
  { value: 'eastus', label: 'East US' },
  { value: 'eastus2', label: 'East US 2' },
  { value: 'westus', label: 'West US' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'westus3', label: 'West US 3' },
  { value: 'centralus', label: 'Central US' },
  { value: 'southcentralus', label: 'South Central US' },
  { value: 'northcentralus', label: 'North Central US' },
  { value: 'westcentralus', label: 'West Central US' },
  { value: 'canadacentral', label: 'Canada Central' },
  { value: 'canadaeast', label: 'Canada East' },
  { value: 'brazilsouth', label: 'Brazil South' },
  { value: 'northeurope', label: 'North Europe' },
  { value: 'westeurope', label: 'West Europe' },
  { value: 'uksouth', label: 'UK South' },
  { value: 'ukwest', label: 'UK West' },
  { value: 'francecentral', label: 'France Central' },
  { value: 'germanywestcentral', label: 'Germany West Central' },
  { value: 'norwayeast', label: 'Norway East' },
  { value: 'switzerlandnorth', label: 'Switzerland North' },
  { value: 'swedencentral', label: 'Sweden Central' },
  { value: 'polandcentral', label: 'Poland Central' },
  { value: 'italynorth', label: 'Italy North' },
  { value: 'spaincentral', label: 'Spain Central' },
  { value: 'uaenorth', label: 'UAE North' },
  { value: 'southafricanorth', label: 'South Africa North' },
  { value: 'centralindia', label: 'Central India' },
  { value: 'japaneast', label: 'Japan East' },
  { value: 'japanwest', label: 'Japan West' },
  { value: 'koreacentral', label: 'Korea Central' },
  { value: 'australiaeast', label: 'Australia East' },
  { value: 'australiasoutheast', label: 'Australia Southeast' }
] as const

const DEFAULT_TIMEZONE = 'Asia/Taipei'
const DEFAULT_HW_ACCEL = true
const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'
const DEFAULT_TIMER_RING_COLOR = '#3b82f6'
const DEFAULT_TIMER_RING_COLOR_ENABLED = false
const DEFAULT_TRASH_RETENTION_DAYS = 30
const DEFAULT_REMINDER_MODE = 'subtract'
export const HHC_DEFAULT_ONEDRIVE_CLIENT_ID = '4f4c2f2c-8f2a-4c4b-9d2e-8c3a7d638c02'
const RELOAD_DELAY_MS = 500
const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark']
const OFFLINE_POLICIES: SyncOfflinePolicy[] = ['online-only', 'on-demand', 'always-offline']
type ReminderMode = 'subtract' | 'add'
const REMINDER_MODES: ReminderMode[] = ['subtract', 'add']

export type SpeechProvider = 'azure' | 'gcp' | 'webSpeech' | 'whisper'

export interface AzureSpeechConfig {
  region: string
  language: 'zh-TW' | 'zh-CN'
}

export interface GcpSpeechConfig {
  language: 'cmn-Hant-TW' | 'cmn-Hans-CN'
}

export interface WhisperSpeechConfig {
  modelDir: string
  installedModel: WhisperModel | null
}

export interface SpeechSettings {
  activeProvider: SpeechProvider
  azure: AzureSpeechConfig
  gcp: GcpSpeechConfig
  whisper: WhisperSpeechConfig
}

export interface OneDriveSettings {
  customClientId: string
  defaultOfflinePolicy: SyncOfflinePolicy
}

export const DEFAULT_SPEECH: SpeechSettings = {
  activeProvider: 'azure',
  azure: { region: 'eastasia', language: 'zh-TW' },
  gcp: { language: 'cmn-Hant-TW' },
  whisper: { modelDir: '', installedModel: null }
}

export const DEFAULT_ONEDRIVE: OneDriveSettings = {
  customClientId: '',
  defaultOfflinePolicy: 'always-offline'
}

export function validateOneDriveClientId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim())
}

export function getEffectiveOneDriveClientId(settings: OneDriveSettings): string {
  return settings.customClientId.trim() || HHC_DEFAULT_ONEDRIVE_CLIENT_ID
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizePositiveInteger(
  value: unknown,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(0, Math.floor(value)))
}

function normalizeOneDriveSettings(value: unknown): OneDriveSettings {
  if (!isRecord(value)) return DEFAULT_ONEDRIVE

  const customClientId =
    typeof value.customClientId === 'string' && validateOneDriveClientId(value.customClientId)
      ? value.customClientId.trim()
      : DEFAULT_ONEDRIVE.customClientId
  const defaultOfflinePolicy = OFFLINE_POLICIES.includes(
    value.defaultOfflinePolicy as SyncOfflinePolicy
  )
    ? (value.defaultOfflinePolicy as SyncOfflinePolicy)
    : DEFAULT_ONEDRIVE.defaultOfflinePolicy

  return {
    customClientId,
    defaultOfflinePolicy
  }
}

function normalizeSpeechSettings(value: unknown): SpeechSettings {
  if (!isRecord(value)) return DEFAULT_SPEECH

  const activeProvider =
    value.activeProvider === 'azure' ||
    value.activeProvider === 'gcp' ||
    value.activeProvider === 'webSpeech' ||
    value.activeProvider === 'whisper'
      ? value.activeProvider
      : DEFAULT_SPEECH.activeProvider
  const azure = isRecord(value.azure) ? value.azure : {}
  const gcp = isRecord(value.gcp) ? value.gcp : {}
  const whisper = isRecord(value.whisper) ? value.whisper : {}

  return {
    activeProvider,
    azure: {
      region:
        typeof azure.region === 'string' &&
        AZURE_REGION_OPTIONS.some((option) => option.value === azure.region)
          ? azure.region
          : DEFAULT_SPEECH.azure.region,
      language:
        azure.language === 'zh-TW' || azure.language === 'zh-CN'
          ? azure.language
          : DEFAULT_SPEECH.azure.language
    },
    gcp: {
      language:
        gcp.language === 'cmn-Hant-TW' || gcp.language === 'cmn-Hans-CN'
          ? gcp.language
          : DEFAULT_SPEECH.gcp.language
    },
    whisper: {
      modelDir: typeof whisper.modelDir === 'string' ? whisper.modelDir : '',
      installedModel:
        whisper.installedModel === 'whisper-base' ||
        whisper.installedModel === 'whisper-small' ||
        whisper.installedModel === 'whisper-medium'
          ? whisper.installedModel
          : null
    }
  }
}

export function normalizeSettingsState(value: unknown): Partial<SettingsStore> {
  const state = isRecord(value) ? value : {}
  const timezone =
    typeof state.timezone === 'string' &&
    TIMEZONE_OPTIONS.some((option) => option.value === state.timezone)
      ? state.timezone
      : DEFAULT_TIMEZONE
  const themePreference = THEME_PREFERENCES.includes(state.themePreference as ThemePreference)
    ? (state.themePreference as ThemePreference)
    : DEFAULT_THEME_PREFERENCE
  const timerRingColor =
    typeof state.timerRingColor === 'string' && /^#[0-9a-f]{6}$/i.test(state.timerRingColor)
      ? state.timerRingColor
      : DEFAULT_TIMER_RING_COLOR
  const reminderMode = REMINDER_MODES.includes(state.reminderMode as ReminderMode)
    ? (state.reminderMode as ReminderMode)
    : DEFAULT_REMINDER_MODE

  return {
    timezone,
    hardwareAcceleration:
      typeof state.hardwareAcceleration === 'boolean'
        ? state.hardwareAcceleration
        : DEFAULT_HW_ACCEL,
    themePreference,
    timerRingColor,
    timerRingColorEnabled:
      typeof state.timerRingColorEnabled === 'boolean'
        ? state.timerRingColorEnabled
        : DEFAULT_TIMER_RING_COLOR_ENABLED,
    speech: normalizeSpeechSettings(state.speech),
    oneDrive: normalizeOneDriveSettings(state.oneDrive),
    trashRetentionDays: normalizePositiveInteger(
      state.trashRetentionDays,
      DEFAULT_TRASH_RETENTION_DAYS
    ),
    reminderMode
  }
}

export interface SettingsStore {
  timezone: string
  hardwareAcceleration: boolean
  themePreference: ThemePreference
  timerRingColor: string
  timerRingColorEnabled: boolean
  speech: SpeechSettings
  oneDrive: OneDriveSettings
  trashRetentionDays: number
  reminderMode: 'subtract' | 'add'
  setTimezone: (tz: string) => void
  setHardwareAcceleration: (enabled: boolean) => void
  setThemePreference: (pref: ThemePreference) => void
  setTimerRingColor: (color: string) => void
  setTimerRingColorEnabled: (enabled: boolean) => void
  setSpeech: (settings: SpeechSettings) => void
  setOneDrive: (settings: OneDriveSettings) => void
  setTrashRetentionDays: (days: number) => void
  setReminderMode: (mode: 'subtract' | 'add') => void
  resetToDefaults: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      timezone: DEFAULT_TIMEZONE,
      hardwareAcceleration: DEFAULT_HW_ACCEL,
      themePreference: DEFAULT_THEME_PREFERENCE,
      timerRingColor: DEFAULT_TIMER_RING_COLOR,
      timerRingColorEnabled: DEFAULT_TIMER_RING_COLOR_ENABLED,
      speech: DEFAULT_SPEECH,
      oneDrive: DEFAULT_ONEDRIVE,
      trashRetentionDays: DEFAULT_TRASH_RETENTION_DAYS,
      reminderMode: DEFAULT_REMINDER_MODE,

      setTimezone: (tz: string) => {
        set({ timezone: tz })
      },

      setHardwareAcceleration: (enabled: boolean) => {
        set({ hardwareAcceleration: enabled })
      },

      setThemePreference: (pref: ThemePreference) => {
        set({ themePreference: pref })
      },

      setTimerRingColor: (color: string) => {
        set({ timerRingColor: color })
      },

      setSpeech: (settings: SpeechSettings) => {
        set({ speech: settings })
      },

      setOneDrive: (settings: OneDriveSettings) => {
        const customClientId = settings.customClientId.trim()
        if (customClientId && !validateOneDriveClientId(customClientId)) return
        set({
          oneDrive: {
            customClientId,
            defaultOfflinePolicy: settings.defaultOfflinePolicy
          }
        })
      },

      setTimerRingColorEnabled: (enabled: boolean) => {
        set({ timerRingColorEnabled: enabled })
      },

      setTrashRetentionDays: (days: number) => {
        set({ trashRetentionDays: days })
      },

      setReminderMode: (mode: 'subtract' | 'add') => {
        set({ reminderMode: mode })
      },

      resetToDefaults: () => {
        clearAllSiteData()
        toast.success(i18n.t('toast.settingsReset'))
        if (isElectron()) {
          setTimeout(() => window.api.app.relaunch(), RELOAD_DELAY_MS)
        } else {
          setTimeout(() => window.location.reload(), RELOAD_DELAY_MS)
        }
      }
    }),
    {
      name: createKey('settings'),
      storage: hhcPersistStorage,
      version: 9,
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
          state.themePreference = themePreference
        }
        if (version < 2) {
          const ringColor = state.timerRingColor
          if (
            typeof ringColor === 'string' &&
            (ringColor.includes('var(') || !ringColor.startsWith('#'))
          ) {
            state.timerRingColor = DEFAULT_TIMER_RING_COLOR
          }
        }
        if (version < 3) {
          state.azureSpeech = null
        }
        if (version < 4) {
          state.speech = DEFAULT_SPEECH
        }
        if (version < 5) {
          const speech = state.speech as Record<string, unknown> | undefined
          if (speech && typeof speech === 'object') {
            const whisper = speech.whisper as Record<string, unknown> | undefined
            if (whisper && typeof whisper === 'object') {
              whisper.installedModel = null
            }
          }
        }
        if (version < 6) {
          if (state.timerRingColorEnabled === undefined) {
            state.timerRingColorEnabled = DEFAULT_TIMER_RING_COLOR_ENABLED
          }
        }
        if (version < 7) {
          state.trashRetentionDays = DEFAULT_TRASH_RETENTION_DAYS
        }
        if (version < 8) {
          state.reminderMode = DEFAULT_REMINDER_MODE
        }
        if (version < 9) {
          state.oneDrive = DEFAULT_ONEDRIVE
        }
        return normalizeSettingsState(state)
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...normalizeSettingsState(persistedState)
      }),
      partialize: (state) => ({
        timezone: state.timezone,
        hardwareAcceleration: state.hardwareAcceleration,
        themePreference: state.themePreference,
        timerRingColor: state.timerRingColor,
        timerRingColorEnabled: state.timerRingColorEnabled,
        speech: state.speech,
        oneDrive: state.oneDrive,
        trashRetentionDays: state.trashRetentionDays,
        reminderMode: state.reminderMode
      })
    }
  )
)
