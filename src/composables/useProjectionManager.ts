import { ref, computed, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useElectron } from './useElectron'
import { useProjectionStore } from '@/stores/projection'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import { useBibleProjectionStore } from '@/stores/bibleProjection'
import { useTimerProjectionStore } from '@/stores/timerProjection'
import { useTimerStore } from '@/stores/timer'
import { useMemoryManager } from '@/utils/memoryManager'
import { useSentry } from './useSentry'
import { useLocalStorage } from './useLocalStorage'
import {
  MessageType,
  ViewType,
  StorageKey,
  StorageCategory,
  getStorageKey,
  type AppMessage,
} from '@/types/common'
import { BIBLE_CONFIG } from '@/config/app'

// Globally shared last sent message record (solves multi-instance message deduplication)
let globalLastSentMessage: AppMessage | null = null

/**
 * Projection Manager Composable
 *
 * Consolidated manager for all projection-related operations:
 * 1. Messaging: Sending messages to projection window (debounced, deduplicated)
 * 2. Dispatching: Routing received messages to appropriate stores
 * 3. Sync: Synchronizing state between main window and projection window
 */
export const useProjectionManager = () => {
  // Composables
  const { locale } = useI18n() // t is unused but standard practice to get locale
  const { reportError } = useSentry()
  const {
    sendToProjection: originalSendToProjection,
    isElectron,
    checkProjectionWindow,
    ensureProjectionWindow,
  } = useElectron()
  const { cleanup } = useMemoryManager('useProjectionManager')
  const { getLocalItem } = useLocalStorage()

  // Stores
  const projectionStore = useProjectionStore()
  const mediaProjectionStore = useMediaProjectionStore()
  const bibleProjectionStore = useBibleProjectionStore()
  const timerProjectionStore = useTimerProjectionStore()
  const timerStore = useTimerStore()

  // Internal State
  const messageQueue = ref<AppMessage[]>([])
  const isProcessing = ref(false)
  const DEBOUNCE_DELAY = 100

  // ==========================================
  // 1. Messaging Logic
  // ==========================================

  const sendMessageImmediately = (message: AppMessage, force = false) => {
    if (!isElectron()) return

    // Check if same as last sent message (unless forced)
    if (!force && isSameMessage(globalLastSentMessage, message)) {
      return
    }

    try {
      originalSendToProjection(message)
      globalLastSentMessage = message
    } catch (error) {
      reportError(error, {
        operation: 'send-projection-message',
        component: 'useProjectionManager',
        extra: { messageType: message.type },
      })
    }
  }

  const isSameMessage = (msg1: AppMessage | null, msg2: AppMessage): boolean => {
    if (!msg1 || msg1.type !== msg2.type) return false
    return JSON.stringify(msg1.data) === JSON.stringify(msg2.data)
  }

  /**
   * Debounced send message function with keys
   */
  const debouncedSendToProjection = (() => {
    const timeoutMap = new Map<string, number>()

    const getMessageKey = (message: AppMessage): string => {
      const base = message.type
      if (message.data && typeof message.data === 'object' && 'action' in message.data) {
        return `${base}:${(message.data as { action: string }).action}`
      }
      return base
    }

    return (message: AppMessage, force = false) => {
      const key = getMessageKey(message)

      if (force) {
        if (timeoutMap.has(key)) {
          clearTimeout(timeoutMap.get(key))
          timeoutMap.delete(key)
        }
        sendMessageImmediately(message, true)
        return
      }

      if (timeoutMap.has(key)) {
        clearTimeout(timeoutMap.get(key))
      }

      const timeoutId = window.setTimeout(() => {
        sendMessageImmediately(message, false)
        timeoutMap.delete(key)
      }, DEBOUNCE_DELAY)

      timeoutMap.set(key, timeoutId)
    }
  })()

  const sendProjectionMessage = <T extends MessageType>(
    type: T,
    data: Extract<AppMessage, { type: T }>['data'],
    options: { force?: boolean } = {},
  ) => {
    const message = { type, data } as AppMessage
    debouncedSendToProjection(message, options.force || false)
  }

  const sendBatchMessages = (messages: AppMessage[], force = false) => {
    if (force) {
      messages.forEach((message) => sendMessageImmediately(message, true))
    } else {
      messages.forEach((message) => debouncedSendToProjection(message))
    }
  }

  const clearMessageQueue = () => {
    messageQueue.value = []
  }

  const cleanupResources = () => {
    clearMessageQueue()
    cleanup()
  }

  // ==========================================
  // 2. High-Level Actions
  // ==========================================

  const setProjectionState = async (showDefault: boolean, view?: ViewType) => {
    // 0. Ensure projection window exists
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
          component: 'useProjectionManager',
        })
      }
    }

    // 1. Update store state
    projectionStore.setShowingDefault(showDefault)

    // 2. If view specified, update current view
    if (view) {
      projectionStore.setCurrentView(view)
    }

    // 3. Prepare messages
    const messages: AppMessage[] = []

    if (view) {
      messages.push({
        type: MessageType.VIEW_CHANGE,
        data: { view },
      })
    }

    messages.push({
      type: MessageType.PROJECTION_TOGGLE_CONTENT,
      data: { showDefault },
    })

    // 6. Force send all messages
    sendBatchMessages(messages, true)
  }

  const sendLocaleUpdate = (locale: string) => {
    sendProjectionMessage(MessageType.LOCALE_UPDATE, { locale })
  }

  // ==========================================
  // 3. Dispatch Logic
  // ==========================================

  const dispatchMessage = (message: AppMessage): boolean => {
    if (projectionStore.handleMessage(message)) return true
    if (mediaProjectionStore.handleMessage(message)) return true
    if (bibleProjectionStore.handleMessage(message)) return true
    if (timerProjectionStore.handleMessage(message)) return true
    return false
  }

  // ==========================================
  // 4. Sync Logic
  // ==========================================

  const syncAllStates = () => {
    // Read font size from localStorage
    const savedFontSize = getLocalItem<number>(
      getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE),
      'int',
    )
    const bibleFontSize = savedFontSize || BIBLE_CONFIG.FONT.DEFAULT_SIZE

    const messages: AppMessage[] = [
      {
        type: MessageType.VIEW_CHANGE,
        data: { view: projectionStore.currentView },
      },
      {
        type: MessageType.TIMER_SYNC_SETTINGS,
        data: {
          mode: timerStore.settings.mode,
          timerDuration: timerStore.settings.timerDuration,
          timezone: timerStore.settings.timezone,
          isRunning: timerStore.isRunning,
          remainingTime: timerStore.settings.remainingTime,
          formattedTime: timerStore.formattedTime,
          progress: timerStore.progress,
          overtimeMessageEnabled: timerStore.settings.overtimeMessageEnabled,
          overtimeMessage: timerStore.settings.overtimeMessage,
          reminderEnabled: timerStore.settings.reminderEnabled,
          reminderTime: timerStore.settings.reminderTime,
        },
      },
      {
        type: MessageType.PROJECTION_TOGGLE_CONTENT,
        data: { showDefault: projectionStore.isShowingDefault },
      },
      {
        type: MessageType.BIBLE_UPDATE_FONT_SIZE,
        data: { fontSize: bibleFontSize },
      },
      {
        type: MessageType.LOCALE_UPDATE,
        data: { locale: locale.value },
      },
    ]

    sendBatchMessages(messages, true)
  }

  // Lifecycle hooks
  onBeforeUnmount(() => {
    cleanupResources()
  })

  return {
    // Messaging
    sendProjectionMessage,
    sendBatchMessages,
    setProjectionState,
    sendLocaleUpdate,

    // Dispatch
    dispatchMessage,

    // Sync
    syncAllStates,

    // Helpers & Debug
    clearMessageQueue,
    cleanupResources,
    isProcessing: computed(() => isProcessing.value),
    messageQueue: computed(() => messageQueue.value),
    getLastSentMessage: () => globalLastSentMessage,
  }
}
