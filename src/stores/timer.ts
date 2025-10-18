import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { TimerMode } from '@/types/common'
import { useMemoryManager } from '@/utils/memoryManager'
import { getTimerLocalKey, STORAGE_KEYS, getTimerDefaultSettings, TIMER_CONFIG } from '@/config/app'
import { useSentry } from '@/composables/useSentry'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'

export interface TimerPreset {
  id: string
  duration: number // seconds
}

// Simplified settings interface, runtime state is managed separately
export interface TimerSettings {
  mode: TimerMode
  timerDuration: number // seconds (dynamic total time, for progress bar)
  originalDuration: number // seconds (the user's set time)
  remainingTime: number // seconds
  timezone: string // Timezone
  startTime?: Date // Start time for 'clock' mode
}

// State machine for timer status
type TimerState = 'stopped' | 'running' | 'paused'

export const useTimerStore = defineStore('timer', () => {
  const { reportError } = useSentry()
  const { cleanup } = useMemoryManager('useTimerStore')
  const { sendTimerUpdate } = useProjectionMessaging()

  const loadSettings = () => {
    const defaultSettings = getTimerDefaultSettings()
    const saved = localStorage.getItem(getTimerLocalKey(STORAGE_KEYS.TIMER_LOCAL.SETTINGS))
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Only load persistent settings, reset runtime state
        return {
          ...defaultSettings,
          ...parsed,
          remainingTime: parsed.originalDuration || defaultSettings.remainingTime,
          timerDuration: parsed.originalDuration || defaultSettings.timerDuration,
        }
      } catch (error) {
        reportError(error, {
          operation: 'load-timer-settings',
          component: 'TimerStore',
        })
        return defaultSettings
      }
    }
    return defaultSettings
  }

  // State
  const settings = ref<TimerSettings>(loadSettings())
  const presets = ref<TimerPreset[]>([])
  const state = ref<TimerState>('stopped') // State machine

  // Save persistent settings to localStorage
  const saveSettings = () => {
    try {
      const settingsToSave = {
        mode: settings.value.mode,
        originalDuration: settings.value.originalDuration,
        timezone: settings.value.timezone,
      }
      localStorage.setItem(
        getTimerLocalKey(STORAGE_KEYS.TIMER_LOCAL.SETTINGS),
        JSON.stringify(settingsToSave),
      )
    } catch (error) {
      reportError(error, {
        operation: 'save-timer-settings',
        component: 'TimerStore',
        extra: { settings: JSON.stringify(settings) },
      })
    }
  }

  // Computed Properties
  const isRunning = computed(() => state.value === 'running')

  const formattedTime = computed(() => {
    const hours = Math.floor(settings.value.remainingTime / 3600)
    const minutes = Math.floor((settings.value.remainingTime % 3600) / 60)
    const seconds = settings.value.remainingTime % 60

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const progress = computed(() => {
    if (settings.value.timerDuration === 0) return 0
    return (
      ((settings.value.timerDuration - settings.value.remainingTime) /
        settings.value.timerDuration) *
      100
    )
  })

  const isFinished = computed(() => {
    return settings.value.remainingTime <= 0 && state.value === 'stopped'
  })

  // Internal validation logic moved from component
  const validateAndNormalize = (
    minutesNum: number,
    secondsNum: number,
  ): { m: number; s: number } => {
    let m = minutesNum || 0
    let s = secondsNum || 0
    if (s >= 60) {
      m += Math.floor(s / 60)
      s = s % 60
    }
    m = Math.min(m, 59) // Assuming 59:59 max for this UI
    s = Math.min(s, 59)
    if (m === 0 && s === 0) {
      s = 30 // Default to 30s if 00:00
    }
    return { m, s }
  }

  // Computed setters for v-model binding on time inputs
  const inputMinutes = computed({
    get: () => {
      const m = Math.floor(settings.value.originalDuration / 60)
      return m.toString().padStart(2, '0')
    },
    set: (value: string) => {
      if (!/^\d*$/.test(value) || value === '') value = '0'
      const sNum = settings.value.originalDuration % 60
      const { m, s } = validateAndNormalize(parseInt(value), sNum)
      setTimerDuration(m * 60 + s)
    },
  })

  const inputSeconds = computed({
    get: () => {
      const s = settings.value.originalDuration % 60
      return s.toString().padStart(2, '0')
    },
    set: (value: string) => {
      if (!/^\d*$/.test(value) || value === '') value = '0'
      const mNum = Math.floor(settings.value.originalDuration / 60)
      const { m, s } = validateAndNormalize(mNum, parseInt(value))
      setTimerDuration(m * 60 + s)
    },
  })

  // Methods
  const setMode = (mode: TimerMode) => {
    settings.value.mode = mode
    saveSettings()
  }

  const setTimerDuration = (duration: number) => {
    settings.value.originalDuration = duration
    if (state.value === 'stopped') {
      settings.value.timerDuration = duration
      settings.value.remainingTime = duration
    }
    saveSettings()
  }

  // Refactored addTime logic
  const addTime = (secondsToAdd: number) => {
    if (state.value === 'stopped') {
      // If stopped, add to the base duration
      const newDuration = settings.value.originalDuration + secondsToAdd
      const { m, s } = validateAndNormalize(0, newDuration) // Pass total seconds
      setTimerDuration(m * 60 + s)
    } else {
      // If running or paused, add to the remaining time
      const newTime = settings.value.remainingTime + secondsToAdd
      settings.value.remainingTime = newTime
      settings.value.timerDuration = Math.max(settings.value.timerDuration, newTime)
    }
  }

  // Remove time logic
  const removeTime = (secondsToRemove: number) => {
    if (state.value === 'stopped') {
      // If stopped, remove from the base duration
      const newDuration = Math.max(0, settings.value.originalDuration - secondsToRemove)
      const { m, s } = validateAndNormalize(0, newDuration) // Pass total seconds
      setTimerDuration(m * 60 + s)
    } else {
      // If running or paused, remove from the remaining time
      const newTime = Math.max(0, settings.value.remainingTime - secondsToRemove)
      settings.value.remainingTime = newTime
      // Update timerDuration to match the new remaining time
      settings.value.timerDuration = Math.max(settings.value.timerDuration, newTime)
    }
  }

  const setTimezone = (timezone: string) => {
    settings.value.timezone = timezone
    saveSettings()
  }

  // State machine methods
  const startTimer = () => {
    if (settings.value.mode === 'timer' || settings.value.mode === 'both') {
      settings.value.remainingTime = settings.value.originalDuration
      settings.value.timerDuration = settings.value.originalDuration
      state.value = 'running'
    }
    if (settings.value.mode === 'clock' || settings.value.mode === 'both') {
      settings.value.startTime = new Date()
    }
  }

  const pauseTimer = () => {
    if (state.value === 'running') state.value = 'paused'
  }

  const resetTimer = () => {
    state.value = 'stopped'
    settings.value.remainingTime = settings.value.originalDuration
    settings.value.timerDuration = settings.value.originalDuration
    settings.value.startTime = undefined
  }

  const resumeTimer = () => {
    if (state.value === 'paused') state.value = 'running'
  }

  const tick = () => {
    if (state.value === 'running' && settings.value.remainingTime > 0) {
      settings.value.remainingTime--
      if (settings.value.remainingTime <= 0) {
        settings.value.remainingTime = 0
        state.value = 'stopped'
      }
    }
  }

  // Preset Methods (logic mostly unchanged)
  const addToPresets = (duration: number) => {
    const existingIndex = presets.value.findIndex((item) => item.duration === duration)
    if (existingIndex !== -1) {
      presets.value.splice(existingIndex, 1)
    }
    const newPreset: TimerPreset = { id: Date.now().toString(), duration }
    presets.value.unshift(newPreset)
    if (presets.value.length > TIMER_CONFIG.PRESETS.MAX_COUNT) {
      presets.value = presets.value.slice(0, TIMER_CONFIG.PRESETS.MAX_COUNT)
    }
    localStorage.setItem(
      getTimerLocalKey(STORAGE_KEYS.TIMER_LOCAL.PRESETS),
      JSON.stringify(presets.value),
    )
  }

  const applyPreset = (presetItem: TimerPreset) => {
    setTimerDuration(presetItem.duration)
    resetTimer()
  }

  const loadPresets = () => {
    const saved = localStorage.getItem(getTimerLocalKey(STORAGE_KEYS.TIMER_LOCAL.PRESETS))
    if (saved) {
      try {
        presets.value = JSON.parse(saved)
      } catch (error) {
        reportError(error, {
          operation: 'load-timer-presets',
          component: 'TimerStore',
        })
      }
    }
  }

  const deletePreset = (id: string) => {
    presets.value = presets.value.filter((item) => item.id !== id)
    localStorage.setItem(
      getTimerLocalKey(STORAGE_KEYS.TIMER_LOCAL.PRESETS),
      JSON.stringify(presets.value),
    )
  }

  // Side Effect: Automatically update projection when state changes
  watch(
    [settings, state],
    () => {
      sendTimerUpdate(true)
    },
    { deep: true },
  )

  // Initialization
  loadPresets()

  return {
    // State
    settings,
    presets,
    state, // Export state

    // Computed
    isRunning, // Export computed boolean
    formattedTime,
    progress,
    isFinished,
    inputMinutes, // Export computed for v-model
    inputSeconds, // Export computed for v-model

    // Methods
    setMode,
    setTimerDuration,
    addTime,
    removeTime,
    setTimezone,
    startTimer,
    pauseTimer,
    resetTimer,
    resumeTimer,
    tick,
    addToPresets,
    applyPreset,
    deletePreset,

    // Memory Management
    cleanup,
  }
})
