import type { AppMessage } from '@/types/common'
import { useSentry } from './useSentry'

/**
 * Electron environment related composable
 * Provides unified Electron API calls and state management
 */
export const useElectron = () => {
  const { reportError } = useSentry()
  /**
   * Check if running in Electron environment
   * @returns {boolean} Returns true if in Electron environment, false otherwise
   */
  const isElectron = (): boolean => {
    return typeof window !== 'undefined' && !!window.electronAPI
  }

  /**
   * Send message to projection window
   * @param {AppMessage} data - Application message to send
   * @throws {Error} Throws error when sending fails
   */
  const sendToProjection = (data: AppMessage): void => {
    if (isElectron()) {
      try {
        window.electronAPI.sendToProjection(data)
      } catch (error) {
        reportError(error, {
          operation: 'send-to-projection',
          component: 'useElectron',
        })
      }
    }
  }

  /**
   * Send message to main window
   * @param {AppMessage} data - Application message to send
   */
  const sendToMain = (data: AppMessage): void => {
    if (isElectron()) {
      window.electronAPI.sendToMain(data)
    }
  }

  /**
   * Check if projection window exists
   * @returns {Promise<boolean>} Returns true if projection window exists, false otherwise
   * @throws {Error} Throws error when check fails
   */
  const checkProjectionWindow = async (): Promise<boolean> => {
    if (isElectron()) {
      try {
        return await window.electronAPI.checkProjectionWindow()
      } catch (error) {
        reportError(error, {
          operation: 'check-projection-window',
          component: 'useElectron',
        })
        return false
      }
    }
    return false
  }

  /**
   * Ensure projection window exists, create if it doesn't exist
   * @returns {Promise<boolean>} Returns true if successfully created or already exists, false otherwise
   * @throws {Error} Throws error when creation fails
   */
  const ensureProjectionWindow = async (): Promise<boolean> => {
    if (isElectron()) {
      try {
        return await window.electronAPI.ensureProjectionWindow()
      } catch (error) {
        reportError(error, {
          operation: 'ensure-projection-window',
          component: 'useElectron',
        })
        return false
      }
    }
    return false
  }

  // 獲取顯示器信息
  const getDisplays = async (): Promise<unknown[]> => {
    if (isElectron()) {
      try {
        return await window.electronAPI.getDisplays()
      } catch (error) {
        reportError(error, {
          operation: 'get-displays',
          component: 'useElectron',
        })
        return []
      }
    }
    return []
  }

  // 監聽來自主窗口的消息
  const onMainMessage = (callback: (data: AppMessage) => void): void => {
    if (isElectron()) {
      window.electronAPI.onMainMessage(callback)
    }
  }

  // 監聽來自投影窗口的消息
  const onProjectionMessage = (callback: (data: AppMessage) => void): void => {
    if (isElectron()) {
      window.electronAPI.onProjectionMessage(callback)
    }
  }

  // 監聽獲取當前狀態事件
  const onGetCurrentState = (callback: () => void): void => {
    if (isElectron()) {
      window.electronAPI.onGetCurrentState(callback)
    }
  }

  // 監聽投影窗口開啟事件
  const onProjectionOpened = (callback: () => void): void => {
    if (isElectron()) {
      window.electronAPI.onProjectionOpened(callback)
    }
  }

  // 監聽投影窗口關閉事件
  const onProjectionClosed = (callback: () => void): void => {
    if (isElectron()) {
      window.electronAPI.onProjectionClosed(callback)
    }
  }

  // 監聽沒有第二螢幕檢測事件
  const onNoSecondScreenDetected = (callback: () => void): void => {
    if (isElectron()) {
      window.electronAPI.onNoSecondScreenDetected(callback)
    }
  }

  // 移除所有監聽器
  const removeAllListeners = (channel: string): void => {
    if (isElectron()) {
      window.electronAPI.removeAllListeners(channel)
    }
  }

  return {
    // 狀態檢查
    isElectron,

    // 消息傳遞
    sendToProjection,
    sendToMain,

    // 窗口管理
    checkProjectionWindow,
    ensureProjectionWindow,
    getDisplays,

    // 事件監聽
    onMainMessage,
    onProjectionMessage,
    onGetCurrentState,
    onProjectionOpened,
    onProjectionClosed,
    onNoSecondScreenDetected,
    removeAllListeners,
  }
}

/**
 * 投影窗口專用的 composable
 * 提供投影窗口特有的功能
 */
export const useProjectionElectron = () => {
  const { isElectron, onProjectionMessage, onGetCurrentState, removeAllListeners } = useElectron()

  // 監聽來自主窗口的消息
  const handleMessage = (callback: (data: AppMessage) => void): (() => void) | void => {
    if (isElectron()) {
      // 在 Electron 環境中，監聽 IPC 消息
      onProjectionMessage(callback)
    } else {
      // 在瀏覽器環境中，監聽 postMessage
      const messageHandler = (event: MessageEvent) => {
        callback(event.data)
      }
      window.addEventListener('message', messageHandler)

      // 返回清理函數
      return () => {
        window.removeEventListener('message', messageHandler)
      }
    }
  }

  // 請求當前狀態
  const requestCurrentState = (): void => {
    if (isElectron()) {
      // 在 Electron 環境中，通過 IPC 請求狀態
      onGetCurrentState(() => {
        // 主窗口會自動發送當前狀態
      })
    } else if (window.opener) {
      // 在瀏覽器環境中，通過 postMessage 請求狀態
      window.opener.postMessage({ type: 'REQUEST_STATE' }, '*')
    }
  }

  return {
    isElectron,
    handleMessage,
    requestCurrentState,
    removeAllListeners,
  }
}
