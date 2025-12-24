import { BrowserWindow, screen, app } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { TimerService } from './timerService'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class WindowManager {
  private static instance: WindowManager
  public mainWindow: BrowserWindow | null = null
  public projectionWindow: BrowserWindow | null = null
  private timerService: TimerService | null = null

  private constructor() {}

  static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager()
    }
    return WindowManager.instance
  }

  setTimerService(service: TimerService) {
    this.timerService = service
  }

  createMainWindow() {
    const displays = screen.getAllDisplays()
    const externalDisplay = displays.find(
      (display) => display.bounds.x !== 0 || display.bounds.y !== 0,
    )
    const hasSecondScreen = externalDisplay !== undefined

    this.mainWindow = new BrowserWindow({
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
      this.mainWindow.loadURL(devUrl)
      this.mainWindow.webContents.openDevTools()
    } else {
      this.mainWindow.loadFile(join(__dirname, 'renderer/index.html'))
    }

    this.mainWindow.once('ready-to-show', () => {
      if (process.platform === 'win32' && hasSecondScreen) {
        this.mainWindow?.maximize()
      }

      if (process.platform === 'darwin' && hasSecondScreen) {
        this.mainWindow?.setFullScreen(true)
      }

      this.mainWindow?.show()
    })

    this.mainWindow.on('close', () => {})

    this.mainWindow.on('closed', () => {
      if (this.timerService && this.mainWindow) {
        this.timerService.unregisterWindow(this.mainWindow)
      }
      this.mainWindow = null
      app.quit()
    })

    // Register with timer service
    if (this.timerService) {
      this.timerService.registerWindow(this.mainWindow)
    }
  }

  createProjectionWindow() {
    const displays = screen.getAllDisplays()
    const externalDisplay = displays.find(
      (display) => display.bounds.x !== 0 || display.bounds.y !== 0,
    )
    const hasSecondScreen = externalDisplay !== undefined
    const targetDisplay = externalDisplay || displays[0]

    // Create projection window
    this.projectionWindow = new BrowserWindow({
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
    if (!hasSecondScreen && this.mainWindow) {
      this.mainWindow.webContents.send('SYSTEM_NO_SECOND_SCREEN')
    }

    const isDev = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development'

    if (isDev) {
      const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
      this.projectionWindow.loadURL(devUrl + '#/projection')
      this.projectionWindow.webContents.openDevTools()
    } else {
      this.projectionWindow.loadFile(join(__dirname, 'renderer/index.html'), {
        hash: '#/projection',
      })
    }

    // Projection window closed event
    this.projectionWindow.on('closed', () => {
      if (this.timerService && this.projectionWindow) {
        this.timerService.unregisterWindow(this.projectionWindow)
      }
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('SYSTEM_PROJECTION_CLOSED')
      }
      this.projectionWindow = null
    })

    // Register projection window with timer service
    if (this.timerService) {
      this.timerService.registerWindow(this.projectionWindow)
    }

    // Listen for messages from the projection window
    this.projectionWindow.webContents.on('did-finish-load', () => {
      // Send the current state to the projection window
      if (this.mainWindow) {
        this.mainWindow.webContents.send('SYSTEM_GET_STATE')
      }

      // Notify the main window that the projection has been opened
      if (this.mainWindow) {
        this.mainWindow.webContents.send('projection-opened')
      }
    })
  }

  closeProjectionWindow() {
    if (this.projectionWindow && !this.projectionWindow.isDestroyed()) {
      this.projectionWindow.close()
      this.projectionWindow = null
      return true
    }
    return false
  }

  sendToProjection(channel: string, data: unknown) {
    if (this.projectionWindow && !this.projectionWindow.isDestroyed()) {
      this.projectionWindow.webContents.send(channel, data)
    }
  }

  sendToMain(channel: string, data: unknown) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }
}
