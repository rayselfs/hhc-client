import type { AppMessage, DisplayInfo } from './common'

/**
 * Electron API interface definition
 */
export interface ElectronAPI {
  /** Get display information */
  getDisplays: () => Promise<DisplayInfo[]>

  /** Check if projection window exists */
  checkProjectionWindow: () => Promise<boolean>

  /** Ensure projection window exists, create if it doesn't exist */
  ensureProjectionWindow: () => Promise<boolean>

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
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
