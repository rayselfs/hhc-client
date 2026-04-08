import { create } from 'zustand'
import type {
  TimerMode,
  TimerStatus,
  TimerPhase,
  TimerSettings,
  TimerState,
  TimerPreset
} from '@shared/types/timer'

const MAX_DURATION_SECONDS = 99 * 3600

const DEFAULT_PRESETS: TimerPreset[] = [
  { id: 'preset-10m', name: '10m', durationSeconds: 600, mode: 'timer' },
  { id: 'preset-5m', name: '5m', durationSeconds: 300, mode: 'timer' },
  { id: 'preset-3m', name: '3m', durationSeconds: 180, mode: 'timer' }
]

const PRESETS_STORAGE_KEY = 'hhc-timer-presets'

export interface TimerStore {
  mode: TimerMode
  totalDuration: number
  reminderEnabled: boolean
  reminderDuration: number
  overtimeMessageEnabled: boolean
  overtimeMessage: string
  timezone: string

  status: TimerStatus
  phase: TimerPhase
  remainingSeconds: number
  overtimeSeconds: number
  progress: number
  formattedTime: string

  targetEndTime: number | null

  presets: TimerPreset[]

  isRunning: () => boolean
  isPaused: () => boolean
  isStopped: () => boolean
  isWarning: () => boolean
  isOvertime: () => boolean

  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  setDuration: (seconds: number) => void
  addTime: (seconds: number) => void
  removeTime: (seconds: number) => void
  setMode: (mode: TimerMode) => void
  tick: (currentMs: number) => void
  setReminder: (enabled: boolean, durationSeconds: number) => void
  setOvertimeMessage: (enabled: boolean, message: string) => void

  addPreset: (name: string, durationSeconds: number) => void
  removePreset: (id: string) => void
  applyPreset: (id: string) => void
  loadPresets: () => void
  savePresets: () => void
}

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
  overtimeMessageEnabled: false,
  overtimeMessage: "Time's Up!",
  timezone: 'UTC'
}

export const DEFAULT_STATE: TimerState = {
  status: 'stopped',
  remainingSeconds: 300,
  phase: 'idle',
  overtimeSeconds: 0,
  progress: 1,
  formattedTime: '05:00'
}

