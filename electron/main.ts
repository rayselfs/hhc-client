import { app, BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null
let projectionWindow: BrowserWindow | null = null

// Create main window
const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: join(__dirname, 'preload.mjs'),
    },
    title: '主控台',
  })

  const isDev = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development'

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, 'renderer/index.html'))
  }

  // Handle window close event - check for updates before quitting
  mainWindow.on('close', async (event) => {
    event.preventDefault()

    // Close projection window
    if (projectionWindow && !projectionWindow.isDestroyed()) {
      projectionWindow.close()
      projectionWindow = null
    }
    // Force quit
    app.exit(0)
  })

  mainWindow.on('closed', () => {
    // Close projection window when main window is closed
    if (projectionWindow && !projectionWindow.isDestroyed()) {
      projectionWindow.close()
      projectionWindow = null
    }
    mainWindow = null

    // Exit application when main window is closed on all platforms
    app.quit()
  })
}

const createProjectionWindow = () => {
  // Get all displays
  const displays = screen.getAllDisplays()
  const externalDisplay = displays.find(
    (display) => display.bounds.x !== 0 || display.bounds.y !== 0,
  )

  // Check if there is a second screen
  const hasSecondScreen = externalDisplay !== undefined
  const targetDisplay = externalDisplay || displays[0]

  // Create projection window
  projectionWindow = new BrowserWindow({
    width: targetDisplay.bounds.width,
    height: targetDisplay.bounds.height,
    x: targetDisplay.bounds.x,
    y: targetDisplay.bounds.y,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    webPreferences: {
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: join(__dirname, 'preload.mjs'),
    },
    title: '投影',
  })

  // If there is no second screen, notify the main window to display a prompt
  if (!hasSecondScreen && mainWindow) {
    mainWindow.webContents.send('no-second-screen-detected')
  }

  const isDev = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development'

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    projectionWindow.loadURL(devUrl + '#/projection')
  } else {
    projectionWindow.loadFile(join(__dirname, 'renderer/index.html'), {
      hash: '#/projection',
    })
  }

  // Clean up when the window is closed
  projectionWindow.on('closed', () => {
    // Notify the main window that the projection has been closed
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
})

app.on('window-all-closed', () => {
  // Ensure all windows are closed, including the projection window
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.close()
    projectionWindow = null
  }

  // Exit the application on all platforms
  app.quit()
})

// Clean up before the application quits
app.on('before-quit', () => {
  // Force close all windows
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.destroy()
    projectionWindow = null
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
    mainWindow = null
  }
})
