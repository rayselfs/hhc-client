import { onMounted, onBeforeUnmount, type Ref } from 'vue'
import { useProjectionStore } from '@/stores/projection'
import { useTimerStore } from '@/stores/timer'
import { useProjectionMessaging } from '@/composables/useProjectionMessaging'
import { useMemoryManager } from '@/utils/memoryManager'

export function useKeyboardShortcuts(currentView?: Ref<string> | string) {
  const projectionStore = useProjectionStore()
  const timerStore = useTimerStore()
  const { sendTimerUpdate, setProjectionState } = useProjectionMessaging()
  const { track, untrack, cleanup } = useMemoryManager('useKeyboardShortcuts')

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
            sendTimerUpdateMessage()
          } else if (timerStore.settings.pausedTime && timerStore.settings.pausedTime > 0) {
            // 已暫停 → 繼續
            timerStore.resumeTimer()
            sendTimerUpdateMessage()
          } else {
            // 未開始 → 開始
            timerStore.startTimer()
            sendTimerUpdateMessage()
          }
          break
        case 'KeyR':
          event.preventDefault()
          timerStore.resetTimer()
          sendTimerUpdateMessage()
          break
      }
    }
  }

  // 切換投影狀態
  const toggleProjection = async () => {
    const newShowDefault = !projectionStore.isShowingDefault
    // setProjectionState 會自動檢查並創建投影窗口
    await setProjectionState(newShowDefault)
  }

  // 關閉投影
  const closeProjection = async () => {
    if (!projectionStore.isShowingDefault) {
      await setProjectionState(true)
    }
  }

  // 發送計時器更新消息（使用優化版本）
  const sendTimerUpdateMessage = () => {
    sendTimerUpdate()
  }

  // 生命週期管理
  onMounted(() => {
    // 追蹤事件監聽器
    track('keydown-listener', 'listener', {
      element: document,
      event: 'keydown',
      handler: handleKeydown,
    })
    document.addEventListener('keydown', handleKeydown)
  })

  onBeforeUnmount(() => {
    // 清理事件監聽器
    untrack('keydown-listener')
    document.removeEventListener('keydown', handleKeydown)

    // 清理記憶體
    cleanup()
  })

  return {
    toggleProjection,
    closeProjection,
  }
}
