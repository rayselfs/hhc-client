import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { TimerMode } from '@/types/common'
import { useMemoryManager } from '@/utils/memoryManager'
import { TIMER_CONFIG, getTimerDefaultSettings } from '@/config/app'
import { useSentry } from '@/composables/useSentry'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useLocalStorage } from '@/composables/useLocalStorage'
import { StorageKey, StorageCategory, getStorageKey } from '@/types/common'

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
  const state = ref<TimerState>('stopped') // State machine

  // Save persistent settings to localStorage
  const saveSettings = () => {
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
    // 模式改變時立即更新投影
    sendTimerUpdate()
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
    // 時區改變時立即更新投影
    sendTimerUpdate()
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
    // 用戶操作時立即更新投影
    sendTimerUpdate()
  }

  const pauseTimer = () => {
    if (state.value === 'running') state.value = 'paused'
    // 用戶操作時立即更新投影
    sendTimerUpdate()
  }

  const resetTimer = () => {
    state.value = 'stopped'
    settings.value.remainingTime = settings.value.originalDuration
    settings.value.timerDuration = settings.value.originalDuration
    settings.value.startTime = undefined
    // 用戶操作時立即更新投影
    sendTimerUpdate()
  }

  const resumeTimer = () => {
    if (state.value === 'paused') state.value = 'running'
    // 用戶操作時立即更新投影
    sendTimerUpdate()
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

  // 全局計時器循環
  let timerInterval: number | undefined

  /**
   * 啟動全局計時器循環
   * 每秒執行一次 tick，並智能判斷是否需要發送投影更新
   */
  const startTimerLoop = () => {
    // 防止重複啟動
    if (timerInterval) {
      return
    }

    timerInterval = window.setInterval(() => {
      const wasRunning = state.value === 'running'
      const wasRemainingTime = settings.value.remainingTime

      // 執行 tick 更新計時器狀態
      tick()

      // 智能判斷是否需要發送投影更新：
      // 1. 計時器正在運行且時間有變化
      // 2. 計時器剛結束（從運行變為停止）
      // 3. 剩餘時間為 0（確保結束狀態被發送）
      const shouldUpdate =
        (wasRunning && settings.value.remainingTime !== wasRemainingTime) ||
        (wasRunning && state.value !== 'running') ||
        (settings.value.remainingTime === 0 && wasRemainingTime > 0)

      if (shouldUpdate) {
        sendTimerUpdate() // 使用智能更新，不強制
      }
    }, 1000)
  }

  /**
   * 停止全局計時器循環
   */
  const stopTimerLoop = () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = undefined
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

  // 包裝 cleanup 函數，確保清理計時器循環
  const cleanupTimerStore = () => {
    // 停止計時器循環
    stopTimerLoop()
    // 調用原有的 cleanup 清理其他資源
    cleanup()
  }

  // 監聽頁面卸載事件，確保計時器被清理
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      stopTimerLoop()
    })
  }

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

    // Timer Loop Management
    startTimerLoop,
    stopTimerLoop,

    // Memory Management
    cleanup: cleanupTimerStore,
  }
})
