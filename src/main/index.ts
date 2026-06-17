import { app, BrowserWindow, ipcMain, nativeTheme, protocol } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import { WindowManager } from './windowManager'
import { registerProjectionHandlers } from './ipc/projection'
import { registerTimerHandlers } from './ipc/timer'
import { registerBibleApiHandlers } from './ipc/bible-api'
import { registerAppIpc, registerLocalModelProtocol } from './ipc/app'
import { registerSpeechKeyStorageHandlers } from './ipc/speech-key-storage'
import { registerNativeFsHandlers, registerNativeMediaProtocol } from './ipc/native-fs'
import { registerLiveMediaProtocol, registerVideoTranscodeHandlers } from './ipc/video-transcode'
import { registerLocalSyncHandlers } from './ipc/local-sync'
import { registerOneDriveCredentialHandlers } from './ipc/onedrive-credentials'
import { registerOneDriveDownloadHandlers } from './ipc/onedrive-download'
import { isKnownWindow, validateTheme } from './ipc/validate'
import { registerUpdateService } from './updateService'

protocol.registerSchemesAsPrivileged([
  { scheme: 'local-model', privileges: { secure: true, supportFetchAPI: true, stream: true } },
  {
    scheme: 'hhc-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  },
  {
    scheme: 'hhc-live-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true
    }
  }
])

process.on('uncaughtException', (error) => {
  console.error('[MAIN] Uncaught Exception:', error)
  app.quit()
})

process.on('unhandledRejection', (reason) => {
  console.error('[MAIN] Unhandled Rejection:', reason)
})

const wm = WindowManager.getInstance()

app.whenReady().then(() => {
  electronApp.setAppUserModelId('tw.org.alive.client')

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
  registerLocalModelProtocol()
  registerSpeechKeyStorageHandlers(wm)
  registerNativeFsHandlers(wm)
  registerVideoTranscodeHandlers(wm)
  registerLocalSyncHandlers(wm)
  registerOneDriveCredentialHandlers(wm)
  registerOneDriveDownloadHandlers(wm)
  registerNativeMediaProtocol()
  registerLiveMediaProtocol()
  wm.createMainWindow()
  registerUpdateService(wm)

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
