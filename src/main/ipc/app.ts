import { app, BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { WindowManager } from '../windowManager'
import { isMainWindow } from './validate'

export function registerAppIpc(wm: WindowManager): void {
  ipcMain.handle('app:relaunch', (event) => {
    if (!isMainWindow(wm, event)) return
    if (is.dev) {
      const win = BrowserWindow.fromWebContents(event.sender)
      win?.webContents.reload()
    } else {
      app.relaunch()
      app.exit(0)
    }
  })
}
