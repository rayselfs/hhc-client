import { create } from 'zustand'
import type { StopwatchStatus } from '@shared/types/timer'

export interface StopwatchStore {
  status: StopwatchStatus
  elapsedMs: number
  startTimestamp: number | null
  accumulatedMs: number

  showOnProjection: boolean

  isRunning: () => boolean
  isPaused: () => boolean
  isStopped: () => boolean

  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  tick: (currentMs: number) => void
  setShowOnProjection: (show: boolean) => void
}

export const useStopwatchStore = create<StopwatchStore>()((set, get) => ({
  status: 'stopped',
  elapsedMs: 0,
  startTimestamp: null,
  accumulatedMs: 0,

  showOnProjection: false,

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
      elapsedMs: 0
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
      accumulatedMs: 0
    })
  },

  tick: (currentMs: number) => {
    const s = get()
    if (s.status !== 'running') return
    if (s.startTimestamp === null) return
    const elapsed = s.accumulatedMs + (currentMs - s.startTimestamp)
    set({ elapsedMs: elapsed })
  },

  setShowOnProjection: (show: boolean) => {
    set({ showOnProjection: show })
  }
}))
