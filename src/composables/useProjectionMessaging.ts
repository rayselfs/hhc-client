import { ref, computed, onBeforeUnmount } from 'vue'
import { useElectron } from './useElectron'
import { useProjectionStore } from '@/stores/projection'
import { MessageType, ViewType } from '@/types/common'
import type { AppMessage } from '@/types/common'
import { useMemoryManager } from '@/utils/memoryManager'
import { useSentry } from './useSentry'

// Globally shared last sent message record (solves multi-instance message deduplication)
let globalLastSentMessage: AppMessage | null = null

/**
 * Projection Messaging Management Composable (Generic)
 *
 * Features:
 * - Unified management of message communication between main window and projection window
 * - Provides debounce mechanism to reduce duplicate projection message sending
 * - Message deduplication, avoids sending identical messages (globally shared state)
 * - State synchronization, ensures consistency between main window and projection window
 */
export const useProjectionMessaging = () => {
  const { reportError } = useSentry()
  const {
    sendToProjection: originalSendToProjection,
    isElectron,
    checkProjectionWindow,
    ensureProjectionWindow,
  } = useElectron()
  const projectionStore = useProjectionStore()
  const { cleanup } = useMemoryManager('useProjectionMessaging')

  // Message queue
  const messageQueue = ref<AppMessage[]>([])
  const isProcessing = ref(false)

  // Debounce delay (ms)
  const DEBOUNCE_DELAY = 100

  /**
   * Debounced send message function with keys
   */
  const debouncedSendToProjection = (() => {
    const timeoutMap = new Map<string, number>()

    const getMessageKey = (message: AppMessage): string => {
      // Create a unique key based on message type and action (if available)
      const base = message.type
      if (message.data && typeof message.data === 'object' && 'action' in message.data) {
        return `${base}:${(message.data as { action: string }).action}`
      }
      return base
    }

    return (message: AppMessage, force = false) => {
      const key = getMessageKey(message)

      // If forced, clear previous timeout for this key
      if (force) {
        if (timeoutMap.has(key)) {
          clearTimeout(timeoutMap.get(key))
          timeoutMap.delete(key)
        }
        sendMessageImmediately(message, true)
        return
      }

      // Clear previous timeout for this key
      if (timeoutMap.has(key)) {
        clearTimeout(timeoutMap.get(key))
      }

      // Set new timeout
      const timeoutId = window.setTimeout(() => {
        sendMessageImmediately(message, false)
        timeoutMap.delete(key)
      }, DEBOUNCE_DELAY)

      timeoutMap.set(key, timeoutId)
    }
  })()

  /**
   * Send message immediately
   */
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
        component: 'useProjectionMessaging',
        extra: { messageType: message.type },
      })
    }
  }

  /**
   * Compare if two messages are identical
   */
  const isSameMessage = (msg1: AppMessage | null, msg2: AppMessage): boolean => {
    if (!msg1 || msg1.type !== msg2.type) return false

    // Deep compare data
    return JSON.stringify(msg1.data) === JSON.stringify(msg2.data)
  }

  /**
   * Generic send projection message function
   * @param type Message type
   * @param data Message data
   * @param options Options { force: boolean }
   */
  const sendProjectionMessage = <T extends MessageType>(
    type: T,
    data: Extract<AppMessage, { type: T }>['data'],
    options: { force?: boolean } = {},
  ) => {
    const message = { type, data } as AppMessage
    debouncedSendToProjection(message, options.force || false)
  }

  /**
   * Batch send messages
   */
  const sendBatchMessages = (messages: AppMessage[], force = false) => {
    if (force) {
      messages.forEach((message) => sendMessageImmediately(message, true))
    } else {
      messages.forEach((message) => debouncedSendToProjection(message))
    }
  }

  /**
   * Unified projection state control method
   */
  const setProjectionState = async (showDefault: boolean, view?: ViewType) => {
    // 0. Ensure projection window exists
    if (isElectron()) {
      try {
        const projectionExists = await checkProjectionWindow()
        if (!projectionExists) {
          console.log('ensureProjectionWindow')
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

    // 1. Update store state
    projectionStore.setShowingDefault(showDefault)

    // 2. If view specified, update current view
    if (view) {
      projectionStore.setCurrentView(view)
    }

    // 3. Prepare messages to send
    const messages: AppMessage[] = []

    // 4. If view specified, add view change message
    if (view) {
      messages.push({
        type: MessageType.VIEW_CHANGE,
        data: { view },
      })
    }

    // 5. Then add projection content toggle message
    messages.push({
      type: MessageType.PROJECTION_TOGGLE_CONTENT,
      data: { showDefault },
    })

    // 6. Force send all messages to ensure sync
    sendBatchMessages(messages, true)
  }

  /**
   * Send locale update message
   */
  const sendLocaleUpdate = (locale: string) => {
    sendProjectionMessage(MessageType.LOCALE_UPDATE, { locale })
  }

  /**
   * Clear message queue
   */
  const clearMessageQueue = () => {
    messageQueue.value = []
  }

  /**
   * Cleanup memory resources
   */
  const cleanupResources = () => {
    clearMessageQueue()
    cleanup()
  }

  // Cleanup resources on component unmount
  onBeforeUnmount(() => {
    cleanupResources()
  })

  return {
    // ====== Projection State Control ======
    setProjectionState,
    sendProjectionMessage, // Generic Send Function
    sendLocaleUpdate,

    // ====== Batch Operations ======
    sendBatchMessages,

    // ====== Helper Functions ======
    clearMessageQueue,
    cleanupResources,

    // ====== State Monitoring ======
    isProcessing: computed(() => isProcessing.value),
    messageQueue: computed(() => messageQueue.value),

    // ====== For Debugging ======
    getLastSentMessage: () => globalLastSentMessage,
  }
}
