import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { WindowManager } from './windowManager'
import { registerProjectionHandlers } from './ipc/projection'
import { registerTimerHandlers } from './ipc/timer'
import { registerBibleApiHandlers } from './ipc/bible-api'
import { registerAppIpc } from './ipc/app'
import { isKnownWindow, validateTheme } from './ipc/validate'

process.on('uncaughtException', (error) => {
  console.error('[MAIN] Uncaught Exception:', error)
  app.quit()
})

process.on('unhandledRejection', (reason) => {
  console.error('[MAIN] Unhandled Rejection:', reason)
})

const wm = WindowManager.getInstance()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('theme:get', (event) => {
    if (!isKnownWindow(wm, event)) return { source: 'system', shouldUseDarkColors: false }
    return {
      source: nativeTheme.themeSource,
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors
    }
  })

  ipcMain.handle('theme:set', (event, theme: unknown) => {
    if (!isKnownWindow(wm, event)) return
    if (!validateTheme(theme)) return
    nativeTheme.themeSource = theme as 'light' | 'dark' | 'system'
  })

  nativeTheme.on('updated', () => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('theme:changed', {
        shouldUseDarkColors: nativeTheme.shouldUseDarkColors
      })
    })
  })

  registerProjectionHandlers(wm)
  registerTimerHandlers(wm)
  registerBibleApiHandlers(wm)
  registerAppIpc(wm)
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
