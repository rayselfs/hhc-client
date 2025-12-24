import { useProjectionStore } from '@/stores/projection'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import { useBibleProjectionStore } from '@/stores/bibleProjection'
import { useTimerProjectionStore } from '@/stores/timerProjection'
import type { AppMessage } from '@/types/common'

/**
 * Projection Message Dispatcher
 * Responsible for dispatching received AppMessages to the corresponding Store for handling
 */
export const useProjectionMessageDispatcher = () => {
  const projectionStore = useProjectionStore()
  const mediaProjectionStore = useMediaProjectionStore()
  const bibleProjectionStore = useBibleProjectionStore()
  const timerProjectionStore = useTimerProjectionStore()

  /**
   * Dispatch message
   * @param message The received message
   * @returns Whether a Store successfully handled the message
   */
  const dispatchMessage = (message: AppMessage): boolean => {
    if (projectionStore.handleMessage(message)) return true
    if (mediaProjectionStore.handleMessage(message)) return true
    if (bibleProjectionStore.handleMessage(message)) return true
    if (timerProjectionStore.handleMessage(message)) return true
    return false
  }

  return {
    dispatchMessage,
  }
}
