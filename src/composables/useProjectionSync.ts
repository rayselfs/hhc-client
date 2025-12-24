import { useTimerStore } from '@/stores/timer'
import { useProjectionStore } from '@/stores/projection'
import { useProjectionMessaging } from './useProjectionMessaging'
import {
  MessageType,
  StorageKey,
  StorageCategory,
  getStorageKey,
  type AppMessage,
} from '@/types/common'
import { useLocalStorage } from './useLocalStorage'
import { BIBLE_CONFIG } from '@/config/app'
import { useI18n } from 'vue-i18n'

/**
 * Projection State Sync Composable
 * Responsible for syncing various states from the main window to the projection window
 */
export const useProjectionSync = () => {
  const timerStore = useTimerStore()
  const projectionStore = useProjectionStore()
  const { sendBatchMessages } = useProjectionMessaging()
  const { getLocalItem } = useLocalStorage()
  const { locale } = useI18n()

  /**
   * Sync all states to the projection window
   * Purpose: Sync all states from the main window to the projection window during initialization or after reload
   */
  const syncAllStates = () => {
    // Read font size from localStorage
    const savedFontSize = getLocalItem<number>(
      getStorageKey(StorageCategory.BIBLE, StorageKey.FONT_SIZE),
      'int',
    )
    const bibleFontSize = savedFontSize || BIBLE_CONFIG.FONT.DEFAULT_SIZE

    const messages: AppMessage[] = [
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

  return {
    syncAllStates,
  }
}
