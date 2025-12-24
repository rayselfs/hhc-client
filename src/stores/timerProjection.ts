import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { MessageType, type AppMessage, type TimerMode } from '@/types/common'
import { useElectron } from '@/composables/useElectron'
import type { TimerState as ElectronTimerState } from '@/types/electron'

export interface TimerProjectionSettings {
  mode: TimerMode
  timerDuration: number
  remainingTime: number
  timezone: string
  overtimeMessageEnabled: boolean
  overtimeMessage: string
  reminderEnabled: boolean
  reminderTime: number
}

export const useTimerProjectionStore = defineStore('timerProjection', () => {
  // State
  const state = ref<'stopped' | 'running' | 'paused'>('stopped')
  const settings = ref<TimerProjectionSettings>({
    mode: 'timer' as TimerMode,
    timerDuration: 300,
    remainingTime: 300,
    timezone: 'Asia/Taipei',
    overtimeMessageEnabled: false,
    overtimeMessage: '',
    reminderEnabled: false,
    reminderTime: 0,
  })

  // Computed
  const isRunning = computed(() => state.value === 'running')

  const isFinished = computed(() => {
    return settings.value.remainingTime <= 0 && state.value === 'stopped'
  })

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

  const isWarning = computed(() => {
    return (
      settings.value.reminderEnabled &&
      state.value !== 'stopped' &&
      !isFinished.value &&
      settings.value.remainingTime <= settings.value.reminderTime &&
      settings.value.remainingTime > 0
    )
  })

  // Electron IPC Integration
  const { isElectron, onTimerTick, timerGetState } = useElectron()

  const updateFromTimerState = (timerState: Partial<ElectronTimerState>) => {
    if (timerState.mode !== undefined) settings.value.mode = timerState.mode
    if (timerState.state !== undefined) state.value = timerState.state
    if (timerState.remainingTime !== undefined)
      settings.value.remainingTime = timerState.remainingTime
    if (timerState.timerDuration !== undefined)
      settings.value.timerDuration = timerState.timerDuration
    if (timerState.timezone !== undefined) settings.value.timezone = timerState.timezone
    if (timerState.reminderEnabled !== undefined)
      settings.value.reminderEnabled = timerState.reminderEnabled
    if (timerState.reminderTime !== undefined) settings.value.reminderTime = timerState.reminderTime
    if (timerState.overtimeMessageEnabled !== undefined)
      settings.value.overtimeMessageEnabled = timerState.overtimeMessageEnabled
    if (timerState.overtimeMessage !== undefined)
      settings.value.overtimeMessage = timerState.overtimeMessage

    // Logic to auto-stop if finished (mirrors control logic)
    if (
      settings.value.remainingTime <= 0 &&
      state.value === 'running' &&
      settings.value.mode !== 'clock'
    ) {
      state.value = 'stopped'
    }
  }

  const initialize = async () => {
    if (isElectron()) {
      // 1. Get initial state
      const initialState = await timerGetState()
      if (initialState) {
        updateFromTimerState(initialState)
      }

      // 2. Listen for ticks
      onTimerTick((timerState) => {
        updateFromTimerState(timerState)
      })
    }
  }

  /**
   * 處理投影消息 (作為 IPC 的補充或非 Electron 環境的備案)
   */
  const handleMessage = (message: AppMessage): boolean => {
    switch (message.type) {
      case MessageType.TIMER_SYNC_SETTINGS:
        if ('timerDuration' in message.data) {
          const data = message.data as unknown as {
            mode: TimerMode
            timerDuration: number
            timezone: string
            isRunning: boolean
            remainingTime: number
            overtimeMessageEnabled?: boolean
            overtimeMessage?: string
            reminderEnabled?: boolean
            reminderTime?: number
          }

          settings.value.mode = data.mode
          settings.value.timerDuration = data.timerDuration
          settings.value.timezone = data.timezone
          settings.value.remainingTime = data.remainingTime

          if (data.overtimeMessageEnabled !== undefined)
            settings.value.overtimeMessageEnabled = data.overtimeMessageEnabled
          if (data.overtimeMessage !== undefined)
            settings.value.overtimeMessage = data.overtimeMessage
          if (data.reminderEnabled !== undefined)
            settings.value.reminderEnabled = data.reminderEnabled
          if (data.reminderTime !== undefined) settings.value.reminderTime = data.reminderTime

          state.value = data.isRunning ? 'running' : 'stopped'
          return true
        }
        break
    }
    return false
  }

  return {
    state,
    settings,
    isRunning,
    isFinished,
    formattedTime,
    progress,
    isWarning,
    initialize,
    handleMessage,
  }
})
