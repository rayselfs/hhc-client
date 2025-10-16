import { ref, computed, onBeforeUnmount } from 'vue'
import { useElectron } from './useElectron'
import { useTimerStore } from '@/stores/timer'
import { useProjectionStore } from '@/stores/projection'
import { MessageType, ViewType } from '@/types/common'
import type { AppMessage } from '@/types/common'
import { useMemoryManager } from '@/utils/memoryManager'
import { useSentry } from './useSentry'

// 全局共享的最後發送消息記錄（解決多實例消息去重問題）
let globalLastSentMessage: AppMessage | null = null

/**
 * 投影消息管理 Composable
 *
 * 功能：
 * - 統一管理主窗口與投影窗口之間的消息通訊
 * - 提供防抖動機制，減少重複的投影消息發送
 * - 消息去重，避免發送相同的消息（全局共享狀態）
 * - 狀態同步，確保主窗口和投影窗口狀態一致
 *
 * 核心方法：
 * - setProjectionState: 設置投影開關和視圖（最常用）
 * - sendViewChange: 只切換視圖，不影響投影開關
 * - syncAllStates: 同步所有狀態（初始化時使用）
 *
 * @example
 * // 開啟計時器投影
 * const { setProjectionState } = useProjectionMessaging()
 * setProjectionState(false, ViewType.TIMER)
 *
 * @example
 * // 初始化時同步所有狀態
 * const { syncAllStates } = useProjectionMessaging()
 * syncAllStates()
 */
export const useProjectionMessaging = () => {
  const { reportError } = useSentry()
  const {
    sendToProjection: originalSendToProjection,
    isElectron,
    checkProjectionWindow,
    ensureProjectionWindow,
  } = useElectron()
  const timerStore = useTimerStore()
  const projectionStore = useProjectionStore()
  const { cleanup } = useMemoryManager('useProjectionMessaging')

  // 消息隊列
  const messageQueue = ref<AppMessage[]>([])
  const isProcessing = ref(false)

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
    if (isSameMessage(globalLastSentMessage, message)) {
      return
    }

    try {
      originalSendToProjection(message)
      globalLastSentMessage = message
    } catch (error) {
      reportError(error, {
        operation: 'send-projection-message',
        component: 'useProjectionMessaging',
        extra: { messageType: message.type },
      })
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

    // 檢查狀態是否真的改變了（智能更新，使用全局共享狀態）
    const hasStateChanged =
      !globalLastSentMessage ||
      globalLastSentMessage.type !== message.type ||
      JSON.stringify(globalLastSentMessage.data) !== JSON.stringify(message.data)

    if (hasStateChanged) {
      debouncedSendToProjection(message, false)
    }
  }

  /**
   * 發送視圖切換消息
   * 用途：只切換投影窗口顯示的視圖類型，不改變投影開關狀態
   *
   * 使用場景：
   * - 在投影已開啟時，切換顯示的內容（聖經 → 計時器）
   * - 需要單獨更新視圖而不影響投影開關狀態時
   */
  const sendViewChange = (view: ViewType, force = false) => {
    const message: AppMessage = {
      type: MessageType.CHANGE_VIEW,
      data: { view },
    }
    debouncedSendToProjection(message, force)
  }

  /**
   * 統一的投影狀態控制方法（推薦使用）
   * 用途：設置新的投影狀態並確保 store 和投影窗口完全同步
   *
   * 功能：
   * - 自動檢查投影窗口是否存在，不存在則自動創建
   * - 更新 store 狀態
   * - 發送消息到投影窗口
   *
   * 使用場景：
   * - 用戶點擊按鈕切換投影開關
   * - 透過快捷鍵切換投影
   * - 開始計時時自動開啟計時器投影
   * - 任何需要改變投影狀態的操作
   *
   * @param showDefault - true 表示顯示預設內容（關閉投影），false 表示顯示實際內容（開啟投影）
   * @param view - 可選，要切換到的視圖類型（如 'timer', 'bible'）
   *
   * @example
   * // 開啟計時器投影（會自動檢查並創建投影窗口）
   * setProjectionState(false, ViewType.TIMER)
   *
   * @example
   * // 關閉投影
   * setProjectionState(true)
   *
   * @example
   * // 切換投影狀態（不改變視圖）
   * setProjectionState(!projectionStore.isShowingDefault)
   */
  const setProjectionState = async (showDefault: boolean, view?: ViewType) => {
    // 0. 確保投影窗口存在（自動處理）
    if (isElectron()) {
      try {
        const projectionExists = await checkProjectionWindow()
        if (!projectionExists) {
          await ensureProjectionWindow()
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      } catch (error) {
        reportError(error, {
          operation: 'set-projection-state',
          component: 'useProjectionMessaging',
        })
      }
    }

    // 1. 更新 store 狀態
    projectionStore.setShowingDefault(showDefault)

    // 2. 如果指定了視圖，更新當前視圖
    if (view) {
      projectionStore.setCurrentView(view)
    }

    // 3. 準備要發送的消息
    const messages: AppMessage[] = [
      {
        type: MessageType.TOGGLE_PROJECTION_CONTENT,
        data: { showDefault },
      },
    ]

    // 4. 如果指定了視圖，添加視圖切換消息
    if (view) {
      messages.push({
        type: MessageType.CHANGE_VIEW,
        data: { view },
      })
    }

    // 5. 強制發送所有消息以確保同步
    sendBatchMessages(messages, true)
  }

  /**
   * 發送聖經更新消息
   */
  const sendBibleUpdate = (
    bibleData: {
      book: string
      bookNumber: number
      chapter: number
      chapterVerses: Array<{ number: number; text: string }>
      currentVerse: number
    },
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
   * 同步所有狀態到投影窗口
   * 用途：初始化時或投影窗口重新載入後，將主窗口所有狀態同步到投影窗口
   *
   * 包含：計時器狀態、投影開關狀態
   *
   * 注意：投影視圖不支援主題切換（固定為黑底白字），因此不包含主題狀態
   */
  const syncAllStates = () => {
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
    // ====== 投影狀態控制（推薦使用）======
    setProjectionState,

    // ====== 視圖與內容更新 ======
    sendViewChange,
    sendTimerUpdate,
    sendBibleUpdate,

    // ====== 批量操作 ======
    syncAllStates,
    sendBatchMessages,

    // ====== 工具函數 ======
    clearMessageQueue,
    cleanupResources,

    // ====== 狀態監控 ======
    isProcessing: computed(() => isProcessing.value),
    messageQueue: computed(() => messageQueue.value),

    // ====== 調試用 ======
    getLastSentMessage: () => globalLastSentMessage,
  }
}
