import { ref, computed, onBeforeUnmount } from 'vue'
import { useElectron } from './useElectron'
import { useTimerStore } from '@/stores/timer'
import { useProjectionStore } from '@/stores/projection'
import { useDarkMode } from './useDarkMode'
import { MessageType, ViewType } from '@/types/common'
import type { AppMessage } from '@/types/common'
import { useMemoryManager } from '@/utils/memoryManager'

/**
 * 投影消息管理 composable
 * 提供防抖動和消息隊列功能，減少重複的投影消息發送
 */
export const useProjectionMessaging = () => {
  const { sendToProjection: originalSendToProjection, isElectron } = useElectron()
  const timerStore = useTimerStore()
  const projectionStore = useProjectionStore()
  const { isDark } = useDarkMode()
  const { cleanup } = useMemoryManager('useProjectionMessaging')

  // 消息隊列
  const messageQueue = ref<AppMessage[]>([])
  const isProcessing = ref(false)
  const lastSentMessage = ref<AppMessage | null>(null)

  // 防抖動延遲時間（毫秒）
  const DEBOUNCE_DELAY = 100

  /**
   * 防抖動的發送消息函數
   */
  const debouncedSendToProjection = (() => {
    let timeoutId: number | null = null

    return (message: AppMessage, force = false) => {
      // 如果強制發送，清除之前的延遲
      if (force) {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        sendMessageImmediately(message)
        return
      }

      // 清除之前的延遲
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      // 設置新的延遲
      timeoutId = window.setTimeout(() => {
        sendMessageImmediately(message)
        timeoutId = null
      }, DEBOUNCE_DELAY)
    }
  })()

  /**
   * 立即發送消息
   */
  const sendMessageImmediately = (message: AppMessage) => {
    if (!isElectron()) return

    // 檢查是否與上次發送的消息相同
    if (isSameMessage(lastSentMessage.value, message)) {
      return
    }

    try {
      originalSendToProjection(message)
      lastSentMessage.value = message
    } catch (error) {
      console.error('發送投影消息失敗:', error)
    }
  }

  /**
   * 比較兩個消息是否相同
   */
  const isSameMessage = (msg1: AppMessage | null, msg2: AppMessage): boolean => {
    if (!msg1 || msg1.type !== msg2.type) return false

    // 深度比較數據
    return JSON.stringify(msg1.data) === JSON.stringify(msg2.data)
  }

  /**
   * 發送計時器更新消息（智能更新）
   */
  const sendTimerUpdate = (force = false) => {
    const currentState = {
      mode: timerStore.settings.mode,
      timerDuration: timerStore.settings.timerDuration,
      timezone: timerStore.settings.timezone,
      isRunning: timerStore.settings.isRunning,
      remainingTime: timerStore.settings.remainingTime,
      formattedTime: timerStore.formattedTime,
      progress: timerStore.progress,
    }

    const message: AppMessage = {
      type: MessageType.UPDATE_TIMER,
      data: currentState,
    }

    // 如果強制發送，直接發送
    if (force) {
      sendMessageImmediately(message)
      return
    }

    // 檢查狀態是否真的改變了（智能更新）
    const hasStateChanged =
      !lastSentMessage.value ||
      lastSentMessage.value.type !== message.type ||
      JSON.stringify(lastSentMessage.value.data) !== JSON.stringify(message.data)

    if (hasStateChanged) {
      debouncedSendToProjection(message, false)
    }
  }

  /**
   * 發送主題更新消息
   */
  const sendThemeUpdate = (force = false) => {
    const message: AppMessage = {
      type: MessageType.UPDATE_THEME,
      data: {
        isDark: isDark.value,
      },
    }
    debouncedSendToProjection(message, force)
  }

  /**
   * 發送視圖切換消息
   */
  const sendViewChange = (view: ViewType, force = false) => {
    const message: AppMessage = {
      type: MessageType.CHANGE_VIEW,
      data: { view },
    }
    debouncedSendToProjection(message, force)
  }

  /**
   * 發送投影內容切換消息
   */
  const sendProjectionToggle = (force = false) => {
    const message: AppMessage = {
      type: MessageType.TOGGLE_PROJECTION_CONTENT,
      data: { showDefault: projectionStore.isShowingDefault },
    }
    debouncedSendToProjection(message, force)
  }

  /**
   * 發送計時器開始時的投影設置
   */
  const sendTimerStartProjection = () => {
    // 更新投影 store 狀態
    projectionStore.setCurrentView('timer')
    projectionStore.setShowingDefault(false)

    // 批量發送消息
    const messages: AppMessage[] = [
      {
        type: MessageType.CHANGE_VIEW,
        data: { view: ViewType.TIMER },
      },
      {
        type: MessageType.TOGGLE_PROJECTION_CONTENT,
        data: { showDefault: false },
      },
    ]

    sendBatchMessages(messages, true)
  }

  /**
   * 發送聖經更新消息
   */
  const sendBibleUpdate = (
    bibleData: { book: string; chapter: number; content: string },
    force = false,
  ) => {
    const message: AppMessage = {
      type: MessageType.UPDATE_BIBLE,
      data: bibleData,
    }
    debouncedSendToProjection(message, force)
  }

  /**
   * 批量發送消息
   */
  const sendBatchMessages = (messages: AppMessage[], force = false) => {
    if (force) {
      // 強制發送時，立即發送所有消息
      messages.forEach((message) => sendMessageImmediately(message))
    } else {
      // 非強制發送時，使用防抖動
      messages.forEach((message) => debouncedSendToProjection(message))
    }
  }

  /**
   * 強制刷新所有狀態到投影
   */
  const forceRefreshAll = () => {
    const messages: AppMessage[] = [
      {
        type: MessageType.UPDATE_TIMER,
        data: {
          mode: timerStore.settings.mode,
          timerDuration: timerStore.settings.timerDuration,
          timezone: timerStore.settings.timezone,
          isRunning: timerStore.settings.isRunning,
          remainingTime: timerStore.settings.remainingTime,
          formattedTime: timerStore.formattedTime,
          progress: timerStore.progress,
        },
      },
      {
        type: MessageType.UPDATE_THEME,
        data: { isDark: isDark.value },
      },
      {
        type: MessageType.TOGGLE_PROJECTION_CONTENT,
        data: { showDefault: projectionStore.isShowingDefault },
      },
    ]

    sendBatchMessages(messages, true)
  }

  /**
   * 清理消息隊列
   */
  const clearMessageQueue = () => {
    messageQueue.value = []
    lastSentMessage.value = null
  }

  /**
   * 清理記憶體資源
   */
  const cleanupResources = () => {
    clearMessageQueue()
    cleanup()
  }

  // 組件卸載時清理資源
  onBeforeUnmount(() => {
    cleanupResources()
  })

  return {
    // 主要發送函數
    sendTimerUpdate,
    sendThemeUpdate,
    sendViewChange,
    sendProjectionToggle,
    sendTimerStartProjection,
    sendBibleUpdate,
    sendBatchMessages,
    forceRefreshAll,

    // 工具函數
    clearMessageQueue,
    cleanupResources,

    // 狀態
    isProcessing: computed(() => isProcessing.value),
    messageQueue: computed(() => messageQueue.value),
  }
}
