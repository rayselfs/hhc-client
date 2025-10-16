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

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
    fullscreen: hasSecondScreen, // Only fullscreen if there's a second screen
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: join(__dirname, 'preload.mjs'),
      // 禁用自動填充功能
      spellcheck: false,
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

  /**
   * 關閉視窗事件處理
   *
   * 'close' 事件：視窗即將關閉（可以阻止）
   * - 檢查是否有已下載的更新
   * - 如果有，發送事件給前端顯示 UpdateDialog（Vue 組件）
   * - 如果沒有，直接優雅退出
   */
  mainWindow.on('close', async (event) => {
    // 阻止視窗立即關閉，先處理更新檢查
    event.preventDefault()

    // 檢查是否有已下載的更新
    if (hasUpdateDownloaded()) {
      const updateInfo = getUpdateInfo()
      mainWindow.webContents.send('update-ready-to-install', updateInfo)
    } else {
      app.quit()
    }
  })

  /**
   * 視窗已關閉事件
   *
   * 'closed' 事件：視窗已經關閉（無法阻止）
   * - 清理視窗引用
   */
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // 設定應用程式選單
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
    projectionWindow.webContents.openDevTools()
  } else {
    projectionWindow.loadFile(join(__dirname, 'renderer/index.html'), {
      hash: '#/projection',
    })
  }

  /**
   * 投影視窗已關閉事件
   * - 通知主視窗投影已關閉
   * - 清理視窗引用
   */
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
    const errorMessage = error instanceof Error ? error.message : '未知錯誤'
    console.error('開始下載更新失敗:', error)
    return { success: false, error: errorMessage }
  }
})

ipcMain.handle('install-update', async () => {
  try {
    installUpdate()
    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤'
    console.error('安裝更新失敗:', error)
    return { success: false, error: errorMessage }
  }
})

// 強制退出應用程式（用戶在關閉時選擇稍後安裝）
ipcMain.handle('force-quit', async () => {
  try {
    app.quit()
    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤'
    console.error('強制退出失敗:', error)
    return { success: false, error: errorMessage }
  }
})

// 處理語系變更
ipcMain.handle('update-language', async (event, language: string) => {
  try {
    const userDataPath = app.getPath('userData')
    const settingsPath = path.join(userDataPath, 'language-settings.json')
    const settings = { language }
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

    // 重新創建選單
    createApplicationMenu(mainWindow)

    return { success: true }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知錯誤'
    console.error('更新語系失敗:', error)
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

  // 初始化自動更新
  initAutoUpdater(mainWindow)
})

/**
 * 所有視窗都已關閉事件
 * 在 macOS 上，通常應用程式不會在所有視窗關閉時退出，但這個應用需要
 */
app.on('window-all-closed', () => {
  app.quit()
})

/**
 * 應用程式即將退出事件
 * 清理所有資源
 */
app.on('before-quit', () => {
  // 關閉投影視窗
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.destroy()
    projectionWindow = null
  }

  // 關閉主視窗（通常已經關閉，這裡是保險措施）
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
    mainWindow = null
  }
})
