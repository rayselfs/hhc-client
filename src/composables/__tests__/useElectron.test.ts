import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useElectron } from '../useElectron'
import type { AppMessage } from '@/types/common'
import type { TimerCommand, TimerState } from '@/types/electron'
import { MessageType, ViewType, TimerMode } from '@/types/common'

// Mock window.electronAPI
const mockElectronAPI = {
  // Basic messaging
  sendToProjection: vi.fn(),
  sendToMain: vi.fn(),

  // Projection window management
  checkProjectionWindow: vi.fn(),
  ensureProjectionWindow: vi.fn(),
  closeProjectionWindow: vi.fn(),
  getDisplays: vi.fn(),

  // Event listeners
  onMainMessage: vi.fn(),
  onProjectionMessage: vi.fn(),
  onGetCurrentState: vi.fn(),
  onProjectionOpened: vi.fn(),
  onProjectionClosed: vi.fn(),
  onNoSecondScreenDetected: vi.fn(),
  removeAllListeners: vi.fn(),

  // File operations
  getFilePath: vi.fn(),
  saveFile: vi.fn(),

  // System settings
  updateLanguage: vi.fn(),
  getSystemLocale: vi.fn(),
  resetUserData: vi.fn(),
  getHardwareAcceleration: vi.fn(),
  setHardwareAcceleration: vi.fn(),
  getVideoQuality: vi.fn(),
  setVideoQuality: vi.fn(),
  getEnableFfmpeg: vi.fn(),
  setEnableFfmpeg: vi.fn(),
  ffmpegCheckStatus: vi.fn(),
  ffmpegSetPath: vi.fn(),
  restartApp: vi.fn(),

  // Bible API
  getBibleVersions: vi.fn(),
  getBibleContent: vi.fn(),
  onBibleContentChunk: vi.fn(),

  // Updater
  onUpdateAvailable: vi.fn(),
  onUpdateDownloaded: vi.fn(),
  onUpdateError: vi.fn(),

  // Timer IPC
  timerCommand: vi.fn(),
  onTimerTick: vi.fn(),
  timerInitialize: vi.fn(),
  timerGetState: vi.fn(),
}

