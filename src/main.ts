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
      preload: path.join(__dirname, 'preload.js'),
    },
    title: '主控台',
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
      preload: path.join(__dirname, 'preload.js'),
    },
    title: '投影',
  })

  // If there is no second screen, notify the main window to display a prompt
  if (!hasSecondScreen && mainWindow) {
    mainWindow.webContents.send('no-second-screen-detected')
  }

  // Load projection page
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    projectionWindow.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}/#/projection`)
  } else {
    // Production mode: load projection page directly
    const projectionPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)

    // Load projection page using a more stable method
    projectionWindow
      .loadFile(projectionPath, { hash: 'projection' })
      .then(() => {
        console.log('Projection window loaded successfully')
      })
      .catch((error) => {
        console.error('Failed to load projection window:', error)
        // If direct loading fails, try the backup solution
        projectionWindow
          .loadFile(projectionPath)
          .then(() => {
            // Wait for the page to load and then navigate to the projection page
            projectionWindow.webContents.once('did-finish-load', () => {
              try {
                projectionWindow.webContents.executeJavaScript(`
                  if (window.location.hash !== '#projection') {
                    window.location.hash = 'projection';
                  }
                `)
              } catch (jsError) {
                console.error('Failed to navigate to projection page:', jsError)
                // The last backup solution: reload
                projectionWindow.loadURL(`file://${projectionPath}#projection`)
              }
            })
          })
          .catch((fallbackError) => {
            console.error('All projection loading methods failed:', fallbackError)
          })
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

  // Automatically detect the second screen and open the projection window (but display the default content)
  setTimeout(() => {
    const displays = screen.getAllDisplays()
    const hasExternalDisplay = displays.some(
      (display) => display.bounds.x !== 0 || display.bounds.y !== 0,
    )

    if (hasExternalDisplay) {
      createProjectionWindow()
    }
  }, 500) // Delay 0.5 seconds to ensure the main window has loaded

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
