import { vi } from 'vitest'
import type { ElectronAPI } from '@/types/electron'

// Mock window.electronAPI globally for all tests
global.window = global.window || ({} as Window & typeof globalThis)

// Create a comprehensive mock of the ElectronAPI interface
;(global.window as { electronAPI: ElectronAPI }).electronAPI = {
  // Display
  getDisplays: vi.fn(),

  // File System
  saveFile: vi.fn(),
  deleteFile: vi.fn(),
  copyFile: vi.fn(),
  listDirectory: vi.fn(),
  resetUserData: vi.fn(),
  getFilePath: vi.fn(),

  // Bible API
  getBibleVersions: vi.fn(),
  getBibleContent: vi.fn(),
  onBibleContentChunk: vi.fn(),

  // Projection Window
  checkProjectionWindow: vi.fn(),
  ensureProjectionWindow: vi.fn(),
  closeProjectionWindow: vi.fn(),
  sendToProjection: vi.fn(),
  sendToMain: vi.fn(),
  onProjectionMessage: vi.fn(),
  onMainMessage: vi.fn(),
  onGetCurrentState: vi.fn(),
  onProjectionOpened: vi.fn(),
  onProjectionClosed: vi.fn(),
  onNoSecondScreenDetected: vi.fn(),
  removeAllListeners: vi.fn(),

  // AutoUpdater
  startDownload: vi.fn(),
  installUpdate: vi.fn(),
  onUpdateAvailable: vi.fn(),
  onDownloadProgress: vi.fn(),
  onUpdateDownloaded: vi.fn(),
  onUpdateError: vi.fn(),

  // Localization
  getSystemLocale: vi.fn(),
  updateLanguage: vi.fn(),

  // Timer
  timerCommand: vi.fn(),
  timerGetState: vi.fn(),
  timerInitialize: vi.fn(),
  onTimerTick: vi.fn(),

  // Hardware Acceleration
  getHardwareAcceleration: vi.fn(),
  setHardwareAcceleration: vi.fn(),
  restartApp: vi.fn(),

  // Video
  probeVideo: vi.fn(),
  getVideoQuality: vi.fn(),
  setVideoQuality: vi.fn(),

  // FFmpeg
  getEnableFfmpeg: vi.fn(),
  setEnableFfmpeg: vi.fn(),
  ffmpegCheckStatus: vi.fn(),
  ffmpegSetPath: vi.fn(),
}
