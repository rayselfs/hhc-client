import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { TimerMode } from '@/types/common'
import { useMemoryManager } from '@/utils/memoryManager'
import { TIMER_CONFIG, getTimerDefaultSettings } from '@/config/app'
import { useSentry } from '@/composables/useSentry'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'
import type { TimerState as ElectronTimerState } from '@/types/electron'

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
  currentTime: Date // Current server time
}

// State machine for timer status
type TimerStatus = 'stopped' | 'running' | 'paused'

export const useTimerStore = defineStore('timer', () => {
  const { reportError } = useSentry()
  const { cleanup } = useMemoryManager('useTimerStore')
  const { getLocalItem, setLocalItem } = useLocalStorage()
  const loadSettings = () => {
    const defaultSettings = getTimerDefaultSettings()
    const parsed = getLocalItem<TimerSettings>(
      getStorageKey(StorageCategory.TIMER, StorageKey.TIMER_SETTINGS),
      'object',
    )
    if (parsed) {
      try {
        return {
          ...defaultSettings,
          ...parsed,
          remainingTime: parsed.originalDuration || defaultSettings.remainingTime,
          timerDuration: parsed.originalDuration || defaultSettings.timerDuration,
          currentTime: new Date(),
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
  const settings = ref<TimerSettings>(loadSettings() as TimerSettings)
  const presets = ref<TimerPreset[]>([])
  const state = ref<TimerStatus>('stopped') // State machine

  // Save persistent settings to localStorage
  // Debounced to prevent frequent writes during typing or rapid button clicks
  const saveSettings = useDebounceFn(() => {
    try {
      const settingsToSave = {
        mode: settings.value.mode,
        originalDuration: settings.value.originalDuration,
        timezone: settings.value.timezone,
      }
      setLocalItem(
        getStorageKey(StorageCategory.TIMER, StorageKey.TIMER_SETTINGS),
        settingsToSave,
        'object',
      )
    } catch (error) {
      reportError(error, {
        operation: 'save-timer-settings',
        component: 'TimerStore',
        extra: { settings: JSON.stringify(settings) },
      })
    }
  }, 1000)

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
    sendTimerCommand({ action: 'setMode', mode })
    saveSettings()
  }

  const setTimerDuration = (duration: number) => {
    // Optimistically update local state so saveSettings captures the new value
    settings.value.originalDuration = duration
    settings.value.timerDuration = duration
    settings.value.remainingTime = duration

    sendTimerCommand({ action: 'setDuration', duration })
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
      sendTimerCommand({ action: 'addTime', seconds: secondsToAdd })
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
      sendTimerCommand({ action: 'removeTime', seconds: secondsToRemove })
    }
  }

  const setTimezone = (timezone: string) => {
    sendTimerCommand({ action: 'setTimezone', timezone })
    saveSettings()
  }

  // Helper function to check if Electron is available
  const isElectron = () => {
    return typeof window !== 'undefined' && !!window.electronAPI
  }

  // Helper function to send timer command to main process
  const sendTimerCommand = (command: Parameters<typeof window.electronAPI.timerCommand>[0]) => {
    if (isElectron()) {
      try {
        window.electronAPI.timerCommand(command)
      } catch (error) {
        reportError(error, {
          operation: 'timer-command',
          component: 'TimerStore',
        })
      }
    }
  }

  // Update local state from timer state received from main process
  const updateFromTimerState = (timerState: Partial<ElectronTimerState>) => {
    if (timerState.mode !== undefined) settings.value.mode = timerState.mode
    if (timerState.state !== undefined) state.value = timerState.state
    if (timerState.remainingTime !== undefined)
      settings.value.remainingTime = timerState.remainingTime
    if (timerState.timerDuration !== undefined)
      settings.value.timerDuration = timerState.timerDuration
    if (timerState.originalDuration !== undefined)
      settings.value.originalDuration = timerState.originalDuration
    if (timerState.timezone !== undefined) settings.value.timezone = timerState.timezone

    if (timerState.startTime !== undefined) {
      if (timerState.startTime) {
        settings.value.startTime = new Date(timerState.startTime)
      } else {
        settings.value.startTime = undefined
      }
    }

    // Temporary interface to handle type definition sync issues
    interface ExtendedTimerState extends Partial<ElectronTimerState> {
      currentTime?: string
    }
    const extendedState = timerState as ExtendedTimerState

    if (extendedState.currentTime) {
      settings.value.currentTime = new Date(extendedState.currentTime)
    }
  }

  // State machine methods - now send commands to main process
  const startTimer = () => {
    sendTimerCommand({ action: 'start' })
  }

  const pauseTimer = () => {
    sendTimerCommand({ action: 'pause' })
  }

  const resetTimer = () => {
    sendTimerCommand({ action: 'reset' })
  }

  const resumeTimer = () => {
    sendTimerCommand({ action: 'resume' })
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
    setLocalItem(
      getStorageKey(StorageCategory.TIMER, StorageKey.TIMER_PRESETS),
      presets.value,
      'array',
    )
  }

  const applyPreset = (presetItem: TimerPreset) => {
    setTimerDuration(presetItem.duration)
    resetTimer()
  }

  const loadPresets = () => {
    const saved = getLocalItem<TimerPreset[]>(
      getStorageKey(StorageCategory.TIMER, StorageKey.TIMER_PRESETS),
      'array',
    )
    presets.value = saved ? saved : []
  }

  const deletePreset = (id: string) => {
    presets.value = presets.value.filter((item) => item.id !== id)
    setLocalItem(
      getStorageKey(StorageCategory.TIMER, StorageKey.TIMER_PRESETS),
      presets.value,
      'array',
    )
  }

  // 包裝 cleanup 函數
  const cleanupTimerStore = () => {
    // 移除 IPC 監聽器
    if (isElectron() && typeof window !== 'undefined') {
      try {
        window.electronAPI.removeAllListeners('timer-tick')
      } catch (error) {
        reportError(error, {
          operation: 'cleanup-timer-store',
          component: 'TimerStore',
        })
      }
    }
    // 調用原有的 cleanup 清理其他資源
    cleanup()
  }

  // Initialize timer IPC listener
  const initializeTimerIPC = async () => {
    if (!isElectron()) {
      return
    }

    try {
      // Set up listener for timer updates from main process
      window.electronAPI.onTimerTick((timerState: Partial<ElectronTimerState>) => {
        updateFromTimerState(timerState)
      })

      // Initialize main process timer with saved settings
      // Only initialize if NOT in projection window to avoid resetting state
      const isProjection = window.location.hash.includes('projection')
      if (!isProjection) {
        const savedSettings = loadSettings()
        await window.electronAPI.timerInitialize({
          mode: savedSettings.mode as TimerMode,
          originalDuration: savedSettings.originalDuration,
          timezone: savedSettings.timezone,
        })
      }

      // Get initial state from main process
      const initialState = await window.electronAPI.timerGetState()
      if (initialState) {
        updateFromTimerState(initialState)
      }
    } catch (error) {
      reportError(error, {
        operation: 'initialize-timer-ipc',
        component: 'TimerStore',
      })
    }
  }

  // Initialization
  loadPresets()

  // Initialize IPC communication in Electron environment
  if (typeof window !== 'undefined') {
    initializeTimerIPC()
  }

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
    addToPresets,
    applyPreset,
    deletePreset,

    // Memory Management
    cleanup: cleanupTimerStore,
  }
})
