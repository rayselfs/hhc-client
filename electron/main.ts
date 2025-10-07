import { app, BrowserWindow, screen, ipcMain } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { autoUpdater } from 'electron-updater'
import { readFileSync, writeFileSync, existsSync } from 'fs'

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

// AutoUpdater IPC handlers
ipcMain.handle('start-download', async () => {
  try {
    autoUpdater.downloadUpdate()
    return { success: true }
  } catch (error) {
    console.error('開始下載更新失敗:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('install-update', async () => {
  try {
    autoUpdater.quitAndInstall()
    return { success: true }
  } catch (error) {
    console.error('安裝更新失敗:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('decline-update', async () => {
  try {
    // 記錄拒絕時間到文件
    const updateSettingsPath = path.join(app.getPath('userData'), 'update-settings.json')
    const settings = {
      lastDeclinedTime: Date.now().toString(),
    }
    writeFileSync(updateSettingsPath, JSON.stringify(settings, null, 2))
    return { success: true }
  } catch (error) {
    console.error('記錄拒絕更新失敗:', error)
    return { success: false, error: error.message }
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

  setTimeout(() => {
    checkForUpdates()
  }, 1000)
})

// check for updates
const checkForUpdates = () => {
  const updateSettingsPath = path.join(app.getPath('userData'), 'update-settings.json')
  let lastDeclinedTime = null

  try {
    if (existsSync(updateSettingsPath)) {
      const settings = JSON.parse(readFileSync(updateSettingsPath, 'utf8'))
      lastDeclinedTime = settings.lastDeclinedTime
    }
  } catch (error) {
    console.error('讀取更新設定失敗:', error)
  }

  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000 // 兩週前

  if (!lastDeclinedTime || parseInt(lastDeclinedTime) < twoWeeksAgo) {
    autoUpdater.checkForUpdates()
  }
}

// 更新可用時，顯示下載對話框並開始下載
autoUpdater.on('update-available', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info)
  }
})

// 下載進度更新
autoUpdater.on('download-progress', (progressObj) => {
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj)
  }
})

// 下載完成，顯示確認安裝對話框
autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info)
  }
})

// 更新錯誤
autoUpdater.on('error', (error) => {
  if (mainWindow) {
    mainWindow.webContents.send('update-error', error.message)
  }
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
