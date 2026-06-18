import { BrowserWindow, screen, app, shell } from 'electron'
import { join } from 'path'
import { optimizer, is } from '@electron-toolkit/utils'
import type { IpcMainToRendererChannel, IpcMainToRendererMap } from '@shared/ipc-channels'

let _cachedDisplay: Electron.Display | null | undefined = undefined

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
    if (_cachedDisplay !== undefined) {
      return _cachedDisplay === null ? undefined : _cachedDisplay
    }

    const primaryId = screen.getPrimaryDisplay().id
    const externalDisplay = screen.getAllDisplays().find((d) => d.id !== primaryId)
    _cachedDisplay = externalDisplay ?? null

    return externalDisplay
  }

  private getProjectionDisplay(displayId = ''): Electron.Display {
    const displays = screen.getAllDisplays()
    const primaryDisplay = screen.getPrimaryDisplay()

    if (displayId) {
      const selected = displays.find(
        (display) => String(display.id) === displayId && display.id !== primaryDisplay.id
      )
      if (selected) return selected
    }

    return this.getExternalDisplay() || primaryDisplay
  }

  createMainWindow(): void {
    screen.on('display-added', () => {
      _cachedDisplay = undefined
    })
    screen.on('display-removed', () => {
      _cachedDisplay = undefined
    })

    const externalDisplay = this.getExternalDisplay()
    const hasSecondScreen = externalDisplay !== undefined

    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      },
      title: 'LibrePresenter'
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

  createProjectionWindow(displayId = ''): void {
    if (this.isProjectionOpen()) return

    const primaryDisplay = screen.getPrimaryDisplay()
    const targetDisplay = this.getProjectionDisplay(displayId)
    const hasSecondScreen = targetDisplay.id !== primaryDisplay.id

    const projectionWindow = new BrowserWindow({
      width: hasSecondScreen ? targetDisplay.bounds.width : 800,
      height: hasSecondScreen ? targetDisplay.bounds.height : 600,
      x: targetDisplay.bounds.x,
      y: targetDisplay.bounds.y,
      fullscreen: hasSecondScreen,
      frame: !hasSecondScreen,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false
      },
      title: 'Projection'
    })
    this.projectionWindow = projectionWindow

    optimizer.watchWindowShortcuts(projectionWindow)

    const loadPromise =
      is.dev && process.env['ELECTRON_RENDERER_URL']
        ? projectionWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#/projection')
        : projectionWindow.loadFile(join(__dirname, '../renderer/index.html'), {
            hash: '/projection'
          })

    loadPromise.catch((err) => {
      console.error('Failed to load projection window:', err)
    })

    projectionWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error('Projection window renderer crashed:', details.reason)
    })

    projectionWindow.once('ready-to-show', () => {
      projectionWindow.show()
    })

    projectionWindow.webContents.on('did-finish-load', () => {
      this.sendToMain('projection:opened')
    })

    projectionWindow.on('closed', () => {
      if (this.projectionWindow !== projectionWindow) return
      this.sendToMain('projection:closed')
      this.projectionWindow = null
    })
  }

  moveProjectionWindow(displayId: string): boolean {
    const projectionWindow = this.projectionWindow
    if (!projectionWindow || projectionWindow.isDestroyed()) return false

    this.projectionWindow = null
    projectionWindow.close()
    this.createProjectionWindow(displayId)
    return true
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

  getPrimaryDisplayId(): number {
    return screen.getPrimaryDisplay().id
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
