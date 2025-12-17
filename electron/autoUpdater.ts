import { BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import * as Sentry from '@sentry/electron'

// Track update download status
let updateDownloaded = false
let updateInfo: Record<string, unknown> | null = null
let updateCheckInterval: NodeJS.Timeout | null = null
let isChinaRegion = false

// GitHub and Gitee repository configuration
const GITHUB_OWNER = 'rayselfs'
const GITHUB_REPO = 'hhc-client'
const GITEE_OWNER = 'rayselfs' // Replace with your Gitee username
const GITEE_REPO = 'hhc-client' // Replace with your Gitee repo name

/**
 * Detect if user is in China region
 * Uses timezone and IP geolocation methods
 */
const detectChinaRegion = async (): Promise<boolean> => {
  try {
    // Method 1: Check timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (
      timezone.includes('Shanghai') ||
      timezone.includes('Beijing') ||
      timezone.includes('Chongqing')
    ) {
      return true
    }

    // Method 2: Try to detect via IP geolocation
    try {
      const response = await fetch('https://ipapi.co/json/', {
        signal: AbortSignal.timeout(3000), // 3 second timeout
      })
      if (response.ok) {
        const data = await response.json()
        if (data.country_code === 'CN') {
          return true
        }
      }
    } catch {
      // Ignore geolocation errors, fallback to timezone only
      console.log('IP geolocation check failed, using timezone only')
    }

    return false
  } catch (error) {
    console.error('Error detecting region:', error)
    // Default to non-China region if detection fails
    return false
  }
}

/**
 * Configure autoUpdater based on region
 */
const configureAutoUpdater = async () => {
  isChinaRegion = await detectChinaRegion()

  if (isChinaRegion) {
    // Use Gitee for China region
    // Gitee doesn't have native electron-updater support, so we use generic provider
    // The latest-*.yml files need to be accessible via direct URL
    // We'll use Gitee's raw file URL pointing to the latest release files

    // For Gitee, we use generic provider with a custom update URL
    // Gitee Releases download URL format: https://gitee.com/{owner}/{repo}/releases/download/{tag}/{filename}
    // Since electron-updater needs latest-*.yml files, we need to ensure they're accessible
    // The workflow will upload these files to Gitee Releases

    // Note: Gitee doesn't have a "latest" redirect like GitHub
    // We'll use the latest release tag URL pattern
    // The actual URL will be resolved by checking the latest release tag
    const baseUrl = `https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/releases/download/`

    autoUpdater.setFeedURL({
      provider: 'generic',
      url: baseUrl,
      channel: 'latest',
    })
    console.log(`AutoUpdater configured for Gitee (China region) - Base URL: ${baseUrl}`)
  } else {
    // Use GitHub for non-China region
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
    })
    console.log('AutoUpdater configured for GitHub (non-China region)')
  }
}

/**
 * Initialize autoUpdater functionality
 *
 * Behavior:
 * 1. Detect region and configure update source (Gitee for China, GitHub for others)
 * 2. Automatically check for updates after 2 seconds of application startup
 * 3. Check for updates every 5 minutes automatically
 * 4. Automatically start downloading updates when updates are available
 * 5. Silent wait after download completion, do not disturb user
 * 6. User closes the main window to display the install confirmation dialog
 *
 * @param mainWindow Main window instance
 */
export const initAutoUpdater = async (mainWindow: BrowserWindow | null) => {
  if (!mainWindow) return

  // Configure autoUpdater based on region
  await configureAutoUpdater()

  // Automatically check for updates after 2 seconds of application startup
  setTimeout(() => {
    autoUpdater.checkForUpdates()
  }, 2000)

  // Set up periodic update checks every 5 minutes
  startPeriodicUpdateCheck()

  // Setup event listeners
  setupAutoUpdaterListeners(mainWindow)
}

/**
 * Get current update source (for debugging/logging)
 */
export const getUpdateSource = (): 'gitee' | 'github' => {
  return isChinaRegion ? 'gitee' : 'github'
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

/**
 * Register IPC handlers for autoUpdater
 */
export const registerAutoUpdaterHandlers = () => {
  ipcMain.handle('start-download', async () => {
    try {
      downloadUpdate()
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('開始下載更新失敗:', error)
      Sentry.captureException(error, {
        tags: {
          operation: 'download-update',
        },
        extra: {
          context: 'Failed to start download update',
        },
      })
      return { success: false, error: errorMessage }
    }
  })

  ipcMain.handle('install-update', async () => {
    try {
      installUpdate()
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to install update:', error)
      Sentry.captureException(error, {
        tags: {
          operation: 'install-update',
        },
        extra: {
          context: 'Failed to install update',
        },
      })
      return { success: false, error: errorMessage }
    }
  })
}
