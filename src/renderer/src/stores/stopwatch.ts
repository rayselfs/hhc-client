import { create } from 'zustand'
import type { StopwatchStatus } from '@shared/types/timer'

export interface StopwatchStore {
  status: StopwatchStatus
  elapsedMs: number
  startTimestamp: number | null
  accumulatedMs: number

  formattedTime: string
  elapsedSeconds: number

  isRunning: () => boolean
  isPaused: () => boolean
  isStopped: () => boolean

  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  tick: (currentMs: number) => void
}

function formatStopwatchTime(ms: number): string {
  const totalCentiseconds = Math.floor(ms / 10)
  const centiseconds = totalCentiseconds % 100
  const totalSeconds = Math.floor(totalCentiseconds / 100)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

export const useStopwatchStore = create<StopwatchStore>()((set, get) => ({
  status: 'stopped',
  elapsedMs: 0,
  startTimestamp: null,
  accumulatedMs: 0,

  formattedTime: '00:00.00',
  elapsedSeconds: 0,

  isRunning: () => get().status === 'running',
  isPaused: () => get().status === 'paused',
  isStopped: () => get().status === 'stopped',

  start: () => {
    const s = get()
    if (s.status === 'running') return
    const now = Date.now()
    set({
      status: 'running',
      startTimestamp: now,
      accumulatedMs: 0,
      elapsedMs: 0,
      formattedTime: '00:00.00',
      elapsedSeconds: 0
    })
  },

  pause: () => {
    const s = get()
    if (s.status !== 'running') return
    set({
      status: 'paused',
      accumulatedMs: s.elapsedMs,
      startTimestamp: null
    })
  },

  resume: () => {
    const s = get()
    if (s.status !== 'paused') return
    const now = Date.now()
    set({
      status: 'running',
      startTimestamp: now
    })
  },

  reset: () => {
    set({
      status: 'stopped',
      elapsedMs: 0,
      startTimestamp: null,
      accumulatedMs: 0,
      formattedTime: '00:00.00',
      elapsedSeconds: 0
    })
  },

  tick: (currentMs: number) => {
    const s = get()
    if (s.status !== 'running') return
    if (s.startTimestamp === null) return
    const elapsed = s.accumulatedMs + (currentMs - s.startTimestamp)
    set({
      elapsedMs: elapsed,
      formattedTime: formatStopwatchTime(elapsed),
      elapsedSeconds: Math.floor(elapsed / 1000)
    })
  }
}))
