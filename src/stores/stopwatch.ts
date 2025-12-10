import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useMemoryManager } from '@/utils/memoryManager'

export interface StopwatchSettings {
  isRunning: boolean
  elapsedTime: number // milliseconds
  startTime?: number // timestamp
}

export const useStopwatchStore = defineStore('stopwatch', () => {
  const { track, untrack, cleanup } = useMemoryManager('useStopwatchStore')

  const stopwatchSettings = ref<StopwatchSettings>({
    isRunning: false,
    elapsedTime: 0,
  })

  let stopwatchInterval: number | undefined

  // Converted from getStopwatchTime() to a computed property
  const formattedTime = computed(() => {
    const totalSeconds = Math.floor(stopwatchSettings.value.elapsedTime / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const startStopwatch = () => {
    stopwatchSettings.value.isRunning = true
    stopwatchSettings.value.startTime = Date.now() - stopwatchSettings.value.elapsedTime

    stopwatchInterval = window.setInterval(() => {
      if (stopwatchSettings.value.startTime) {
        stopwatchSettings.value.elapsedTime = Date.now() - stopwatchSettings.value.startTime
      }
    }, 100)

    track('stopwatch-interval', 'interval', stopwatchInterval)
  }

  const pauseStopwatch = () => {
    stopwatchSettings.value.isRunning = false
    if (stopwatchInterval) {
      untrack('stopwatch-interval')
      clearInterval(stopwatchInterval)
      stopwatchInterval = undefined
    }
  }

  const resetStopwatch = () => {
    stopwatchSettings.value.isRunning = false
    stopwatchSettings.value.elapsedTime = 0
    if (stopwatchInterval) {
      untrack('stopwatch-interval')
      clearInterval(stopwatchInterval)
      stopwatchInterval = undefined
    }
  }

  return {
    // State
    stopwatchSettings,

    // Computed
    formattedTime,

    // Methods
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,

    // Memory Management
    cleanup,
  }
})
