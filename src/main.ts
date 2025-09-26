import { app, BrowserWindow, screen, ipcMain } from 'electron'
import path from 'node:path'
import started from 'electron-squirrel-startup'

// Electron Forge Vite plugin types
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string
declare const MAIN_WINDOW_VITE_NAME: string

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let projectionWindow: BrowserWindow | null = null

const createMainWindow = () => {
  // 創建主窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Bible Client - 主控制台',
  })

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    // Open the DevTools.
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  mainWindow.on('closed', () => {
    // 關閉主窗口時也關閉投影窗口
    if (projectionWindow && !projectionWindow.isDestroyed()) {
      projectionWindow.close()
      projectionWindow = null
    }
    mainWindow = null

    // 在所有平台上主窗口關閉時都退出應用程式
    app.quit()
  })
}

const createProjectionWindow = () => {
  // 獲取所有顯示器
  const displays = screen.getAllDisplays()
  const externalDisplay = displays.find(
    (display) => display.bounds.x !== 0 || display.bounds.y !== 0,
  )

  // 檢查是否有第二螢幕
  const hasSecondScreen = externalDisplay !== undefined
  const targetDisplay = externalDisplay || displays[0]

  // 創建投影窗口
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
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Bible Client - 投影模式',
  })

  // 如果沒有第二螢幕，通知主窗口顯示提示
  if (!hasSecondScreen && mainWindow) {
    mainWindow.webContents.send('no-second-screen-detected')
  }

  // 載入投影頁面
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    projectionWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/#/projection`)
  } else {
    // 生產模式：直接載入投影頁面
    const projectionPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)

    // 使用更穩定的方式載入投影頁面
    projectionWindow
      .loadFile(projectionPath, { hash: 'projection' })
      .then(() => {
        console.log('Projection window loaded successfully')
      })
      .catch((error) => {
        console.error('Failed to load projection window:', error)
        // 如果直接載入失敗，嘗試備用方案
        projectionWindow
          .loadFile(projectionPath)
          .then(() => {
            // 等待頁面載入完成後導航到投影頁面
            projectionWindow.webContents.once('did-finish-load', () => {
              try {
                projectionWindow.webContents.executeJavaScript(`
                  if (window.location.hash !== '#projection') {
                    window.location.hash = 'projection';
                  }
                `)
              } catch (jsError) {
                console.error('Failed to navigate to projection page:', jsError)
                // 最後的備用方案：重新載入
                projectionWindow.loadURL(`file://${projectionPath}#projection`)
              }
            })
          })
          .catch((fallbackError) => {
            console.error('All projection loading methods failed:', fallbackError)
          })
      })
  }

  // 窗口關閉時清理
  projectionWindow.on('closed', () => {
    // 通知主窗口投影已關閉
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('projection-closed')
    }
    projectionWindow = null
  })

  // 監聽來自投影窗口的消息
  projectionWindow.webContents.on('did-finish-load', () => {
    // 發送當前狀態到投影窗口
    if (mainWindow) {
      mainWindow.webContents.send('get-current-state')
    }

    // 通知主窗口投影已開啟
    if (mainWindow) {
      mainWindow.webContents.send('projection-opened')
    }
  })
}

// IPC 處理器
// 檢查投影窗口是否存在
ipcMain.handle('check-projection-window', async () => {
  return (
    projectionWindow !== null && projectionWindow !== undefined && !projectionWindow.isDestroyed()
  )
})

// 確保投影窗口存在
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

// 轉發消息到投影窗口
ipcMain.on('send-to-projection', (event, data) => {
  if (projectionWindow) {
    projectionWindow.webContents.send('projection-message', data)
  }
})

// 轉發消息到主窗口
ipcMain.on('send-to-main', (event, data) => {
  if (mainWindow) {
    mainWindow.webContents.send('main-message', data)
  }
})

// 應用事件
app.whenReady().then(() => {
  // 設置安全策略
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor')

  createMainWindow()

  // 自動偵測第二螢幕並開啟投影窗口（但顯示預設內容）
  setTimeout(() => {
    const displays = screen.getAllDisplays()
    const hasExternalDisplay = displays.some(
      (display) => display.bounds.x !== 0 || display.bounds.y !== 0,
    )

    if (hasExternalDisplay) {
      createProjectionWindow()
    }
  }, 500) // 延遲0.5秒確保主窗口已載入

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // 確保所有窗口都已關閉，包括投影窗口
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.close()
    projectionWindow = null
  }

  // 在所有平台上都退出應用程式
  app.quit()
})

// 應用程式退出前的清理
app.on('before-quit', () => {
  // 強制關閉所有窗口
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.destroy()
    projectionWindow = null
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
    mainWindow = null
  }
})
