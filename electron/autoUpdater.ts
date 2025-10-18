import { BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as Sentry from '@sentry/electron'

// Track update download status
let updateDownloaded = false
let updateInfo: Record<string, unknown> | null = null
let updateCheckInterval: NodeJS.Timeout | null = null

/**
 * Initialize autoUpdater functionality
 *
 * Behavior:
 * 1. Automatically check for updates after 1 second of application startup
 * 2. Check for updates every 5 minutes automatically
 * 3. Automatically start downloading updates when updates are available
 * 4. Silent wait after download completion, do not disturb user
 * 5. User closes the main window to display the install confirmation dialog
 *
 * @param mainWindow Main window instance
 */
export const initAutoUpdater = (mainWindow: BrowserWindow | null) => {
  if (!mainWindow) return

  // Automatically check for updates after 1 second of application startup
  setTimeout(() => {
    autoUpdater.checkForUpdates()
  }, 1000)

  // Set up periodic update checks every 5 minutes
  startPeriodicUpdateCheck()

  // Setup event listeners
  setupAutoUpdaterListeners(mainWindow)
}

/**
 * Setup autoUpdater event listeners
 * Handle each stage of the update and notify the main window
 */
const setupAutoUpdaterListeners = (mainWindow: BrowserWindow | null) => {
  // Update Available
  autoUpdater.on('update-available', (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', info)
    }
  })

  // Download Progress Update
  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-progress', progressObj)
    }
  })

  // Download Completed
  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true
    updateInfo = info as unknown as Record<string, unknown>

    stopPeriodicUpdateCheck()

    // send update-downloaded event to frontend
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', info)
    }
  })

  // Update Error
  autoUpdater.on('error', (error) => {
    Sentry.captureException(error, {
      tags: {
        operation: 'auto-updater',
      },
      extra: {
        context: 'Update error',
      },
    })
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', error.message)
    }
  })

  // No Updates Available
  autoUpdater.on('update-not-available', (info) => {
    console.log('No updates available, current version:' + info.version)
  })
}

/**
 * Check if there is an update downloaded
 * @returns If there is an update downloaded
 */
export const hasUpdateDownloaded = (): boolean => {
  return updateDownloaded
}

/**
 * Get the downloaded update information
 * @returns The downloaded update information object
 */
export const getUpdateInfo = () => {
  return updateInfo
}

/**
 * Execute update installation and exit the application
 * This method will close all windows and install the update
 */
export const installUpdate = () => {
  autoUpdater.quitAndInstall()
}

/**
 * Start downloading the update
 */
export const downloadUpdate = () => {
  return autoUpdater.downloadUpdate()
}

/**
 * Start periodic update checks every 5 minutes
 */
const startPeriodicUpdateCheck = () => {
  // Clear any existing interval
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval)
  }

  // Set up new interval for 5 minutes (300,000 milliseconds)
  updateCheckInterval = setInterval(
    () => {
      autoUpdater.checkForUpdates()
    },
    5 * 60 * 1000,
  ) // 5 minutes
}

/**
 * Stop periodic update checks
 */
export const stopPeriodicUpdateCheck = () => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval)
    updateCheckInterval = null
  }
}
