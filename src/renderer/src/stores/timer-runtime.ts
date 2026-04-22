import { create } from 'zustand'
import type { TimerMode, TimerStatus, TimerPhase, TimerState } from '@shared/types/timer'
import { MAX_DURATION_SECONDS } from '@shared/constants/timer'
import { useTimerConfigStore } from './timer-config'

export const DEFAULT_STATE: TimerState = {
  status: 'stopped',
  remainingSeconds: 300,
  phase: 'idle',
  overtimeSeconds: 0,
  progress: 1,
  formattedTime: '05:00'
}

export function formatTime(totalSeconds: number): string {
  const abs = Math.abs(Math.round(totalSeconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function computePhase(
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

export function computeProgress(remainingSeconds: number, totalDuration: number): number {
  if (totalDuration <= 0) return 0
  return Math.max(0, Math.min(1, remainingSeconds / totalDuration))
}

export interface TimerRuntimeState {
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
  tick: (currentMs: number) => void

  setDuration: (seconds: number) => void
  addTime: (seconds: number) => void
  removeTime: (seconds: number) => void
  setMode: (mode: TimerMode) => void
  setReminder: (enabled: boolean, durationSeconds: number, color?: string) => void
  applyPreset: (id: string) => void
}

export const useTimerRuntimeStore = create<TimerRuntimeState>()((set, get) => ({
  status: DEFAULT_STATE.status,
  phase: DEFAULT_STATE.phase,
  remainingSeconds: useTimerConfigStore.getState().totalDuration,
  overtimeSeconds: DEFAULT_STATE.overtimeSeconds,
  progress: DEFAULT_STATE.progress,
  formattedTime: formatTime(useTimerConfigStore.getState().totalDuration),
  targetEndTime: null,

  isRunning: () => get().status === 'running',
  isPaused: () => get().status === 'paused',
  isStopped: () => get().status === 'stopped',
  isWarning: () => get().phase === 'warning',
  isOvertime: () => get().phase === 'overtime',

  start: () => {
    const s = get()
    if (s.status === 'running') return
    const cfg = useTimerConfigStore.getState()
    const duration = s.phase === 'overtime' ? cfg.totalDuration : s.remainingSeconds
    const now = Date.now()
    set({
      status: 'running',
      phase: computePhase('running', duration, cfg.reminderEnabled, cfg.reminderDuration),
      remainingSeconds: duration,
      targetEndTime: now + duration * 1000,
      overtimeSeconds: 0,
      progress: computeProgress(duration, cfg.totalDuration),
      formattedTime: formatTime(duration)
    })
  },

  pause: () => {
    const s = get()
    if (s.status !== 'running') return
    const cfg = useTimerConfigStore.getState()
    set({
      status: 'paused',
      phase: computePhase('paused', s.remainingSeconds, cfg.reminderEnabled, cfg.reminderDuration),
      targetEndTime: null
    })
  },

  resume: () => {
    const s = get()
    if (s.status !== 'paused') return
    const cfg = useTimerConfigStore.getState()
    const now = Date.now()
    set({
      status: 'running',
      phase: computePhase('running', s.remainingSeconds, cfg.reminderEnabled, cfg.reminderDuration),
      targetEndTime: now + s.remainingSeconds * 1000
    })
  },

  reset: () => {
    const s = get()
    const cfg = useTimerConfigStore.getState()
    const totalDuration = s.status !== 'stopped' ? cfg.totalDuration : cfg.totalDuration
    set({
      status: 'stopped',
      phase: 'idle',
      remainingSeconds: totalDuration,
      overtimeSeconds: 0,
      progress: computeProgress(totalDuration, totalDuration),
      formattedTime: formatTime(totalDuration),
      targetEndTime: null
    })
  },

  setDuration: (seconds: number) => {
    const s = get()
    if (s.status !== 'stopped') return
    const cfg = useTimerConfigStore.getState()
    const clamped = Math.max(0, Math.min(MAX_DURATION_SECONDS, seconds))
    const autoDisableReminder = cfg.reminderEnabled && cfg.reminderDuration >= clamped
    useTimerConfigStore.setState({
      totalDuration: clamped,
      ...(autoDisableReminder ? { reminderEnabled: false } : {})
    })
    set({
      remainingSeconds: clamped,
      progress: computeProgress(clamped, clamped),
      formattedTime: formatTime(clamped),
      phase: 'idle'
    })
  },

  addTime: (seconds: number) => {
    const s = get()
    const cfg = useTimerConfigStore.getState()
    const newRemaining = Math.min(MAX_DURATION_SECONDS, s.remainingSeconds + seconds)

    if (s.status === 'stopped') {
      const newTotal = Math.min(MAX_DURATION_SECONDS, cfg.totalDuration + seconds)
      useTimerConfigStore.setState({ totalDuration: newTotal })
      set({
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
      phase: computePhase(s.status, newRemaining, cfg.reminderEnabled, cfg.reminderDuration),
      progress: computeProgress(newRemaining, cfg.totalDuration),
      formattedTime: formatTime(newRemaining),
      targetEndTime: newTargetEndTime
    })
  },

  removeTime: (seconds: number) => {
    const s = get()
    const cfg = useTimerConfigStore.getState()
    const newRemaining = Math.max(0, s.remainingSeconds - seconds)

    if (s.status === 'stopped') {
      const newTotal = Math.max(0, cfg.totalDuration - seconds)
      const autoDisableReminder = cfg.reminderEnabled && cfg.reminderDuration >= newTotal
      useTimerConfigStore.setState({
        totalDuration: newTotal,
        ...(autoDisableReminder ? { reminderEnabled: false } : {})
      })
      set({
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
      phase: computePhase(s.status, newRemaining, cfg.reminderEnabled, cfg.reminderDuration),
      progress: computeProgress(newRemaining, cfg.totalDuration),
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
    useTimerConfigStore.setState({ mode })
  },

  tick: (currentMs: number) => {
    const s = get()
    if (s.status !== 'running') return
    if (s.targetEndTime === null) return

    const cfg = useTimerConfigStore.getState()
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
      phase: computePhase('running', displayRemaining, cfg.reminderEnabled, cfg.reminderDuration),
      progress: computeProgress(displayRemaining, cfg.totalDuration),
      formattedTime: formatTime(displayRemaining)
    })
  },

  setReminder: (enabled: boolean, durationSeconds: number, color?: string) => {
    const s = get()
    const phase =
      s.status !== 'stopped'
        ? computePhase(s.status, s.remainingSeconds, enabled, durationSeconds)
        : s.phase

    useTimerConfigStore.setState({
      reminderEnabled: enabled,
      reminderDuration: durationSeconds,
      ...(color !== undefined ? { reminderColor: color } : {})
    })
    set({ phase })
  },

  applyPreset: (id: string) => {
    const s = get()
    if (s.status !== 'stopped') return
    const cfg = useTimerConfigStore.getState()
    const preset = cfg.presets.find((p) => p.id === id)
    if (preset) {
      get().setDuration(preset.durationSeconds)
    }
  }
}))