describe('useElectron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(window as { electronAPI?: unknown }).electronAPI = mockElectronAPI
  })

  afterEach(() => {
    delete (window as { electronAPI?: unknown }).electronAPI
  })

  describe('isElectron', () => {
    it('should return true when electronAPI is available', () => {
      const { isElectron } = useElectron()
      expect(isElectron()).toBe(true)
    })

    it('should return false when electronAPI is not available', () => {
      delete (window as { electronAPI?: unknown }).electronAPI
      const { isElectron } = useElectron()
      expect(isElectron()).toBe(false)
    })
  })

  describe('Message passing', () => {
    it('should send message to projection window', () => {
      const { sendToProjection } = useElectron()
      const message: AppMessage = {
        type: MessageType.TIMER_SYNC_SETTINGS,
        data: {
          mode: TimerMode.TIMER,
          timerDuration: 300,
          timezone: 'UTC',
          isRunning: false,
          remainingTime: 300,
          formattedTime: '05:00',
          progress: 100,
        },
      }

      sendToProjection(message)

      expect(mockElectronAPI.sendToProjection).toHaveBeenCalledWithExactlyOnceWith(message)
    })

    it('should send message to main window', () => {
      const { sendToMain } = useElectron()
      const message: AppMessage = {
        type: MessageType.PROJECTION_TOGGLE_CONTENT,
        data: { showDefault: true },
      }

      sendToMain(message)

      expect(mockElectronAPI.sendToMain).toHaveBeenCalledWithExactlyOnceWith(message)
    })

    it('should not throw when sending to projection fails in non-Electron', () => {
      delete (window as { electronAPI?: unknown }).electronAPI
      const { sendToProjection } = useElectron()

      expect(() =>
        sendToProjection({ type: MessageType.VIEW_CHANGE, data: { view: ViewType.TIMER } }),
      ).not.toThrow()
    })
  })

  describe('Projection window management', () => {
    it('should check projection window exists', async () => {
      mockElectronAPI.checkProjectionWindow.mockResolvedValue(true)
      const { checkProjectionWindow } = useElectron()

      const result = await checkProjectionWindow()

      expect(result).toBe(true)
      expect(mockElectronAPI.checkProjectionWindow).toHaveBeenCalled()
    })

    it('should ensure projection window exists', async () => {
      mockElectronAPI.ensureProjectionWindow.mockResolvedValue(true)
      const { ensureProjectionWindow } = useElectron()

      const result = await ensureProjectionWindow()

      expect(result).toBe(true)
      expect(mockElectronAPI.ensureProjectionWindow).toHaveBeenCalled()
    })

    it('should close projection window', async () => {
      const { closeProjectionWindow } = useElectron()

      await closeProjectionWindow()

      expect(mockElectronAPI.closeProjectionWindow).toHaveBeenCalled()
    })

    it('should get displays', async () => {
      const mockDisplays = [{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }]
      mockElectronAPI.getDisplays.mockResolvedValue(mockDisplays)
      const { getDisplays } = useElectron()

      const result = await getDisplays()

      expect(result).toEqual(mockDisplays)
    })

    it('should return false when checking projection window fails', async () => {
      mockElectronAPI.checkProjectionWindow.mockRejectedValue(new Error('Failed'))
      const { checkProjectionWindow } = useElectron()

      const result = await checkProjectionWindow()

      expect(result).toBe(false)
    })
  })

  describe('Event listeners', () => {
    it('should register main message listener', () => {
      const callback = vi.fn()
      const { onMainMessage } = useElectron()

      onMainMessage(callback)

      expect(mockElectronAPI.onMainMessage).toHaveBeenCalledWithExactlyOnceWith(callback)
    })

    it('should register projection message listener', () => {
      const callback = vi.fn()
      const { onProjectionMessage } = useElectron()

      onProjectionMessage(callback)

      expect(mockElectronAPI.onProjectionMessage).toHaveBeenCalledWithExactlyOnceWith(callback)
    })

    it('should register projection opened listener', () => {
      const callback = vi.fn()
      const { onProjectionOpened } = useElectron()

      onProjectionOpened(callback)

      expect(mockElectronAPI.onProjectionOpened).toHaveBeenCalledWithExactlyOnceWith(callback)
    })

    it('should remove all listeners for channel', () => {
      const { removeAllListeners } = useElectron()

      removeAllListeners('test-channel')

      expect(mockElectronAPI.removeAllListeners).toHaveBeenCalledWithExactlyOnceWith('test-channel')
    })
  })

  describe('File operations', () => {
    it('should get file path from file object', () => {
      const mockFile = new File(['content'], 'test.txt')
      mockElectronAPI.getFilePath.mockReturnValue('/path/to/test.txt')
      const { getFilePath } = useElectron()

      const result = getFilePath(mockFile)

      expect(result).toBe('/path/to/test.txt')
      expect(mockElectronAPI.getFilePath).toHaveBeenCalledWithExactlyOnceWith(mockFile)
    })

    it('should return empty string when getting file path in non-Electron', () => {
      delete (window as { electronAPI?: unknown }).electronAPI
      const { getFilePath } = useElectron()
      const mockFile = new File(['content'], 'test.txt')

      const result = getFilePath(mockFile)

      expect(result).toBe('')
    })

    it('should save file to persistent storage', async () => {
      const mockResult = { filePath: '/saved/file.txt', thumbnailData: new Uint8Array([1, 2, 3]) }
      mockElectronAPI.saveFile.mockResolvedValue(mockResult)
      const { saveFile } = useElectron()

      const result = await saveFile('/source/file.txt')

      expect(result).toEqual(mockResult)
      expect(mockElectronAPI.saveFile).toHaveBeenCalledWithExactlyOnceWith('/source/file.txt')
    })

    it('should throw when saving file in non-Electron', async () => {
      delete (window as { electronAPI?: unknown }).electronAPI
      const { saveFile } = useElectron()

      await expect(saveFile('/source/file.txt')).rejects.toThrow('Not in Electron environment')
    })
  })

  describe('System settings', () => {
    it('should update language', async () => {
      const { updateLanguage } = useElectron()

      await updateLanguage('zh-TW')

      expect(mockElectronAPI.updateLanguage).toHaveBeenCalledWithExactlyOnceWith('zh-TW')
    })

    it('should get system locale', async () => {
      mockElectronAPI.getSystemLocale.mockResolvedValue('en-US')
      const { getSystemLocale } = useElectron()

      const result = await getSystemLocale()

      expect(result).toBe('en-US')
    })

    it('should reset user data', async () => {
      const { resetUserData } = useElectron()

      await resetUserData()

      expect(mockElectronAPI.resetUserData).toHaveBeenCalled()
    })

    it('should get hardware acceleration setting', async () => {
      mockElectronAPI.getHardwareAcceleration.mockResolvedValue(true)
      const { getHardwareAcceleration } = useElectron()

      const result = await getHardwareAcceleration()

      expect(result).toBe(true)
    })

    it('should set hardware acceleration', async () => {
      mockElectronAPI.setHardwareAcceleration.mockResolvedValue(true)
      const { setHardwareAcceleration } = useElectron()

      const result = await setHardwareAcceleration(false)

      expect(result).toBe(true)
      expect(mockElectronAPI.setHardwareAcceleration).toHaveBeenCalledWithExactlyOnceWith(false)
    })

    it('should get video quality setting', async () => {
      mockElectronAPI.getVideoQuality.mockResolvedValue('high')
      const { getVideoQuality } = useElectron()

      const result = await getVideoQuality()

      expect(result).toBe('high')
    })

    it('should set video quality', async () => {
      mockElectronAPI.setVideoQuality.mockResolvedValue(true)
      const { setVideoQuality } = useElectron()

      const result = await setVideoQuality('medium')

      expect(result).toBe(true)
      expect(mockElectronAPI.setVideoQuality).toHaveBeenCalledWithExactlyOnceWith('medium')
    })

    it('should restart app', async () => {
      const { restartApp } = useElectron()

      await restartApp()

      expect(mockElectronAPI.restartApp).toHaveBeenCalled()
    })
  })

  describe('FFmpeg settings', () => {
    it('should get enable ffmpeg setting', async () => {
      mockElectronAPI.getEnableFfmpeg.mockResolvedValue(true)
      const { getEnableFfmpeg } = useElectron()

      const result = await getEnableFfmpeg()

      expect(result).toBe(true)
    })

    it('should set enable ffmpeg', async () => {
      mockElectronAPI.setEnableFfmpeg.mockResolvedValue(true)
      const { setEnableFfmpeg } = useElectron()

      const result = await setEnableFfmpeg(true)

      expect(result).toBe(true)
      expect(mockElectronAPI.setEnableFfmpeg).toHaveBeenCalledWithExactlyOnceWith(true)
    })

    it('should check ffmpeg status', async () => {
      const mockStatus = { available: true, path: '/usr/bin/ffmpeg', version: '4.4.0', error: '' }
      mockElectronAPI.ffmpegCheckStatus.mockResolvedValue(mockStatus)
      const { ffmpegCheckStatus } = useElectron()

      const result = await ffmpegCheckStatus()

      expect(result).toEqual(mockStatus)
    })

    it('should set ffmpeg path', async () => {
      const mockStatus = { available: true, path: '/custom/ffmpeg', version: '5.0.0', error: '' }
      mockElectronAPI.ffmpegSetPath.mockResolvedValue(mockStatus)
      const { ffmpegSetPath } = useElectron()

      const result = await ffmpegSetPath('/custom/ffmpeg')

      expect(result).toEqual(mockStatus)
      expect(mockElectronAPI.ffmpegSetPath).toHaveBeenCalledWithExactlyOnceWith('/custom/ffmpeg')
    })
  })

  describe('Bible API', () => {
    it('should get Bible versions', async () => {
      const mockVersions = [
        { id: 1, name: 'NIV', language: 'en' },
        { id: 2, name: 'CUNP', language: 'zh' },
      ]
      mockElectronAPI.getBibleVersions.mockResolvedValue(mockVersions)
      const { getBibleVersions } = useElectron()

      const result = await getBibleVersions()

      expect(result).toEqual(mockVersions)
    })

    it('should get Bible content', async () => {
      const { getBibleContent } = useElectron()

      await getBibleContent(1)

      expect(mockElectronAPI.getBibleContent).toHaveBeenCalledWithExactlyOnceWith(1)
    })

    it('should register Bible content chunk listener', () => {
      const callback = vi.fn()
      const { onBibleContentChunk } = useElectron()

      onBibleContentChunk(callback)

      expect(mockElectronAPI.onBibleContentChunk).toHaveBeenCalledWithExactlyOnceWith(callback)
    })
  })

  describe('Updater', () => {
    it('should register update available listener', () => {
      const callback = vi.fn()
      const { onUpdateAvailable } = useElectron()

      onUpdateAvailable(callback)

      expect(mockElectronAPI.onUpdateAvailable).toHaveBeenCalledWithExactlyOnceWith(callback)
    })

    it('should register update downloaded listener', () => {
      const callback = vi.fn()
      const { onUpdateDownloaded } = useElectron()

      onUpdateDownloaded(callback)

      expect(mockElectronAPI.onUpdateDownloaded).toHaveBeenCalledWithExactlyOnceWith(callback)
    })

    it('should register update error listener', () => {
      const callback = vi.fn()
      const { onUpdateError } = useElectron()

      onUpdateError(callback)

      expect(mockElectronAPI.onUpdateError).toHaveBeenCalledWithExactlyOnceWith(callback)
    })
  })

  describe('Timer IPC', () => {
    it('should send timer command', () => {
      const { timerCommand } = useElectron()
      const command: TimerCommand = { action: 'start' }

      timerCommand(command)

      expect(mockElectronAPI.timerCommand).toHaveBeenCalledWithExactlyOnceWith(command)
    })

    it('should register timer tick listener', () => {
      const callback = vi.fn()
      const { onTimerTick } = useElectron()

      onTimerTick(callback)

      expect(mockElectronAPI.onTimerTick).toHaveBeenCalledWithExactlyOnceWith(callback)
    })

    it('should initialize timer', async () => {
      const settings: Partial<TimerState> = { mode: TimerMode.TIMER, timerDuration: 300 }
      const { timerInitialize } = useElectron()

      await timerInitialize(settings)

      expect(mockElectronAPI.timerInitialize).toHaveBeenCalledWithExactlyOnceWith(settings)
    })

    it('should get timer state', async () => {
      const mockState: TimerState = {
        mode: TimerMode.TIMER,
        state: 'stopped',
        timerDuration: 300,
        originalDuration: 300,
        remainingTime: 150,
        timezone: 'UTC',
        stopwatchElapsedTime: 0,
        overtimeMessageEnabled: false,
        overtimeMessage: '',
        reminderEnabled: false,
        reminderTime: 0,
      }
      mockElectronAPI.timerGetState.mockResolvedValue(mockState)
      const { timerGetState } = useElectron()

      const result = await timerGetState()

      expect(result).toEqual(mockState)
    })

    it('should return null when getting timer state fails', async () => {
      mockElectronAPI.timerGetState.mockRejectedValue(new Error('Failed'))
      const { timerGetState } = useElectron()

      const result = await timerGetState()

      expect(result).toBeNull()
    })
  })

  describe('Error handling', () => {
    it('should handle sendToProjection errors gracefully', () => {
      mockElectronAPI.sendToProjection.mockImplementation(() => {
        throw new Error('IPC error')
      })
      const { sendToProjection } = useElectron()

      expect(() =>
        sendToProjection({ type: MessageType.VIEW_CHANGE, data: { view: ViewType.TIMER } }),
      ).not.toThrow()
    })

    it('should return default values on errors', async () => {
      mockElectronAPI.getVideoQuality.mockRejectedValue(new Error('Failed'))
      const { getVideoQuality } = useElectron()

      const result = await getVideoQuality()

      expect(result).toBe('high') // default value
    })
  })
})
