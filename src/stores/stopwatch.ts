import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMemoryManager } from '@/utils/memoryManager'
import type { TimerState } from '@/types/electron'

export interface StopwatchSettings {
  isRunning: boolean
  elapsedTime: number // milliseconds
  startTime?: number // timestamp
  isStopwatchMode: boolean
}

export const useStopwatchStore = defineStore('stopwatch', () => {
  const { cleanup } = useMemoryManager('useStopwatchStore')

  const stopwatchSettings = ref<StopwatchSettings>({
    isRunning: false,
    elapsedTime: 0,
    isStopwatchMode: false,
  })

  // Actions calling Electron backend
  const startStopwatch = () => {
    window.electronAPI.timerCommand({ action: 'startStopwatch' })
  }

  const pauseStopwatch = () => {
    window.electronAPI.timerCommand({ action: 'pauseStopwatch' })
  }

  const resetStopwatch = () => {
    window.electronAPI.timerCommand({ action: 'resetStopwatch' })
  }

  // Formatting helper
  const formattedTime = computed(() => {
    const totalSeconds = Math.floor(stopwatchSettings.value.elapsedTime / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  // Sync with Electron state
  const updateFromTimerState = (timerState: Partial<TimerState>) => {
    if (timerState.stopwatchState !== undefined) {
      stopwatchSettings.value.isRunning = timerState.stopwatchState === 'running'
    }
    if (timerState.stopwatchElapsedTime !== undefined) {
      stopwatchSettings.value.elapsedTime = timerState.stopwatchElapsedTime
    }
  }

  // Initialize IPC
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.onTimerTick((state: Partial<TimerState>) => {
      updateFromTimerState(state)
    })

    // Initial fetch
    window.electronAPI.timerGetState().then((state: TimerState | null) => {
      if (state) updateFromTimerState(state)
    })
  }

  return {
    stopwatchSettings,
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,
    formattedTime,
    cleanup,
  }
})
