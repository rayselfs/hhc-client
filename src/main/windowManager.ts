import { BrowserWindow, screen, app, shell } from 'electron'
import { join } from 'path'
import { optimizer, is } from '@electron-toolkit/utils'

export class WindowManager {
  private static instance: WindowManager
  public mainWindow: BrowserWindow | null = null
  public projectionWindow: BrowserWindow | null = null

  private constructor() {}

  static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager()
    }
    return WindowManager.instance
  }

  private getPlatformWindowOptions(): Record<string, unknown> {
    if (process.platform === 'darwin') {
      let trafficLightPosition = { x: 20, y: 18 }
      try {
        const major = parseInt(String(process.getSystemVersion()).split('.')[0], 10)
        if (!Number.isNaN(major) && major >= 26) {
          trafficLightPosition = { x: 20, y: 20 }
        }
      } catch {
        trafficLightPosition = { x: 20, y: 18 }
      }

      return {
        titleBarStyle: 'hidden',
        trafficLightPosition,
        transparent: true
      }
    }

    if (process.platform === 'win32') {
      return {
        frame: false,
        titleBarStyle: 'hidden',
        roundedCorners: true
      }
    }

    return {}
  }

  createMainWindow(): void {
    const displays = screen.getAllDisplays()
    const externalDisplay = displays.find(
      (display) => display.bounds.x !== 0 || display.bounds.y !== 0
    )
    const hasSecondScreen = externalDisplay !== undefined

    const platformOptions = this.getPlatformWindowOptions()

    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      autoHideMenuBar: true,
      ...platformOptions,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      },
      title: 'Console'
    })

    optimizer.watchWindowShortcuts(this.mainWindow)

    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https:') || url.startsWith('http:')) {
        shell.openExternal(url)
      }
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
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

    this.mainWindow.on('closed', () => {
      this.mainWindow = null
      app.quit()
    })
  }

  createProjectionWindow(): void {
    if (this.isProjectionOpen()) return

    const displays = screen.getAllDisplays()
    const externalDisplay = displays.find(
      (display) => display.bounds.x !== 0 || display.bounds.y !== 0
    )
    const hasSecondScreen = externalDisplay !== undefined
    const targetDisplay = externalDisplay || displays[0]

    this.projectionWindow = new BrowserWindow({
      width: hasSecondScreen ? targetDisplay.bounds.width : 800,
      height: hasSecondScreen ? targetDisplay.bounds.height : 600,
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      fullscreen: hasSecondScreen,
      frame: !hasSecondScreen,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      },
      title: 'Projection'
    })

    optimizer.watchWindowShortcuts(this.projectionWindow)

    if (!hasSecondScreen) {
      this.sendToMain('projection:no-second-screen', null)
    }

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.projectionWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/projection')
    } else {
      this.projectionWindow.loadFile(join(__dirname, '../renderer/index.html'), {
        hash: '/projection'
      })
    }

    this.projectionWindow.webContents.on('did-finish-load', () => {
      this.sendToMain('projection:opened', null)
    })

    this.projectionWindow.on('closed', () => {
      this.sendToMain('projection:closed', null)
      this.projectionWindow = null
    })
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  getProjectionWindow(): BrowserWindow | null {
    return this.projectionWindow
  }

  sendToProjection(channel: string, data: unknown): void {
    if (this.projectionWindow && !this.projectionWindow.isDestroyed()) {
      this.projectionWindow.webContents.send(channel, data)
    }
  }

  sendToMain(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  closeProjection(): void {
    if (this.projectionWindow && !this.projectionWindow.isDestroyed()) {
      this.projectionWindow.close()
      this.projectionWindow = null
    }
  }

  isProjectionOpen(): boolean {
    return this.projectionWindow !== null && !this.projectionWindow.isDestroyed()
  }

  getDisplays(): Electron.Display[] {
    return screen.getAllDisplays()
  }

  cleanup(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.destroy()
    }
    this.mainWindow = null

    if (this.projectionWindow && !this.projectionWindow.isDestroyed()) {
      this.projectionWindow.destroy()
    }
    this.projectionWindow = null
  }
}

export default WindowManager
