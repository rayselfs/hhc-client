import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v7 as uuidv7 } from 'uuid'
import type {
  TimerMode,
  TimerStatus,
  TimerPhase,
  TimerSettings,
  TimerState,
  TimerPreset
} from '@shared/types/timer'
import { MAX_DURATION_SECONDS } from '@shared/constants/timer'
import { hhcPersistStorage, createKey } from '@renderer/lib/persist-storage'

const DEFAULT_PRESETS: TimerPreset[] = [
  {
    id: '019d7109-f7bf-70ef-a9de-a212faff78b9',
    name: '10:00',
    durationSeconds: 600,
    mode: 'timer'
  },
  {
    id: '019d7109-f7c1-705d-a343-119e8d9b9bff',
    name: '05:00',
    durationSeconds: 300,
    mode: 'timer'
  },
  { id: '019d7109-f7c1-705d-a343-16da950eba1d', name: '03:00', durationSeconds: 180, mode: 'timer' }
]

export interface TimerStore {
  // ── Config (persistent, low-frequency) ─────────────────────
  mode: TimerMode
  totalDuration: number
  reminderEnabled: boolean
  reminderDuration: number
  reminderColor: string
  overtimeMessageEnabled: boolean
  overtimeMessage: string

  // ── Runtime (tick-driven, ephemeral) ───────────────────────
  status: TimerStatus
  phase: TimerPhase
  remainingSeconds: number
  overtimeSeconds: number
  progress: number
  formattedTime: string
  targetEndTime: number | null

  // ── Presets ────────────────────────────────────────────────
  presets: TimerPreset[]

  // ── Predicates ─────────────────────────────────────────────
  isRunning: () => boolean
  isPaused: () => boolean
  isStopped: () => boolean
  isWarning: () => boolean
  isOvertime: () => boolean

  // ── Lifecycle actions ──────────────────────────────────────
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  tick: (currentMs: number) => void

  // ── Config actions ─────────────────────────────────────────
  setDuration: (seconds: number) => void
  addTime: (seconds: number) => void
  removeTime: (seconds: number) => void
  setMode: (mode: TimerMode) => void
  setReminder: (enabled: boolean, durationSeconds: number, color?: string) => void
  setOvertimeMessage: (enabled: boolean, message: string) => void

  // ── Preset actions ─────────────────────────────────────────
  addPreset: (name: string, durationSeconds: number) => void
  removePreset: (id: string) => void
  applyPreset: (id: string) => void
}

/** Configuration fields — persistent settings, low-frequency changes */
type TimerConfig = Pick<
  TimerStore,
  | 'mode'
  | 'totalDuration'
  | 'reminderEnabled'
  | 'reminderDuration'
  | 'reminderColor'
  | 'overtimeMessageEnabled'
  | 'overtimeMessage'
>

/** Runtime fields — tick-driven, high-frequency, ephemeral */
type TimerRuntime = Pick<
  TimerStore,
  | 'status'
  | 'phase'
  | 'remainingSeconds'
  | 'overtimeSeconds'
  | 'progress'
  | 'formattedTime'
  | 'targetEndTime'
>

