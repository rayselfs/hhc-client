import type { AppMessage, DisplayInfo, TimerMode } from './common'
import type { BibleVersion } from './bible'

// AutoUpdater 相關類型定義
export interface UpdateInfo {
  version: string
  releaseDate: string
}

export interface DownloadProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
  eta: number
}

export interface UpdateResult {
  success: boolean
  error?: string
}

/**
 * Electron API interface definition
 */
export interface ElectronAPI {
  /** Get display information */
  getDisplays: () => Promise<DisplayInfo[]>

  // File System
  saveFile: (filePath: string) => Promise<{ filePath: string; thumbnailData?: Uint8Array }>
  deleteFile: (filePath: string) => Promise<boolean>
  copyFile: (filePath: string) => Promise<{ filePath: string; thumbnailData?: Uint8Array } | null>
  listDirectory: (dirPath: string) => Promise<
    Array<{
      name: string
      isDirectory: boolean
      path: string
      size: number
      modifiedAt: number
      thumbnailData?: Uint8Array
    }>
  >
  resetUserData: () => Promise<boolean>
  getFilePath: (file: File) => string

  // Bible API
  getBibleVersions: () => Promise<BibleVersion[]>
  getBibleContent: (versionId: number) => Promise<{ success: boolean }>
  onBibleContentChunk: (callback: (chunk: Uint8Array) => void) => void

  /** Check if projection window exists */
  checkProjectionWindow: () => Promise<boolean>

  /** Ensure projection window exists, create if it doesn't exist */
  ensureProjectionWindow: () => Promise<boolean>

  /** Close projection window */
  closeProjectionWindow: () => Promise<boolean>

  /** Send message to projection window */
  sendToProjection: (data: AppMessage) => void

  /** Send message to main window */
  sendToMain: (data: AppMessage) => void

  /** Listen for messages from projection window */
  onProjectionMessage: (callback: (data: AppMessage) => void) => void

  /** Listen for messages from main window */
  onMainMessage: (callback: (data: AppMessage) => void) => void

  /** Listen for get current state requests */
  onGetCurrentState: (callback: () => void) => void

  /** Listen for projection window opened events */
  onProjectionOpened: (callback: () => void) => void

  /** Listen for projection window closed events */
  onProjectionClosed: (callback: () => void) => void

  /** Listen for no second screen detected events */
  onNoSecondScreenDetected: (callback: () => void) => void

  /** Remove all listeners for specified channel */
  removeAllListeners: (channel: string) => void

  // AutoUpdater 相關方法
  /** Start downloading update */
  startDownload: () => Promise<UpdateResult>

  /** Install the downloaded update */
  installUpdate: () => Promise<UpdateResult>

  /** Listen for update available events */
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => void

  /** Listen for download progress events */
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void

  /** Listen for update downloaded events (for notification purposes) */
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => void

  /** Listen for update error events */
  onUpdateError: (callback: (error: string) => void) => void

  /** Get system locale */
  getSystemLocale: () => Promise<string>

  /** Update language setting */
  updateLanguage: (language: string) => Promise<UpdateResult>

  // Timer related
  /** Send timer command to main process */
  timerCommand: (command: TimerCommand) => void

  /** Get current timer state */
  timerGetState: () => Promise<TimerState | null>

  /** Initialize timer state from saved settings */
  timerInitialize: (initialState: Partial<TimerState>) => Promise<{ success: boolean }>

  /** Listen for timer state updates */
  onTimerTick: (callback: (state: Partial<TimerState>) => void) => void
}

/**
 * Timer command interface
 */
export interface TimerCommand {
  action:
    | 'start'
    | 'pause'
    | 'reset'
    | 'resume'
    | 'setDuration'
    | 'addTime'
    | 'removeTime'
    | 'setMode'
    | 'setTimezone'
    | 'startStopwatch'
    | 'pauseStopwatch'
    | 'resetStopwatch'
    | 'setReminder'
    | 'setOvertimeMessage'
  duration?: number
  seconds?: number
  reminderEnabled?: boolean
  reminderTime?: number
  overtimeMessageEnabled?: boolean
  overtimeMessage?: string
  mode?: TimerMode
  timezone?: string
}

/**
 * Timer state interface
 */
export interface TimerState {
  mode: TimerMode
  state: 'stopped' | 'running' | 'paused'
  remainingTime: number
  timerDuration: number
  originalDuration: number
  startTime?: string // ISO string format
  currentTime?: string // ISO string format
  timezone: string
  stopwatchState?: 'stopped' | 'running' | 'paused'
  stopwatchElapsedTime: number // milliseconds
  stopwatchStartTime?: number // for precise calculation
  reminderEnabled: boolean
  reminderTime: number // seconds (threshold for warning)
  overtimeMessageEnabled: boolean
  overtimeMessage: string
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
