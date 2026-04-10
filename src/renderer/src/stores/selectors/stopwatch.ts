import type { StopwatchStore } from '@renderer/stores/stopwatch'

function formatStopwatchTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export const selectFormattedTime = (s: StopwatchStore): string => formatStopwatchTime(s.elapsedMs)

export const selectElapsedSeconds = (s: StopwatchStore): number => Math.floor(s.elapsedMs / 1000)
