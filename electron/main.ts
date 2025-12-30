import { app, BrowserWindow, protocol } from 'electron'
import { createApplicationMenu } from './menu'
import {
  initAutoUpdater,
  stopPeriodicUpdateCheck,
  registerAutoUpdaterHandlers,
} from './autoUpdater'
import * as Sentry from '@sentry/electron'
import { TimerService } from './timerService'
import { registerApiHandlers } from './api'
import { WindowManager } from './windowManager'
import { registerGenericHandlers } from './handlers'
import { registerFileHandlers, registerFileProtocols } from './file'

// Initialize Sentry
const sentryDsn = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN
Sentry.init({
  dsn: sentryDsn,
  beforeSend(event) {
    // Only send errors in production or when explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.VITE_SENTRY_ENABLED) {
      return null
    }
    return event
  },
})

// Initialize Managers and Services
const windowManager = WindowManager.getInstance()
const timerService = new TimerService()

// Link TimerService with WindowManager
windowManager.setTimerService(timerService)

// Register all IPC handlers
registerApiHandlers()
registerGenericHandlers(windowManager)
registerFileHandlers()
timerService.registerIpcHandlers()
registerAutoUpdaterHandlers()

// Register privileged schemes
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-resource',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    },
  },
])

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // Another instance is already running, focus it and quit
  app.quit()
} else {
  // This is the first instance, handle second instance
  app.on('second-instance', () => {
    // Someone tried to run a second instance, focus our window instead
    if (windowManager.mainWindow) {
      if (windowManager.mainWindow.isMinimized()) {
        windowManager.mainWindow.restore()
      }
      windowManager.mainWindow.focus()
    }
  })

  // Application events
  app.whenReady().then(() => {
    // Register file protocols
    registerFileProtocols()

    // Set security policy
    app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor')

    windowManager.createMainWindow()

    // Setup menu (needs mainWindow reference)
    if (windowManager.mainWindow) {
      createApplicationMenu(windowManager.mainWindow)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createMainWindow()
      }
    })

    // Initialize autoUpdater (async)
    // Needs mainWindow for sending events
    initAutoUpdater(windowManager.mainWindow).catch((error) => {
      console.error('Failed to initialize autoUpdater:', error)
      Sentry.captureException(error, {
        tags: {
          operation: 'init-auto-updater',
        },
      })
    })
  })
}

// All windows closed event
app.on('window-all-closed', () => {
  app.quit()
})

// Application will quit event
app.on('before-quit', () => {
  // Stop periodic update checks
  stopPeriodicUpdateCheck()

  // Cleanup timer service
  timerService.cleanup()

  // WindowManager cleanups if any
  if (windowManager.projectionWindow && !windowManager.projectionWindow.isDestroyed()) {
    windowManager.projectionWindow.destroy()
    windowManager.projectionWindow = null
  }

  if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
    windowManager.mainWindow.destroy()
    windowManager.mainWindow = null
  }
})
