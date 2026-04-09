import { create } from 'zustand'
import { v7 as uuidv7 } from 'uuid'
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

const PRESETS_STORAGE_KEY = 'hhc-timer-presets'
const DURATION_STORAGE_KEY = 'hhc-timer-duration'
const REMINDER_STORAGE_KEY = 'hhc-timer-reminder'

function loadInitialDuration(): number {
  try {
    const stored = localStorage.getItem(DURATION_STORAGE_KEY)
    if (stored) {
      const seconds = parseInt(stored, 10)
      if (!isNaN(seconds) && seconds > 0 && seconds <= MAX_DURATION_SECONDS) return seconds
    }
  } catch {
    // silent fail
  }
  return DEFAULT_SETTINGS.totalDuration
}

function loadInitialPresets(): TimerPreset[] {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // silent fail
  }
  return DEFAULT_PRESETS
}

function loadInitialReminder(): { duration: number; color: string } {
  try {
    const stored = localStorage.getItem(REMINDER_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed && typeof parsed.duration === 'number' && typeof parsed.color === 'string') {
        return { duration: parsed.duration, color: parsed.color }
      }
    }
  } catch {
    // silent fail
  }
  return { duration: DEFAULT_SETTINGS.reminderDuration, color: DEFAULT_SETTINGS.reminderColor }
}

export interface TimerStore {
  mode: TimerMode
  totalDuration: number
  reminderEnabled: boolean
  reminderDuration: number
  reminderColor: string
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
  setReminder: (enabled: boolean, durationSeconds: number, color?: string) => void
  setOvertimeMessage: (enabled: boolean, message: string) => void

  addPreset: (name: string, durationSeconds: number) => void
  removePreset: (id: string) => void
  applyPreset: (id: string) => void
  loadPresets: () => void
  savePresets: () => void
  loadDuration: () => void
  saveDuration: () => void
  loadReminder: () => void
  saveReminder: () => void
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
  reminderColor: '#ef4444',
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

const _initialDuration = loadInitialDuration()
const _initialPresets = loadInitialPresets()
const _initialReminder = loadInitialReminder()

export const useTimerStore = create<TimerStore>()((set, get) => ({
  mode: DEFAULT_SETTINGS.mode,
  totalDuration: _initialDuration,
  reminderEnabled: DEFAULT_SETTINGS.reminderEnabled,
  reminderDuration: _initialReminder.duration,
  reminderColor: _initialReminder.color,
  overtimeMessageEnabled: DEFAULT_SETTINGS.overtimeMessageEnabled,
  overtimeMessage: DEFAULT_SETTINGS.overtimeMessage,
  timezone: DEFAULT_SETTINGS.timezone,

  status: DEFAULT_STATE.status,
  phase: DEFAULT_STATE.phase,
  remainingSeconds: _initialDuration,
  overtimeSeconds: DEFAULT_STATE.overtimeSeconds,
  progress: DEFAULT_STATE.progress,
  formattedTime: formatTime(_initialDuration),

  targetEndTime: null,

  presets: _initialPresets,

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
    get().saveDuration()
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
      get().saveDuration()
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
      const autoDisableReminder = s.reminderEnabled && s.reminderDuration >= newTotal
      set({
        totalDuration: newTotal,
        remainingSeconds: newRemaining,
        progress: computeProgress(newRemaining, newTotal),
        formattedTime: formatTime(newRemaining),
        ...(autoDisableReminder ? { reminderEnabled: false } : {})
      })
      get().saveDuration()
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
    get().saveReminder()
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
  },

  loadDuration: () => {
    try {
      const stored = localStorage.getItem(DURATION_STORAGE_KEY)
      if (stored) {
        const seconds = parseInt(stored, 10)
        if (!isNaN(seconds) && seconds > 0 && seconds <= MAX_DURATION_SECONDS) {
          set({
            totalDuration: seconds,
            remainingSeconds: seconds,
            progress: computeProgress(seconds, seconds),
            formattedTime: formatTime(seconds)
          })
        }
      }
    } catch {
      // silent fail
    }
  },

  saveDuration: () => {
    const s = get()
    try {
      localStorage.setItem(DURATION_STORAGE_KEY, String(s.totalDuration))
    } catch {
      // silent fail
    }
  },

  loadReminder: () => {
    try {
      const stored = localStorage.getItem(REMINDER_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed && typeof parsed.duration === 'number' && typeof parsed.color === 'string') {
          set({ reminderDuration: parsed.duration, reminderColor: parsed.color })
        }
      }
    } catch {
      // silent fail
    }
  },

  saveReminder: () => {
    const s = get()
    try {
      localStorage.setItem(
        REMINDER_STORAGE_KEY,
        JSON.stringify({ duration: s.reminderDuration, color: s.reminderColor })
      )
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
    if (reminderEnabled) {
      const mainSeconds = totalDuration - reminderDuration
      return {
        mainDisplay: formatTime(Math.max(0, mainSeconds)),
        subDisplay: formatTime(reminderDuration),
        isRed: false,
        overtimeDisplay: null
      }
    }
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
