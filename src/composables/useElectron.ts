import type { AppMessage } from '@/types/common'
import type { BibleVersion, SearchResult } from '@/types/bible'
import type { TimerCommand, TimerState } from '@/types/electron'
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

  // Get display information
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

  // Listen for messages from main window
  const onMainMessage = (callback: (data: AppMessage) => void): void => {
    if (isElectron()) {
      window.electronAPI.onMainMessage(callback)
    }
  }

  // Listen for messages from projection window
  const onProjectionMessage = (callback: (data: AppMessage) => void): void => {
    if (isElectron()) {
      window.electronAPI.onProjectionMessage(callback)
    }
  }

  // Listen for get current state event
  const onGetCurrentState = (callback: () => void): void => {
    if (isElectron()) {
      window.electronAPI.onGetCurrentState(callback)
    }
  }

  // Listen for projection window opened event
  const onProjectionOpened = (callback: () => void): void => {
    if (isElectron()) {
      window.electronAPI.onProjectionOpened(callback)
    }
  }

  // Listen for projection window closed event
  const onProjectionClosed = (callback: () => void): void => {
    if (isElectron()) {
      window.electronAPI.onProjectionClosed(callback)
    }
  }

  // Listen for no second screen detected event
  const onNoSecondScreenDetected = (callback: () => void): void => {
    if (isElectron()) {
      window.electronAPI.onNoSecondScreenDetected(callback)
    }
  }

  // Remove all listeners
  const removeAllListeners = (channel: string): void => {
    if (isElectron()) {
      window.electronAPI.removeAllListeners(channel)
    }
  }

  /**
   * Close projection window
   */
  const closeProjectionWindow = async (): Promise<void> => {
    if (isElectron()) {
      try {
        await window.electronAPI.closeProjectionWindow()
      } catch (error) {
        reportError(error, {
          operation: 'close-projection-window',
          component: 'useElectron',
        })
      }
    }
  }

  /**
   * Get file path from file object (Electron specific)
   */
  const getFilePath = (file: File): string => {
    if (isElectron()) {
      return window.electronAPI.getFilePath(file)
    }
    return ''
  }

  /**
   * Save file to persistent storage (Electron specific)
   */
  const saveFile = async (
    sourcePath: string,
  ): Promise<{ filePath: string; thumbnailPath?: string }> => {
    if (isElectron()) {
      try {
        return await window.electronAPI.saveFile(sourcePath)
      } catch (error) {
        reportError(error, {
          operation: 'save-file',
          component: 'useElectron',
        })
        throw error
      }
    }
    throw new Error('Not in Electron environment')
  }

  /**
   * Update system language
   */
  const updateLanguage = async (locale: string): Promise<void> => {
    if (isElectron()) {
      try {
        await window.electronAPI.updateLanguage(locale)
      } catch (error) {
        reportError(error, {
          operation: 'update-language',
          component: 'useElectron',
          extra: { locale },
        })
      }
    }
  }

  /**
   * Get system locale
   */
  const getSystemLocale = async (): Promise<string | undefined> => {
    if (isElectron()) {
      try {
        return await window.electronAPI.getSystemLocale()
      } catch (error) {
        reportError(error, {
          operation: 'get-system-locale',
          component: 'useElectron',
        })
        return undefined
      }
    }
    return undefined
  }

  /**
   * Reset user data
   */
  const resetUserData = async (): Promise<void> => {
    if (isElectron()) {
      try {
        await window.electronAPI.resetUserData()
      } catch (error) {
        reportError(error, {
          operation: 'reset-user-data',
          component: 'useElectron',
        })
        throw error
      }
    }
  }

  // Bible API Methods
  const getBibleVersions = async (): Promise<BibleVersion[]> => {
    if (isElectron()) {
      try {
        return await window.electronAPI.getBibleVersions()
      } catch (error) {
        reportError(error, {
          operation: 'get-bible-versions',
          component: 'useElectron',
        })
        throw error
      }
    }
    return []
  }

  const getBibleContent = async (versionId: number): Promise<void> => {
    if (isElectron()) {
      try {
        await window.electronAPI.getBibleContent(versionId)
      } catch (error) {
        reportError(error, {
          operation: 'get-bible-content',
          component: 'useElectron',
          extra: { versionId },
        })
        throw error
      }
    }
  }

  const searchBibleVerses = async (params: {
    q: string
    versionCode: string
    top: number
  }): Promise<SearchResult[]> => {
    if (isElectron()) {
      try {
        return await window.electronAPI.searchBibleVerses(params)
      } catch (error) {
        reportError(error, {
          operation: 'search-bible-verses',
          component: 'useElectron',
          extra: { params },
        })
        throw error
      }
    }
    return []
  }

  const onBibleContentChunk = (callback: (chunk: Uint8Array) => void): void => {
    if (isElectron()) {
      window.electronAPI.onBibleContentChunk(callback)
    }
  }

  // Updater Methods
  const onUpdateAvailable = (callback: () => void): void => {
    if (isElectron()) {
      window.electronAPI.onUpdateAvailable(callback)
    }
  }

  const onUpdateDownloaded = (callback: () => void): void => {
    if (isElectron()) {
      window.electronAPI.onUpdateDownloaded(callback)
    }
  }

  const onUpdateError = (callback: (error: string) => void): void => {
    if (isElectron()) {
      window.electronAPI.onUpdateError(callback)
    }
  }

  return {
    // State check
    isElectron,

    // Message passing
    sendToProjection,
    sendToMain,

    // Window management
    checkProjectionWindow,
    ensureProjectionWindow,
    closeProjectionWindow,
    getDisplays,

    // System settings
    updateLanguage,
    getSystemLocale,
    resetUserData,

    // File operations
    getFilePath,
    saveFile,

    // Bible API
    getBibleVersions,
    getBibleContent,
    searchBibleVerses,
    onBibleContentChunk,

    // Updater Event Listeners
    onUpdateAvailable,
    onUpdateDownloaded,
    onUpdateError,

    // Timer IPC
    timerCommand: (command: TimerCommand) => {
      if (isElectron()) {
        try {
          window.electronAPI.timerCommand(command)
        } catch (error) {
          reportError(error, {
            operation: 'timer-command',
            component: 'useElectron',
          })
        }
      }
    },
    onTimerTick: (callback: (state: Partial<TimerState>) => void) => {
      if (isElectron()) {
        window.electronAPI.onTimerTick(callback)
      }
    },
    timerInitialize: async (settings: Partial<TimerState>) => {
      if (isElectron()) {
        try {
          await window.electronAPI.timerInitialize(settings)
        } catch (error) {
          reportError(error, {
            operation: 'timer-initialize',
            component: 'useElectron',
          })
        }
      }
    },
    timerGetState: async () => {
      if (isElectron()) {
        try {
          return await window.electronAPI.timerGetState()
        } catch (error) {
          reportError(error, {
            operation: 'timer-get-state',
            component: 'useElectron',
          })
          return null
        }
      }
      return null
    },

    // Event listeners
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
 * Projection window specific composable
 * Provides features specific to projection window
 */
export const useProjectionElectron = () => {
  const { isElectron, onProjectionMessage, onGetCurrentState, removeAllListeners } = useElectron()

  // Listen for messages from main window
  const handleMessage = (callback: (data: AppMessage) => void): (() => void) | void => {
    if (isElectron()) {
      // In Electron environment, listen for IPC messages
      onProjectionMessage(callback)
    } else {
      // In browser environment, listen for postMessage
      const messageHandler = (event: MessageEvent) => {
        callback(event.data)
      }
      window.addEventListener('message', messageHandler)

      // Return cleanup function
      return () => {
        window.removeEventListener('message', messageHandler)
      }
    }
  }

  // Request current state
  const requestCurrentState = (): void => {
    if (isElectron()) {
      // In Electron environment, request state via IPC
      onGetCurrentState(() => {
        // Main window will automatically send current state
      })
    } else if (window.opener) {
      // In browser environment, request state via postMessage
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
