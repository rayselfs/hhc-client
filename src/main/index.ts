import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { WindowManager } from './windowManager'
import { registerProjectionHandlers } from './ipc/projection'

const wm = WindowManager.getInstance()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('theme:get', () => ({
    source: nativeTheme.themeSource,
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors
  }))

  ipcMain.handle('theme:set', (_event, theme: string) => {
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      nativeTheme.themeSource = theme
    }
  })

  nativeTheme.on('updated', () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('theme:changed', {
        shouldUseDarkColors: nativeTheme.shouldUseDarkColors
      })
    })
  })

  registerProjectionHandlers(wm)
  wm.createMainWindow()
  wm.createProjectionWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) wm.createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  wm.cleanup()
})
