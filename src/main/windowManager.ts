import { BrowserWindow, screen, app, shell } from 'electron'
import { join } from 'path'
import { optimizer, is } from '@electron-toolkit/utils'
import type { IpcMainToRendererChannel, IpcMainToRendererMap } from '@shared/ipc-channels'

export class WindowManager {
  private static instance: WindowManager
  private mainWindow: BrowserWindow | null = null
  private projectionWindow: BrowserWindow | null = null

  // eslint-disable-next-line @typescript-eslint/no-empty-function -- singleton pattern requires private constructor
  private constructor() {}

  static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager()
    }
    return WindowManager.instance
  }

  private getExternalDisplay(): Electron.Display | undefined {
    const primaryId = screen.getPrimaryDisplay().id
    return screen.getAllDisplays().find((d) => d.id !== primaryId)
  }

  private getPlatformWindowOptions(): Partial<Electron.BrowserWindowConstructorOptions> {
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
    const externalDisplay = this.getExternalDisplay()
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
        sandbox: true,
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

    const loadPromise =
      is.dev && process.env['ELECTRON_RENDERER_URL']
        ? this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
        : this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'))

    loadPromise.catch((err) => {
      console.error('Failed to load main window:', err)
    })

    this.mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('Main window renderer crashed:', details.reason)
    })

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

    const externalDisplay = this.getExternalDisplay()
    const hasSecondScreen = externalDisplay !== undefined
    const targetDisplay = externalDisplay || screen.getPrimaryDisplay()

    this.projectionWindow = new BrowserWindow({
      width: hasSecondScreen ? targetDisplay.bounds.width : 800,
      height: hasSecondScreen ? targetDisplay.bounds.height : 600,
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      fullscreen: hasSecondScreen,
      frame: !hasSecondScreen,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      },
      title: 'Projection'
    })

    optimizer.watchWindowShortcuts(this.projectionWindow)

    const loadPromise =
      is.dev && process.env['ELECTRON_RENDERER_URL']
        ? this.projectionWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/projection')
        : this.projectionWindow.loadFile(join(__dirname, '../renderer/index.html'), {
            hash: '/projection'
          })

    loadPromise.catch((err) => {
      console.error('Failed to load projection window:', err)
    })

    this.projectionWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('Projection window renderer crashed:', details.reason)
    })

    this.projectionWindow.webContents.on('did-finish-load', () => {
      this.sendToMain('projection:opened')
    })

    this.projectionWindow.on('closed', () => {
      this.sendToMain('projection:closed')
      this.projectionWindow = null
    })
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  getProjectionWindow(): BrowserWindow | null {
    return this.projectionWindow
  }

  sendToProjection<C extends IpcMainToRendererChannel>(
    channel: C,
    ...args: IpcMainToRendererMap[C]
  ): void {
    if (this.projectionWindow && !this.projectionWindow.isDestroyed()) {
      this.projectionWindow.webContents.send(channel, ...args)
    }
  }

  sendToMain<C extends IpcMainToRendererChannel>(
    channel: C,
    ...args: IpcMainToRendererMap[C]
  ): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args)
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
