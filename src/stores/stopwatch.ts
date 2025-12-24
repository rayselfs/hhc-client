import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMemoryManager } from '@/utils/memoryManager'
import { useElectron } from '@/composables/useElectron'
import type { TimerState } from '@/types/electron'

export interface SingleStopwatchState {
  isRunning: boolean
  elapsedTime: number // milliseconds
  startTime?: number | null // timestamp
}

export interface GlobalStopwatchState extends SingleStopwatchState {
  isStopwatchMode: boolean
}

export const useStopwatchStore = defineStore('stopwatch', () => {
  const { cleanup } = useMemoryManager('useStopwatchStore')
  const { isElectron, timerCommand, onTimerTick, timerGetState } = useElectron()

  // 1. Global Stopwatch (Synced with Electron)
  // This state mirrors what is happening in the backend
  const global = ref<GlobalStopwatchState>({
    isRunning: false,
    elapsedTime: 0,
    startTime: null,
    isStopwatchMode: false,
  })

  // 2. Local Stopwatch (Frontend Only - for Media Presenter)
  // This state is managed purely in the frontend
  const local = ref<SingleStopwatchState>({
    isRunning: false,
    elapsedTime: 0,
    startTime: null,
  })

  // --- Global Actions (IPC) ---
  const startGlobal = () => {
    if (isElectron()) timerCommand({ action: 'startStopwatch' })
  }

  const pauseGlobal = () => {
    if (isElectron()) timerCommand({ action: 'pauseStopwatch' })
  }

  const resetGlobal = () => {
    if (isElectron()) timerCommand({ action: 'resetStopwatch' })
  }

  // --- Local Actions (Frontend Logic) ---
  let localRafId: number | null = null

  const updateLocal = () => {
    if (local.value.isRunning && local.value.startTime) {
      local.value.elapsedTime = Date.now() - local.value.startTime
      localRafId = requestAnimationFrame(updateLocal)
    }
  }

  const startLocal = () => {
    if (!local.value.isRunning) {
      local.value.isRunning = true
      // Adjust start time to account for previously elapsed time
      local.value.startTime = Date.now() - local.value.elapsedTime
      updateLocal()
    }
  }

  const pauseLocal = () => {
    if (local.value.isRunning) {
      local.value.isRunning = false
      if (localRafId !== null) {
        cancelAnimationFrame(localRafId)
        localRafId = null
      }
    }
  }

  const resetLocal = () => {
    pauseLocal()
    local.value.elapsedTime = 0
    local.value.startTime = null
  }

  // --- Formatters ---
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const formattedGlobalTime = computed(() => formatTime(global.value.elapsedTime))
  const formattedLocalTime = computed(() => formatTime(local.value.elapsedTime))

  // --- Sync Logic for Global ---
  const updateFromTimerState = (timerState: Partial<TimerState>) => {
    if (timerState.stopwatchState !== undefined) {
      global.value.isRunning = timerState.stopwatchState === 'running'
    }
    if (timerState.stopwatchElapsedTime !== undefined) {
      global.value.elapsedTime = timerState.stopwatchElapsedTime
    }
  }

  // Initialize IPC for Global
  if (isElectron()) {
    onTimerTick((state: Partial<TimerState>) => {
      updateFromTimerState(state)
    })

    // Initial fetch
    timerGetState().then((state: TimerState | null) => {
      if (state) updateFromTimerState(state)
    })
  }

  return {
    // States
    global,
    local,
    // Global Actions
    startGlobal,
    pauseGlobal,
    resetGlobal,
    formattedGlobalTime,
    // Local Actions (Exported for MediaPresenter)
    startLocal,
    pauseLocal,
    resetLocal,
    formattedLocalTime,
    // Legacy support (optional, but better to update consumers)
    // stopwatchSettings: global,
    // formattedTime: formattedGlobalTime,
    cleanup,
  }
})
