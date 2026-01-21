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
  saveFile: (filePath: string) => Promise<{
    filePath: string
    thumbnailData?: Uint8Array
    videoMetadata?: { duration: number; mimeType: string }
  }>
  deleteFile: (filePath: string) => Promise<boolean>
  copyFile: (filePath: string) => Promise<{ filePath: string; thumbnailData?: Uint8Array } | null>
  listDirectory: (dirPath: string) => Promise<
    Array<{
      name: string
      isDirectory: boolean
      path: string
      size: number
      modifiedAt: number
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

  // Hardware acceleration settings
  /** Get hardware acceleration setting */
  getHardwareAcceleration: () => Promise<boolean>

  /** Set hardware acceleration setting */
  setHardwareAcceleration: (enabled: boolean) => Promise<boolean>

  /** Restart the application */
  restartApp: () => Promise<void>

  // Video probe
  /** Probe video file for transcoding information */
  probeVideo: (filePath: string) => Promise<VideoInfo | null>

  // Video quality settings
  /** Get current video quality setting */
  getVideoQuality: () => Promise<VideoQuality>

  /** Set video quality setting */
  setVideoQuality: (quality: VideoQuality) => Promise<boolean>

  // FFmpeg settings
  /** Get whether FFmpeg support is enabled */
  getEnableFfmpeg: () => Promise<boolean>

  /** Set whether FFmpeg support is enabled */
  setEnableFfmpeg: (enabled: boolean) => Promise<boolean>

  /** Check FFmpeg availability and get status */
  ffmpegCheckStatus: () => Promise<FFmpegStatus>

  /** Set custom FFmpeg path */
  ffmpegSetPath: (path: string) => Promise<FFmpegStatus>
}

/**
 * Video quality setting for transcoding
 * - 'high': Use original bitrate (100%)
 * - 'medium': Use 70% of original bitrate
 * - 'low': Use 40% of original bitrate
 */
export type VideoQuality = 'low' | 'medium' | 'high'

export interface FFmpegStatus {
  available: boolean
  path: string
  version: string
  error?: string
}

/**
 * Video info from ffprobe
 */
export interface VideoInfo {
  codec: string // 'h264', 'hevc', 'vp9', etc.
  audioCodec: string // 'aac', 'ac3', 'dts', etc.
  width: number
  height: number
  duration: number
  bitrate: number
  needsTranscode: boolean
  needsAudioTranscode: boolean
  canRemux: boolean // H.264 + supported audio can be directly remuxed
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
