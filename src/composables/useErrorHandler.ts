/**
 * Unified error handling composable
 * Provides error capture, logging and recovery functionality
 */

/**
 * Error information interface
 */
export interface ErrorInfo {
  /** Error message */
  message: string
  /** Error stack information */
  stack?: string
  /** Component name where error occurred */
  component?: string
  /** Error occurrence timestamp */
  timestamp: Date
  /** User agent information */
  userAgent?: string
  /** URL when error occurred */
  url?: string
}

/**
 * Error handling options interface
 */
export interface ErrorHandlerOptions {
  /** Whether to show error notification */
  showNotification?: boolean
  /** Whether to log to console */
  logToConsole?: boolean
  /** Whether to report to server */
  reportToServer?: boolean
  /** Fallback action when error occurs */
  fallbackAction?: () => void
}

class ErrorHandler {
  private errors: ErrorInfo[] = []
  private maxErrors = 50 // Maximum number of errors to store

  /**
   * Main method for handling errors
   * @param {Error | string} error - Error object or error message
   * @param {ErrorHandlerOptions} options - Error handling options
   * @param {string} context - Context where error occurred
   */
  handleError(error: Error | string, options: ErrorHandlerOptions = {}, context?: string): void {
    const errorInfo: ErrorInfo = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      component: context,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }

    // 添加到錯誤列表
    this.addError(errorInfo)

    // 記錄到控制台
    if (options.logToConsole !== false) {
      console.error('Error handled:', errorInfo)
    }

    // 顯示通知
    if (options.showNotification) {
      this.showErrorNotification(errorInfo.message)
    }

    // 報告到服務器（如果啟用）
    if (options.reportToServer) {
      this.reportError(errorInfo)
    }

    // 執行回退動作
    if (options.fallbackAction) {
      try {
        options.fallbackAction()
      } catch (fallbackError) {
        console.error('Fallback action failed:', fallbackError)
      }
    }
  }

  /**
   * 處理 Electron 相關錯誤
   */
  handleElectronError(error: Error | string, context?: string, fallbackAction?: () => void): void {
    this.handleError(
      error,
      {
        showNotification: true,
        logToConsole: true,
        reportToServer: false,
        fallbackAction,
      },
      `Electron: ${context}`,
    )
  }

  /**
   * 處理 API 錯誤
   */
  handleApiError(error: Error | string, endpoint?: string, fallbackAction?: () => void): void {
    this.handleError(
      error,
      {
        showNotification: true,
        logToConsole: true,
        reportToServer: true,
        fallbackAction,
      },
      `API: ${endpoint}`,
    )
  }

  /**
   * 處理投影相關錯誤
   */
  handleProjectionError(
    error: Error | string,
    context?: string,
    fallbackAction?: () => void,
  ): void {
    this.handleError(
      error,
      {
        showNotification: true,
        logToConsole: true,
        reportToServer: false,
        fallbackAction:
          fallbackAction ||
          (() => {
            // 默認回退：嘗試重新創建投影窗口
            if (typeof window !== 'undefined' && window.electronAPI) {
              window.electronAPI.ensureProjectionWindow().catch((retryError) => {
                console.error('Failed to recreate projection window:', retryError)
              })
            }
          }),
      },
      `Projection: ${context}`,
    )
  }

  /**
   * 添加錯誤到列表
   */
  private addError(errorInfo: ErrorInfo): void {
    this.errors.unshift(errorInfo)

    // 保持錯誤列表大小
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors)
    }

    // 保存到 localStorage
    try {
      localStorage.setItem('app-errors', JSON.stringify(this.errors))
    } catch (storageError) {
      console.warn('Failed to save errors to localStorage:', storageError)
    }
  }

  /**
   * 顯示錯誤通知
   */
  private showErrorNotification(message: string): void {
    // 創建簡單的通知元素
    const notification = document.createElement('div')
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      max-width: 300px;
      font-size: 14px;
    `
    notification.textContent = `錯誤: ${message}`

    document.body.appendChild(notification)

    // 3秒後自動移除
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification)
      }
    }, 3000)
  }

  /**
   * 報告錯誤到服務器
   */
  private async reportError(errorInfo: ErrorInfo): Promise<void> {
    try {
      // 這裡可以實現錯誤報告到服務器的邏輯
      // 例如發送到 Sentry、LogRocket 等服務
      console.log('Error reported to server:', errorInfo)
    } catch (reportError) {
      console.error('Failed to report error:', reportError)
    }
  }

  /**
   * 獲取錯誤列表
   */
  getErrors(): ErrorInfo[] {
    return [...this.errors]
  }

  /**
   * 清除錯誤列表
   */
  clearErrors(): void {
    this.errors = []
    try {
      localStorage.removeItem('app-errors')
    } catch (storageError) {
      console.warn('Failed to clear errors from localStorage:', storageError)
    }
  }

  /**
   * 從 localStorage 載入錯誤
   */
  loadErrorsFromStorage(): void {
    try {
      const stored = localStorage.getItem('app-errors')
      if (stored) {
        this.errors = JSON.parse(stored)
      }
    } catch (storageError) {
      console.warn('Failed to load errors from localStorage:', storageError)
    }
  }
}

// 創建全局錯誤處理器實例
const errorHandler = new ErrorHandler()

// 載入已保存的錯誤
errorHandler.loadErrorsFromStorage()

/**
 * 使用錯誤處理的 composable
 */
export const useErrorHandler = () => {
  return {
    handleError: errorHandler.handleError.bind(errorHandler),
    handleElectronError: errorHandler.handleElectronError.bind(errorHandler),
    handleApiError: errorHandler.handleApiError.bind(errorHandler),
    handleProjectionError: errorHandler.handleProjectionError.bind(errorHandler),
    getErrors: errorHandler.getErrors.bind(errorHandler),
    clearErrors: errorHandler.clearErrors.bind(errorHandler),
  }
}

// 全局錯誤處理器
export default errorHandler