function formatTime(totalSeconds: number): string {
  const abs = Math.abs(Math.round(totalSeconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function computePhase(
  status: TimerStatus,
  remainingSeconds: number,
  reminderEnabled: boolean,
  reminderDuration: number
): TimerPhase {
  if (status === 'stopped') return 'idle'
  if (remainingSeconds <= 0) return 'overtime'
  if (reminderEnabled && remainingSeconds <= reminderDuration) return 'warning'
  return 'main'
}

function computeProgress(remainingSeconds: number, totalDuration: number): number {
  if (totalDuration <= 0) return 0
  return Math.max(0, Math.min(1, remainingSeconds / totalDuration))
}

export const DEFAULT_SETTINGS: TimerSettings = {
  mode: 'timer',
  totalDuration: 300,
  reminderEnabled: false,
  reminderDuration: 60,
  reminderColor: '#ef4444',
  overtimeMessageEnabled: false,
  overtimeMessage: "Time's Up!"
}

export const DEFAULT_STATE: TimerState = {
  status: 'stopped',
  remainingSeconds: 300,
  phase: 'idle',
  overtimeSeconds: 0,
  progress: 1,
  formattedTime: '05:00'
}

export const useTimerStore = create<TimerStore>()(
  persist(
    (set, get) => ({
      mode: DEFAULT_SETTINGS.mode,
      totalDuration: DEFAULT_SETTINGS.totalDuration,
      reminderEnabled: DEFAULT_SETTINGS.reminderEnabled,
      reminderDuration: DEFAULT_SETTINGS.reminderDuration,
      reminderColor: DEFAULT_SETTINGS.reminderColor,
      overtimeMessageEnabled: DEFAULT_SETTINGS.overtimeMessageEnabled,
      overtimeMessage: DEFAULT_SETTINGS.overtimeMessage,

      status: DEFAULT_STATE.status,
      phase: DEFAULT_STATE.phase,
      remainingSeconds: DEFAULT_SETTINGS.totalDuration,
      overtimeSeconds: DEFAULT_STATE.overtimeSeconds,
      progress: DEFAULT_STATE.progress,
      formattedTime: formatTime(DEFAULT_SETTINGS.totalDuration),

      targetEndTime: null,

      presets: DEFAULT_PRESETS,

      isRunning: () => get().status === 'running',
      isPaused: () => get().status === 'paused',
      isStopped: () => get().status === 'stopped',
      isWarning: () => get().phase === 'warning',
      isOvertime: () => get().phase === 'overtime',

      start: () => {
        const s = get()
        if (s.status === 'running') return
        const duration = s.phase === 'overtime' ? s.totalDuration : s.remainingSeconds
        const now = Date.now()
        set({
          status: 'running',
          phase: computePhase('running', duration, s.reminderEnabled, s.reminderDuration),
          remainingSeconds: duration,
          targetEndTime: now + duration * 1000,
          overtimeSeconds: 0,
          progress: computeProgress(duration, s.totalDuration),
          formattedTime: formatTime(duration)
        })
      },

      pause: () => {
        const s = get()
        if (s.status !== 'running') return
        set({
          status: 'paused',
          phase: computePhase('paused', s.remainingSeconds, s.reminderEnabled, s.reminderDuration),
          targetEndTime: null
        })
      },

      resume: () => {
        const s = get()
        if (s.status !== 'paused') return
        const now = Date.now()
        set({
          status: 'running',
          phase: computePhase('running', s.remainingSeconds, s.reminderEnabled, s.reminderDuration),
          targetEndTime: now + s.remainingSeconds * 1000
        })
      },

      reset: () => {
        const s = get()
        set({
          status: 'stopped',
          phase: 'idle',
          remainingSeconds: s.totalDuration,
          overtimeSeconds: 0,
          progress: computeProgress(s.totalDuration, s.totalDuration),
          formattedTime: formatTime(s.totalDuration),
          targetEndTime: null
        })
      },

      setDuration: (seconds: number) => {
        const s = get()
        if (s.status !== 'stopped') return
        const clamped = Math.max(0, Math.min(MAX_DURATION_SECONDS, seconds))
        const autoDisableReminder = s.reminderEnabled && s.reminderDuration >= clamped
        set({
          totalDuration: clamped,
          remainingSeconds: clamped,
          progress: computeProgress(clamped, clamped),
          formattedTime: formatTime(clamped),
          phase: 'idle',
          ...(autoDisableReminder ? { reminderEnabled: false } : {})
        })
      },

      addTime: (seconds: number) => {
        const s = get()
        const newRemaining = Math.min(MAX_DURATION_SECONDS, s.remainingSeconds + seconds)

        if (s.status === 'stopped') {
          const newTotal = Math.min(MAX_DURATION_SECONDS, s.totalDuration + seconds)
          set({
            totalDuration: newTotal,
            remainingSeconds: newRemaining,
            progress: computeProgress(newRemaining, newTotal),
            formattedTime: formatTime(newRemaining)
          })
          return
        }

        const now = Date.now()
        const newTargetEndTime =
          s.status === 'running' ? now + newRemaining * 1000 : s.targetEndTime

        set({
          remainingSeconds: newRemaining,
          phase: computePhase(s.status, newRemaining, s.reminderEnabled, s.reminderDuration),
          progress: computeProgress(newRemaining, s.totalDuration),
          formattedTime: formatTime(newRemaining),
          targetEndTime: newTargetEndTime
        })
      },

      removeTime: (seconds: number) => {
        const s = get()
        const newRemaining = Math.max(0, s.remainingSeconds - seconds)

        if (s.status === 'stopped') {
          const newTotal = Math.max(0, s.totalDuration - seconds)
          const autoDisableReminder = s.reminderEnabled && s.reminderDuration >= newTotal
          set({
            totalDuration: newTotal,
            remainingSeconds: newRemaining,
            progress: computeProgress(newRemaining, newTotal),
            formattedTime: formatTime(newRemaining),
            ...(autoDisableReminder ? { reminderEnabled: false } : {})
          })
          return
        }

        const now = Date.now()
        const newTargetEndTime =
          s.status === 'running' ? now + newRemaining * 1000 : s.targetEndTime

        set({
          remainingSeconds: newRemaining,
          phase: computePhase(s.status, newRemaining, s.reminderEnabled, s.reminderDuration),
          progress: computeProgress(newRemaining, s.totalDuration),
          formattedTime: formatTime(newRemaining),
          targetEndTime: newTargetEndTime,
          overtimeSeconds: newRemaining <= 0 ? s.overtimeSeconds : 0
        })
      },

      setMode: (mode: TimerMode) => {
        const s = get()
        if (mode === 'clock' && s.status !== 'stopped') {
          get().reset()
        }
        set({ mode })
      },

      tick: (currentMs: number) => {
        const s = get()
        if (s.status !== 'running') return
        if (s.targetEndTime === null) return

        const remainingMs = s.targetEndTime - currentMs
        const rawRemainingSeconds = remainingMs / 1000

        if (rawRemainingSeconds <= 0) {
          set({
            status: 'stopped',
            phase: 'overtime',
            remainingSeconds: 0,
            overtimeSeconds: 0,
            progress: 0,
            formattedTime: '00:00',
            targetEndTime: null
          })
          return
        }

        const displayRemaining = Math.ceil(rawRemainingSeconds)

        set({
          remainingSeconds: displayRemaining,
          overtimeSeconds: 0,
          phase: computePhase('running', displayRemaining, s.reminderEnabled, s.reminderDuration),
          progress: computeProgress(displayRemaining, s.totalDuration),
          formattedTime: formatTime(displayRemaining)
        })
      },

      setReminder: (enabled: boolean, durationSeconds: number, color?: string) => {
        const s = get()
        const phase =
          s.status !== 'stopped'
            ? computePhase(s.status, s.remainingSeconds, enabled, durationSeconds)
            : s.phase

        const update: Partial<TimerStore> = {
          reminderEnabled: enabled,
          reminderDuration: durationSeconds,
          phase
        }
        if (color !== undefined) update.reminderColor = color
        set(update)
      },

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
      },

      applyPreset: (id: string) => {
        const s = get()
        if (s.status !== 'stopped') return
        const preset = s.presets.find((p) => p.id === id)
        if (preset) {
          get().setDuration(preset.durationSeconds)
        }
      }
    }),
    {
      name: createKey('timer'),
      storage: hhcPersistStorage,
      version: 0,
      partialize: (state) => ({
        mode: state.mode,
        totalDuration: state.totalDuration,
        reminderEnabled: state.reminderEnabled,
        reminderDuration: state.reminderDuration,
        reminderColor: state.reminderColor,
        overtimeMessageEnabled: state.overtimeMessageEnabled,
        overtimeMessage: state.overtimeMessage,
        presets: state.presets
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<TimerStore> | undefined
        if (!p) return current
        const totalDuration = p.totalDuration ?? current.totalDuration
        return {
          ...current,
          ...p,
          remainingSeconds: totalDuration,
          progress: computeProgress(totalDuration, totalDuration),
          formattedTime: formatTime(totalDuration)
        }
      }
    }
  )
)

export interface DisplayValues {
  mainDisplay: string
  subDisplay: string | null
  overtimeDisplay: string | null
}

export function getDisplayValues(
  state: Pick<
    TimerStore,
    | 'phase'
    | 'remainingSeconds'
    | 'reminderDuration'
    | 'overtimeSeconds'
    | 'totalDuration'
    | 'reminderEnabled'
  >
): DisplayValues {
  const {
    phase,
    remainingSeconds,
    reminderDuration,
    overtimeSeconds,
    totalDuration,
    reminderEnabled
  } = state

  if (phase === 'idle') {
    if (reminderEnabled) {
      const mainSeconds = totalDuration - reminderDuration
      return {
        mainDisplay: formatTime(Math.max(0, mainSeconds)),
        subDisplay: formatTime(reminderDuration),
        overtimeDisplay: null
      }
    }
    return {
      mainDisplay: formatTime(totalDuration),
      subDisplay: null,
      overtimeDisplay: null
    }
  }

  if (phase === 'overtime') {
    return {
      mainDisplay: '00:00',
      subDisplay: null,
      overtimeDisplay: formatTime(overtimeSeconds)
    }
  }

  if (phase === 'warning') {
    return {
      mainDisplay: formatTime(remainingSeconds),
      subDisplay: null,
      overtimeDisplay: null
    }
  }

  if (reminderEnabled) {
    return {
      mainDisplay: formatTime(remainingSeconds - reminderDuration),
      subDisplay: formatTime(reminderDuration),
      overtimeDisplay: null
    }
  }

  return {
    mainDisplay: formatTime(remainingSeconds),
    subDisplay: null,
    overtimeDisplay: null
  }
}

export type { TimerMode, TimerStatus, TimerPhase, TimerConfig, TimerRuntime }
