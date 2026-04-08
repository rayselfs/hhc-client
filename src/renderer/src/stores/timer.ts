import { create } from 'zustand'
import type {
  TimerMode,
  TimerStatus,
  TimerPhase,
  TimerSettings,
  TimerState
} from '@shared/types/timer'

const MAX_DURATION_SECONDS = 99 * 3600

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
  }
}))

export type { TimerMode, TimerStatus, TimerPhase }
