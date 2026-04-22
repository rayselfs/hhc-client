import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v7 as uuidv7 } from 'uuid'
import type { TimerMode, TimerSettings, TimerPreset } from '@shared/types/timer'
import { MAX_DURATION_SECONDS } from '@shared/constants/timer'
import { hhcPersistStorage, createKey } from '@renderer/lib/persist-storage'

export const DEFAULT_PRESETS: TimerPreset[] = [
  { id: uuidv7(), name: '10:00', durationSeconds: 600, mode: 'timer' },
  { id: uuidv7(), name: '05:00', durationSeconds: 300, mode: 'timer' },
  { id: uuidv7(), name: '03:00', durationSeconds: 180, mode: 'timer' }
]

export const DEFAULT_SETTINGS: TimerSettings = {
  mode: 'timer',
  totalDuration: 300,
  reminderEnabled: false,
  reminderDuration: 60,
  reminderColor: '#ef4444',
  overtimeMessageEnabled: false,
  overtimeMessage: "Time's Up!"
}

export interface TimerConfigState {
  mode: TimerMode
  totalDuration: number
  reminderEnabled: boolean
  reminderDuration: number
  reminderColor: string
  overtimeMessageEnabled: boolean
  overtimeMessage: string
  presets: TimerPreset[]

  setOvertimeMessage: (enabled: boolean, message: string) => void
  addPreset: (name: string, durationSeconds: number) => void
  removePreset: (id: string) => void
}

export const useTimerConfigStore = create<TimerConfigState>()(
  persist(
    (set, get) => ({
      mode: DEFAULT_SETTINGS.mode,
      totalDuration: DEFAULT_SETTINGS.totalDuration,
      reminderEnabled: DEFAULT_SETTINGS.reminderEnabled,
      reminderDuration: DEFAULT_SETTINGS.reminderDuration,
      reminderColor: DEFAULT_SETTINGS.reminderColor,
      overtimeMessageEnabled: DEFAULT_SETTINGS.overtimeMessageEnabled,
      overtimeMessage: DEFAULT_SETTINGS.overtimeMessage,
      presets: DEFAULT_PRESETS,

      setOvertimeMessage: (enabled: boolean, message: string) => {
        set({ overtimeMessageEnabled: enabled, overtimeMessage: message })
      },

      addPreset: (name: string, durationSeconds: number) => {
        const s = get()
        const id = uuidv7()
        const newPreset: TimerPreset = {
          id,
          name,
          durationSeconds: Math.min(MAX_DURATION_SECONDS, durationSeconds),
          mode: 'timer'
        }
        set({ presets: [...s.presets, newPreset] })
      },

      removePreset: (id: string) => {
        const s = get()
        set({ presets: s.presets.filter((p) => p.id !== id) })
      }
    }),
    {
      name: createKey('timer-config'),
      storage: hhcPersistStorage,
      version: 1,
      migrate: (persistedState, _version) => {
        void _version
        const newKeyExists = localStorage.getItem(createKey('timer-config')) !== null
        if (!newKeyExists) {
          try {
            const oldRaw = localStorage.getItem(createKey('timer'))
            if (oldRaw) {
              const oldParsed = JSON.parse(oldRaw) as { state?: Partial<TimerConfigState> }
              const old = oldParsed?.state
              if (old) {
                const migrated: Partial<TimerConfigState> = {}
                if (old.mode !== undefined) migrated.mode = old.mode
                if (old.totalDuration !== undefined) migrated.totalDuration = old.totalDuration
                if (old.reminderEnabled !== undefined)
                  migrated.reminderEnabled = old.reminderEnabled
                if (old.reminderDuration !== undefined)
                  migrated.reminderDuration = old.reminderDuration
                if (old.reminderColor !== undefined) migrated.reminderColor = old.reminderColor
                if (old.overtimeMessageEnabled !== undefined)
                  migrated.overtimeMessageEnabled = old.overtimeMessageEnabled
                if (old.overtimeMessage !== undefined)
                  migrated.overtimeMessage = old.overtimeMessage
                if (old.presets !== undefined) migrated.presets = old.presets
                const result = persistedState as TimerConfigState
                return { ...result, ...migrated }
              }
            }
          } catch (_e) {
            void _e
          }
        }
        return persistedState as TimerConfigState
      },
      partialize: (state) => ({
        mode: state.mode,
        totalDuration: state.totalDuration,
        reminderEnabled: state.reminderEnabled,
        reminderDuration: state.reminderDuration,
        reminderColor: state.reminderColor,
        overtimeMessageEnabled: state.overtimeMessageEnabled,
        overtimeMessage: state.overtimeMessage,
        presets: state.presets
      })
    }
  )
)