export const useTimerStore = create<TimerStore>()((set, get) => ({
  mode: DEFAULT_SETTINGS.mode,
  totalDuration: DEFAULT_SETTINGS.totalDuration,
  reminderEnabled: DEFAULT_SETTINGS.reminderEnabled,
  reminderDuration: DEFAULT_SETTINGS.reminderDuration,
  overtimeMessageEnabled: DEFAULT_SETTINGS.overtimeMessageEnabled,
  overtimeMessage: DEFAULT_SETTINGS.overtimeMessage,
  timezone: DEFAULT_SETTINGS.timezone,

  status: DEFAULT_STATE.status,
  phase: DEFAULT_STATE.phase,
  remainingSeconds: DEFAULT_STATE.remainingSeconds,
  overtimeSeconds: DEFAULT_STATE.overtimeSeconds,
  progress: DEFAULT_STATE.progress,
  formattedTime: DEFAULT_STATE.formattedTime,

  targetEndTime: null,

  presets: [],

  isRunning: () => get().status === 'running',
  isPaused: () => get().status === 'paused',
  isStopped: () => get().status === 'stopped',
  isWarning: () => get().phase === 'warning',
  isOvertime: () => get().phase === 'overtime',

  start: () => {
    const s = get()
    if (s.status === 'running') return
    const now = Date.now()
    set({
      status: 'running',
      phase: computePhase('running', s.remainingSeconds, s.reminderEnabled, s.reminderDuration),
      targetEndTime: now + s.remainingSeconds * 1000,
      overtimeSeconds: 0
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
    set({
      totalDuration: clamped,
      remainingSeconds: clamped,
      progress: computeProgress(clamped, clamped),
      formattedTime: formatTime(clamped),
      phase: 'idle'
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
    const newTargetEndTime = s.status === 'running' ? now + newRemaining * 1000 : s.targetEndTime

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
      set({
        totalDuration: newTotal,
        remainingSeconds: newRemaining,
        progress: computeProgress(newRemaining, newTotal),
        formattedTime: formatTime(newRemaining)
      })
      return
    }

    const now = Date.now()
    const newTargetEndTime = s.status === 'running' ? now + newRemaining * 1000 : s.targetEndTime

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
    set({ mode })
  },

  tick: (currentMs: number) => {
    const s = get()
    if (s.status !== 'running') return
    if (s.targetEndTime === null) return

    const remainingMs = s.targetEndTime - currentMs
    const rawRemainingSeconds = remainingMs / 1000
    const isOvertimeNow = rawRemainingSeconds <= 0
    const overtimeSeconds = isOvertimeNow ? Math.abs(Math.floor(rawRemainingSeconds)) : 0
    const displayRemaining = isOvertimeNow ? 0 : Math.ceil(rawRemainingSeconds)

    set({
      remainingSeconds: displayRemaining,
      overtimeSeconds,
      phase: computePhase('running', displayRemaining, s.reminderEnabled, s.reminderDuration),
      progress: computeProgress(displayRemaining, s.totalDuration),
      formattedTime: formatTime(displayRemaining)
    })
  },

  setReminder: (enabled: boolean, durationSeconds: number) => {
    const s = get()
    const phase =
      s.status !== 'stopped'
        ? computePhase(s.status, s.remainingSeconds, enabled, durationSeconds)
        : s.phase

    set({ reminderEnabled: enabled, reminderDuration: durationSeconds, phase })
  },

  setOvertimeMessage: (enabled: boolean, message: string) => {
    set({ overtimeMessageEnabled: enabled, overtimeMessage: message })
  },

  addPreset: (name: string, durationSeconds: number) => {
    const s = get()
    const id = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const newPreset: TimerPreset = {
      id,
      name,
      durationSeconds,
      mode: 'timer'
    }
    set({ presets: [...s.presets, newPreset] })
    get().savePresets()
  },

  removePreset: (id: string) => {
    const s = get()
    set({ presets: s.presets.filter((p) => p.id !== id) })
    get().savePresets()
  },

  applyPreset: (id: string) => {
    const s = get()
    if (s.status !== 'stopped') return
    const preset = s.presets.find((p) => p.id === id)
    if (preset) {
      get().setDuration(preset.durationSeconds)
    }
  },

  loadPresets: () => {
    try {
      const stored = localStorage.getItem(PRESETS_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({ presets: parsed })
          return
        }
      }
    } catch {
      // silent fail
    }
    set({ presets: DEFAULT_PRESETS })
  },

  savePresets: () => {
    const s = get()
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(s.presets))
    } catch {
      // silent fail
    }
  }
}))

export interface DisplayValues {
  mainDisplay: string
  subDisplay: string | null
  isRed: boolean
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
    return {
      mainDisplay: formatTime(totalDuration),
      subDisplay: null,
      isRed: false,
      overtimeDisplay: null
    }
  }

  if (phase === 'overtime') {
    return {
      mainDisplay: '00:00',
      subDisplay: null,
      isRed: false,
      overtimeDisplay: formatTime(overtimeSeconds)
    }
  }

  if (phase === 'warning') {
    return {
      mainDisplay: formatTime(remainingSeconds),
      subDisplay: null,
      isRed: true,
      overtimeDisplay: null
    }
  }

  if (reminderEnabled) {
    return {
      mainDisplay: formatTime(remainingSeconds - reminderDuration),
      subDisplay: formatTime(reminderDuration),
      isRed: false,
      overtimeDisplay: null
    }
  }

  return {
    mainDisplay: formatTime(remainingSeconds),
    subDisplay: null,
    isRed: false,
    overtimeDisplay: null
  }
}

export type { TimerMode, TimerStatus, TimerPhase }
