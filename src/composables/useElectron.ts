import type { AppMessage } from '@/types/projection'
import type { BibleVersion } from '@/types/bible'
import type { VideoQuality, FFmpegStatus } from '@/types/electron'
import { useSentry } from './useSentry'
import { useTimerIPC } from './useTimerIPC'
import { useElectronFiles } from './useElectronFiles'

export const useElectron = () => {
  const { reportError } = useSentry()

  const isElectron = (): boolean => {
    return typeof window !== 'undefined' && !!window.electronAPI
  }

  const withErrorHandling = async <T>(
    operation: string,
    fn: () => Promise<T>,
    fallback: T,
    extra?: Record<string, unknown>,
  ): Promise<T> => {
    if (!isElectron()) return fallback
    try {
      return await fn()
    } catch (error) {
      reportError(error, { operation, component: 'useElectron', extra })
      return fallback
    }
  }

  const sendToProjection = (data: AppMessage): void => {
    if (isElectron()) {
      try {
        window.electronAPI.sendToProjection(data)
      } catch (error) {
        reportError(error, { operation: 'send-to-projection', component: 'useElectron' })
      }
    }
  }

  const sendToMain = (data: AppMessage): void => {
    if (isElectron()) window.electronAPI.sendToMain(data)
  }

  const checkProjectionWindow = (): Promise<boolean> =>
    withErrorHandling(
      'check-projection-window',
      () => window.electronAPI.checkProjectionWindow(),
      false,
    )

  const ensureProjectionWindow = (): Promise<boolean> =>
    withErrorHandling(
      'ensure-projection-window',
      () => window.electronAPI.ensureProjectionWindow(),
      false,
    )

  const getDisplays = (): Promise<unknown[]> =>
    withErrorHandling('get-displays', () => window.electronAPI.getDisplays(), [])

  const onMainMessage = (callback: (data: AppMessage) => void): void => {
    if (isElectron()) window.electronAPI.onMainMessage(callback)
  }

  const onProjectionMessage = (callback: (data: AppMessage) => void): void => {
    if (isElectron()) window.electronAPI.onProjectionMessage(callback)
  }

  const onGetCurrentState = (callback: () => void): void => {
    if (isElectron()) window.electronAPI.onGetCurrentState(callback)
  }

  const onProjectionOpened = (callback: () => void): void => {
    if (isElectron()) window.electronAPI.onProjectionOpened(callback)
  }

  const onProjectionClosed = (callback: () => void): void => {
    if (isElectron()) window.electronAPI.onProjectionClosed(callback)
  }

  const onNoSecondScreenDetected = (callback: () => void): void => {
    if (isElectron()) window.electronAPI.onNoSecondScreenDetected(callback)
  }

  const removeAllListeners = (channel: string): void => {
    if (isElectron()) window.electronAPI.removeAllListeners(channel)
  }

  const closeProjectionWindow = async (): Promise<void> => {
    await withErrorHandling(
      'close-projection-window',
      () => window.electronAPI.closeProjectionWindow(),
      false,
    )
  }

  const updateLanguage = async (locale: string): Promise<void> => {
    await withErrorHandling(
      'update-language',
      () => window.electronAPI.updateLanguage(locale),
      { success: false },
      { locale },
    )
  }

  const getSystemLocale = (): Promise<string | undefined> =>
    withErrorHandling('get-system-locale', () => window.electronAPI.getSystemLocale(), undefined)

  const resetUserData = async (): Promise<void> => {
    if (!isElectron()) return
    try {
      await window.electronAPI.resetUserData()
    } catch (error) {
      reportError(error, { operation: 'reset-user-data', component: 'useElectron' })
      throw error
    }
  }

  const getHardwareAcceleration = (): Promise<boolean> =>
    withErrorHandling(
      'get-hardware-acceleration',
      () => window.electronAPI.getHardwareAcceleration(),
      true,
    )

  const setHardwareAcceleration = (enabled: boolean): Promise<boolean> =>
    withErrorHandling(
      'set-hardware-acceleration',
      () => window.electronAPI.setHardwareAcceleration(enabled),
      false,
      { enabled },
    )

  const getVideoQuality = (): Promise<VideoQuality> =>
    withErrorHandling('get-video-quality', () => window.electronAPI.getVideoQuality(), 'high')

  const setVideoQuality = (quality: VideoQuality): Promise<boolean> =>
    withErrorHandling(
      'set-video-quality',
      () => window.electronAPI.setVideoQuality(quality),
      false,
      { quality },
    )

  const getEnableFfmpeg = (): Promise<boolean> =>
    withErrorHandling('get-enable-ffmpeg', () => window.electronAPI.getEnableFfmpeg(), false)

  const setEnableFfmpeg = (enabled: boolean): Promise<boolean> =>
    withErrorHandling(
      'set-enable-ffmpeg',
      () => window.electronAPI.setEnableFfmpeg(enabled),
      false,
      { enabled },
    )

  const ffmpegCheckStatus = (): Promise<FFmpegStatus> =>
    withErrorHandling('ffmpeg-check-status', () => window.electronAPI.ffmpegCheckStatus(), {
      available: false,
      path: '',
      version: '',
      error: isElectron() ? 'Check failed' : 'Not in Electron',
    })

  const ffmpegSetPath = (customPath: string): Promise<FFmpegStatus> =>
    withErrorHandling(
      'ffmpeg-set-path',
      () => window.electronAPI.ffmpegSetPath(customPath),
      {
        available: false,
        path: '',
        version: '',
        error: isElectron() ? 'Set path failed' : 'Not in Electron',
      },
      { customPath },
    )

  const restartApp = async (): Promise<void> => {
    await withErrorHandling('restart-app', () => window.electronAPI.restartApp(), undefined)
  }

  const getBibleVersions = async (): Promise<BibleVersion[]> => {
    if (!isElectron()) return []
    try {
      return await window.electronAPI.getBibleVersions()
    } catch (error) {
      reportError(error, { operation: 'get-bible-versions', component: 'useElectron' })
      throw error
    }
  }

  const getBibleContent = async (versionId: number): Promise<void> => {
    if (!isElectron()) return
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

  const onBibleContentChunk = (callback: (chunk: Uint8Array) => void): void => {
    if (isElectron()) window.electronAPI.onBibleContentChunk(callback)
  }

  const onUpdateAvailable = (callback: () => void): void => {
    if (isElectron()) window.electronAPI.onUpdateAvailable(callback)
  }

  const onUpdateDownloaded = (callback: () => void): void => {
    if (isElectron()) window.electronAPI.onUpdateDownloaded(callback)
  }

  const onUpdateError = (callback: (error: string) => void): void => {
    if (isElectron()) window.electronAPI.onUpdateError(callback)
  }

  const timerIPC = useTimerIPC()
  const electronFiles = useElectronFiles()

  return {
    isElectron,
    sendToProjection,
    sendToMain,
    checkProjectionWindow,
    ensureProjectionWindow,
    closeProjectionWindow,
    getDisplays,
    updateLanguage,
    getSystemLocale,
    resetUserData,
    getHardwareAcceleration,
    setHardwareAcceleration,
    getVideoQuality,
    setVideoQuality,
    getEnableFfmpeg,
    setEnableFfmpeg,
    ffmpegCheckStatus,
    ffmpegSetPath,
    restartApp,
    getBibleVersions,
    getBibleContent,
    onBibleContentChunk,
    onUpdateAvailable,
    onUpdateDownloaded,
    onUpdateError,
    onMainMessage,
    onProjectionMessage,
    onGetCurrentState,
    onProjectionOpened,
    onProjectionClosed,
    onNoSecondScreenDetected,
    removeAllListeners,
    getFilePath: electronFiles.getFilePath,
    saveFile: electronFiles.saveFile,
    timerCommand: timerIPC.timerCommand,
    onTimerTick: timerIPC.onTimerTick,
    timerInitialize: timerIPC.timerInitialize,
    timerGetState: timerIPC.timerGetState,
  }
}

export { useProjectionElectron } from './useProjectionElectron'
export { useTimerIPC } from './useTimerIPC'
export { useElectronFiles } from './useElectronFiles'
