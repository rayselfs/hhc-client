import { app, BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { writeFileSync } from 'fs'
import { createApplicationMenu } from './menu'
import {
  initAutoUpdater,
  hasUpdateDownloaded,
  getUpdateInfo,
  installUpdate,
  downloadUpdate,
} from './autoUpdater'
import * as Sentry from '@sentry/electron'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

let mainWindow: BrowserWindow | null = null
let projectionWindow: BrowserWindow | null = null

// Create main window
const createMainWindow = () => {
  const displays = screen.getAllDisplays()
  const externalDisplay = displays.find(
    (display) => display.bounds.x !== 0 || display.bounds.y !== 0,
  )
  const hasSecondScreen = externalDisplay !== undefined

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: join(__dirname, 'preload.mjs'),
      spellcheck: false,
    },
    title: 'Console',
  })

  const isDev = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development'

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, 'renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    if (process.platform === 'win32' && hasSecondScreen) {
      mainWindow.maximize()
    }

    if (process.platform === 'darwin' && hasSecondScreen) {
      mainWindow.setFullScreen(true)
    }

    mainWindow.show()
  })

  mainWindow.on('close', async (event) => {
    // Prevent the window from closing immediately, first check for updates
    event.preventDefault()

    // Check if there is an update downloaded
    if (hasUpdateDownloaded()) {
      const updateInfo = getUpdateInfo()
      mainWindow?.webContents.send('update-ready-to-install', updateInfo)
    } else {
      app.quit()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Set the application menu
  createApplicationMenu(mainWindow)
}

const createProjectionWindow = () => {
  const displays = screen.getAllDisplays()
  const externalDisplay = displays.find(
    (display) => display.bounds.x !== 0 || display.bounds.y !== 0,
  )
  const hasSecondScreen = externalDisplay !== undefined
  const targetDisplay = externalDisplay || displays[0]

  // Create projection window
  projectionWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    fullscreen: hasSecondScreen, // Only fullscreen if there's a second screen
    frame: !hasSecondScreen,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: join(__dirname, 'preload.mjs'),
    },
    title: 'Projection',
  })

  // If there is no second screen, notify the main window to display a prompt
  if (!hasSecondScreen && mainWindow) {
    mainWindow.webContents.send('no-second-screen-detected')
  }

  const isDev = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development'

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    projectionWindow.loadURL(devUrl + '#/projection')
    projectionWindow.webContents.openDevTools()
  } else {
    projectionWindow.loadFile(join(__dirname, 'renderer/index.html'), {
      hash: '#/projection',
    })
  }

  // Projection window closed event
  projectionWindow.on('closed', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('projection-closed')
    }
    projectionWindow = null
  })

  // Listen for messages from the projection window
  projectionWindow.webContents.on('did-finish-load', () => {
    // Send the current state to the projection window
    if (mainWindow) {
      mainWindow.webContents.send('get-current-state')
    }

    // Notify the main window that the projection has been opened
    if (mainWindow) {
      mainWindow.webContents.send('projection-opened')
    }
  })
}

// IPC handlers
// Check if the projection window exists
ipcMain.handle('check-projection-window', async () => {
  return (
    projectionWindow !== null && projectionWindow !== undefined && !projectionWindow.isDestroyed()
  )
})

// Ensure the projection window exists
ipcMain.handle('ensure-projection-window', async () => {
  if (!projectionWindow || projectionWindow.isDestroyed()) {
    createProjectionWindow()
    return true
  }
  return false
})

// Close the projection window
ipcMain.handle('close-projection-window', async () => {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.close()
    projectionWindow = null
    return true
  }
  return false
})

ipcMain.handle('get-displays', async () => {
  try {
    const displays = screen.getAllDisplays()
    return displays.map((display) => ({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor,
      rotation: display.rotation,
      internal: display.internal,
    }))
  } catch (error) {
    console.error('Error getting display information:', error)
    Sentry.captureException(error, {
      tags: {
        operation: 'get-displays',
      },
      extra: {
        context: 'Error getting display information',
      },
    })
    return []
  }
})

// Forward messages to the projection window
ipcMain.on('send-to-projection', (event, data) => {
  if (projectionWindow) {
    projectionWindow.webContents.send('projection-message', data)
  }
})

// Forward messages to the main window
ipcMain.on('send-to-main', (event, data) => {
  if (mainWindow) {
    mainWindow.webContents.send('main-message', data)
  }
})

// AutoUpdater IPC handlers
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

// Force quit the application (user chooses to install later when closing)
ipcMain.handle('force-quit', async () => {
  try {
    app.quit()
    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to force quit:', error)
    Sentry.captureException(error, {
      tags: {
        operation: 'force-quit',
      },
      extra: {
        context: 'Failed to force quit',
      },
    })
    return { success: false, error: errorMessage }
  }
})

// Handle language change
ipcMain.handle('update-language', async (event, language: string) => {
  try {
    const userDataPath = app.getPath('userData')
    const settingsPath = path.join(userDataPath, 'language-settings.json')
    const settings = { language }
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

    // Re-create the menu
    createApplicationMenu(mainWindow)

    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to update language:', error)
    Sentry.captureException(error, {
      tags: {
        operation: 'update-language',
      },
      extra: {
        context: 'Failed to update language',
        language: language,
      },
    })
    return { success: false, error: errorMessage }
  }
})

// Application events
app.whenReady().then(() => {
  // Set security policy
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor')

  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })

  // Initialize autoUpdater
  initAutoUpdater(mainWindow)
})

// All windows closed event
app.on('window-all-closed', () => {
  app.quit()
})

// Application will quit event
app.on('before-quit', () => {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.destroy()
    projectionWindow = null
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
    mainWindow = null
  }
})
