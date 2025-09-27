import { onMounted, onBeforeUnmount, type Ref } from 'vue'
import { useProjectionStore } from '@/stores/projection'
import { useTimerStore } from '@/stores/timer'
import { useElectron } from '@/composables/useElectron'
import { MessageType } from '@/types/common'

export function useKeyboardShortcuts(currentView?: Ref<string> | string) {
  const projectionStore = useProjectionStore()
  const timerStore = useTimerStore()
  const { sendToProjection } = useElectron()

  // 處理鍵盤事件
  const handleKeydown = (event: KeyboardEvent) => {
    // 避免在輸入框中觸發快捷鍵
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    // 檢查是否為 Mac 系統
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

    // 投影快捷鍵
    if (isMac) {
      // Mac: Command + Shift + Enter
      if (event.metaKey && event.shiftKey && event.key === 'Enter') {
        event.preventDefault()
        toggleProjection()
      }
    } else {
      // Windows: F5
      if (event.key === 'F5') {
        event.preventDefault()
        toggleProjection()
      }
    }

    // 取消投影快捷鍵 (Windows 和 Mac 都是 Control + Q)
    if (event.ctrlKey && event.key === 'q') {
      // 只有在投影開啟時才響應 Control + Q
      if (!projectionStore.isShowingDefault) {
        event.preventDefault()
        closeProjection()
      }
    }

    // 計時器快捷鍵 (只在計時器頁面響應)
    const view = typeof currentView === 'string' ? currentView : currentView?.value
    if (view === 'timer') {
      switch (event.code) {
        case 'Space':
          event.preventDefault()
          if (timerStore.settings.isRunning) {
            // 正在運行 → 暫停
            timerStore.pauseTimer()
            sendTimerUpdate()
          } else if (timerStore.settings.pausedTime && timerStore.settings.pausedTime > 0) {
            // 已暫停 → 繼續
            timerStore.resumeTimer()
            sendTimerUpdate()
          } else {
            // 未開始 → 開始
            timerStore.startTimer()
            sendTimerUpdate()
          }
          break
        case 'KeyR':
          event.preventDefault()
          timerStore.resetTimer()
          sendTimerUpdate()
          break
      }
    }
  }

  // 切換投影狀態
  const toggleProjection = () => {
    projectionStore.toggleProjectionContent()
    sendProjectionToggle()
  }

  // 關閉投影
  const closeProjection = () => {
    if (!projectionStore.isShowingDefault) {
      projectionStore.setShowingDefault(true)
      sendProjectionToggle()
    }
  }

  // 發送投影切換消息
  const sendProjectionToggle = () => {
    sendToProjection({
      type: MessageType.TOGGLE_PROJECTION_CONTENT,
      data: { showDefault: projectionStore.isShowingDefault },
    })
  }

  // 發送計時器更新消息
  const sendTimerUpdate = () => {
    sendToProjection({
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
    })
  }

  // 生命週期管理
  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', handleKeydown)
  })

  return {
    toggleProjection,
    closeProjection,
  }
}
