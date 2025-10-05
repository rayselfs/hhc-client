import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { TimerMode } from '@/types/common'
import { useMemoryManager } from '@/utils/memoryManager'

export interface TimerPreset {
  id: string
  duration: number // 秒
}

export interface TimerSettings {
  mode: TimerMode
  timerDuration: number // 秒
  originalDuration: number // 原始設定的時間（秒）
  timezone: string
  isRunning: boolean
  remainingTime: number // 秒
  startTime?: Date
  pausedTime?: number // 暫停時剩餘時間
}

export interface StopwatchSettings {
  isRunning: boolean
  elapsedTime: number // 毫秒
  startTime?: number // 開始時間戳
  displayMode: 'clock' | 'stopwatch'
}

export const useTimerStore = defineStore('timer', () => {
  // 記憶體管理
  const { track, untrack, cleanup } = useMemoryManager('useTimerStore')

  // 載入保存的設定
  const loadSettings = () => {
    const saved = localStorage.getItem('timer-settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return {
          mode: parsed.mode || TimerMode.TIMER,
          timerDuration: parsed.timerDuration || 300, // 5分鐘
          originalDuration: parsed.originalDuration || 300,
          timezone: parsed.timezone || 'Asia/Taipei',
          isRunning: false, // 重啟時總是設為未運行
          remainingTime: parsed.originalDuration || 300,
          pausedTime: 0, // 重啟時清除暫停狀態
        }
      } catch (error) {
        console.error('Failed to load timer settings:', error)
      }
    }
    // 默認設定
    return {
      mode: TimerMode.TIMER,
      timerDuration: 300, // 5分鐘
      originalDuration: 300,
      timezone: 'Asia/Taipei',
      isRunning: false,
      remainingTime: 300,
      pausedTime: 0,
    }
  }

  // 狀態
  const settings = ref<TimerSettings>(loadSettings())
  const presets = ref<TimerPreset[]>([])

  // 碼錶狀態
  const stopwatchSettings = ref<StopwatchSettings>({
    isRunning: false,
    elapsedTime: 0,
    displayMode: 'clock',
  })

  // 碼錶計時器
  let stopwatchInterval: number | undefined

  // 保存設定到 localStorage
  const saveSettings = () => {
    try {
      const settingsToSave = {
        mode: settings.value.mode,
        timerDuration: settings.value.timerDuration,
        originalDuration: settings.value.originalDuration,
        timezone: settings.value.timezone,
      }
      localStorage.setItem('timer-settings', JSON.stringify(settingsToSave))
    } catch (error) {
      console.error('Failed to save timer settings:', error)
    }
  }

  // 計算屬性
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
    return settings.value.remainingTime <= 0 && settings.value.isRunning
  })

  // 方法
  const setMode = (mode: TimerMode) => {
    settings.value.mode = mode
    saveSettings()
  }

  const setTimerDuration = (duration: number) => {
    settings.value.timerDuration = duration
    settings.value.originalDuration = duration // 更新原始時間
    if (!settings.value.isRunning) {
      settings.value.remainingTime = duration
    }
    saveSettings()
  }

  const addTime = (secondsToAdd: number) => {
    const currentTime = settings.value.remainingTime
    const newTime = currentTime + secondsToAdd

    // 如果加的時間沒有超過開始倒數的時間，按比例調整進度
    if (newTime <= settings.value.originalDuration) {
      // 按比例計算新的剩餘時間
      settings.value.remainingTime = newTime
      settings.value.timerDuration = settings.value.originalDuration
    } else {
      // 如果超過原時間，將新時間設為100%並繼續倒數
      settings.value.timerDuration = newTime
      settings.value.remainingTime = newTime
    }
  }

  const setTimezone = (timezone: string) => {
    settings.value.timezone = timezone
    saveSettings()
  }

  const startTimer = () => {
    if (settings.value.mode === 'timer' || settings.value.mode === 'both') {
      // 如果是計時器模式，重置到原始時間並開始倒數
      settings.value.remainingTime = settings.value.originalDuration
      settings.value.timerDuration = settings.value.originalDuration
      settings.value.isRunning = true
      settings.value.pausedTime = 0
    }
    if (settings.value.mode === 'clock' || settings.value.mode === 'both') {
      settings.value.startTime = new Date()
    }
  }

  const pauseTimer = () => {
    if (settings.value.isRunning) {
      settings.value.isRunning = false
      settings.value.pausedTime = settings.value.remainingTime
    }
  }

  const resetTimer = () => {
    settings.value.isRunning = false
    settings.value.remainingTime = settings.value.originalDuration // 重置到原始時間
    settings.value.timerDuration = settings.value.originalDuration // 也重置總時間
    settings.value.pausedTime = 0
    settings.value.startTime = undefined
  }

  const resumeTimer = () => {
    if (settings.value.pausedTime && settings.value.pausedTime > 0) {
      settings.value.isRunning = true
      if (settings.value.remainingTime < settings.value.pausedTime) {
        settings.value.remainingTime = settings.value.pausedTime
      }
      settings.value.pausedTime = 0
    }
  }

  const tick = () => {
    if (settings.value.isRunning && settings.value.remainingTime > 0) {
      settings.value.remainingTime--
      if (settings.value.remainingTime <= 0) {
        settings.value.remainingTime = 0 // 確保顯示為 00:00
        settings.value.isRunning = false
        // 計時結束，可以觸發通知或其他動作
        console.log('Timer finished!')
      }
    } else if (settings.value.isRunning && settings.value.remainingTime <= 0) {
      // 如果已經結束但還在運行狀態，強制停止
      settings.value.isRunning = false
      settings.value.remainingTime = 0
    }
  }

  const addToPresets = (duration: number) => {
    // 檢查是否已經有相同的時間設定
    const existingIndex = presets.value.findIndex((item) => item.duration === duration)

    if (existingIndex !== -1) {
      // 如果已存在相同時間，移除舊的記錄
      presets.value.splice(existingIndex, 1)
    }

    const newPreset: TimerPreset = {
      id: Date.now().toString(),
      duration,
    }

    presets.value.unshift(newPreset)

    // 只保留最近5個預設
    if (presets.value.length > 5) {
      presets.value = presets.value.slice(0, 5)
    }

    // 保存到 localStorage
    localStorage.setItem('timer-presets', JSON.stringify(presets.value))
  }

  const applyPreset = (presetItem: TimerPreset) => {
    settings.value.timerDuration = presetItem.duration
    settings.value.originalDuration = presetItem.duration
    settings.value.remainingTime = presetItem.duration
    saveSettings()
    resetTimer()
  }

  const loadPresets = () => {
    const saved = localStorage.getItem('timer-presets')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        presets.value = parsed
      } catch (error) {
        console.error('Failed to load timer presets:', error)
      }
    }
  }

  const deletePreset = (id: string) => {
    presets.value = presets.value.filter((item) => item.id !== id)
    localStorage.setItem('timer-presets', JSON.stringify(presets.value))
  }

  // 碼錶方法
  const startStopwatch = () => {
    stopwatchSettings.value.isRunning = true
    stopwatchSettings.value.startTime = Date.now() - stopwatchSettings.value.elapsedTime

    stopwatchInterval = window.setInterval(() => {
      if (stopwatchSettings.value.startTime) {
        stopwatchSettings.value.elapsedTime = Date.now() - stopwatchSettings.value.startTime
      }
    }, 100)

    // 追蹤計時器
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

  const toggleStopwatchMode = () => {
    if (stopwatchSettings.value.displayMode === 'clock') {
      stopwatchSettings.value.displayMode = 'stopwatch'
      resetStopwatch()
    } else {
      stopwatchSettings.value.displayMode = 'clock'
      pauseStopwatch()
    }
  }

  const getStopwatchTime = () => {
    const totalSeconds = Math.floor(stopwatchSettings.value.elapsedTime / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  // 初始化
  loadPresets()

  return {
    // 狀態
    settings,
    presets,
    stopwatchSettings,

    // 計算屬性
    formattedTime,
    progress,
    isFinished,

    // 方法
    setMode,
    setTimerDuration,
    addTime,
    setTimezone,
    startTimer,
    pauseTimer,
    resetTimer,
    resumeTimer,
    tick,
    addToPresets,
    applyPreset,
    deletePreset,

    // 碼錶方法
    startStopwatch,
    pauseStopwatch,
    resetStopwatch,
    toggleStopwatchMode,
    getStopwatchTime,

    // 記憶體管理
    cleanup,
  }
})
