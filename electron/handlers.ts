import { ipcMain, screen, app } from 'electron'
import { WindowManager } from './windowManager'
import * as Sentry from '@sentry/electron'
import path from 'path'
import { writeFileSync } from 'fs'
import { createApplicationMenu } from './menu'
import {
  getHardwareAcceleration,
  setHardwareAcceleration,
  getVideoQuality,
  setVideoQuality,
  getEnableFfmpeg,
  setEnableFfmpeg,
  VideoQuality,
} from './appSettings'
import { probeVideo, checkFFmpegStatus, setCustomFFmpegPath, clearFFmpegCache } from './ffmpeg'

export const registerGenericHandlers = (windowManager: WindowManager) => {
  // Check if the projection window exists
  ipcMain.handle('check-projection-window', async () => {
    return (
      windowManager.projectionWindow !== null &&
      windowManager.projectionWindow !== undefined &&
      !windowManager.projectionWindow.isDestroyed()
    )
  })

  // Ensure the projection window exists
  ipcMain.handle('ensure-projection-window', async () => {
    if (!windowManager.projectionWindow || windowManager.projectionWindow.isDestroyed()) {
      windowManager.createProjectionWindow()
      return true
    }
    return false
  })

  // Close the projection window
  ipcMain.handle('close-projection-window', async () => {
    return windowManager.closeProjectionWindow()
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
      Sentry.captureException(error, {
        tags: {
          operation: 'get-displays',
        },
        extra: {
          context: 'Error getting display information',
        },
      })
      return []
    }
  })

  // Forward messages to the projection window
  ipcMain.on('send-to-projection', (event, data) => {
    windowManager.sendToProjection('projection-message', data)
  })

  // Forward messages to the main window
  ipcMain.on('send-to-main', (event, data) => {
    windowManager.sendToMain('main-message', data)
  })

  // Handle get system locale
  ipcMain.handle('get-system-locale', async () => {
    try {
      return app.getLocale()
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          operation: 'get-system-locale',
        },
      })
      return 'en' // fallback
    }
  })

  // Handle language change
  ipcMain.handle('update-language', async (event, language: string) => {
    try {
      const userDataPath = app.getPath('userData')
      const settingsPath = path.join(userDataPath, 'language-settings.json')
      const settings = { language }
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2))

      // Re-create the menu
      if (windowManager.mainWindow) {
        createApplicationMenu(windowManager.mainWindow)
      }

      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      Sentry.captureException(error, {
        tags: {
          operation: 'update-language',
        },
        extra: {
          context: 'Failed to update language',
          language: language,
        },
      })
      return { success: false, error: errorMessage }
    }
  })

  // Hardware acceleration handlers
  ipcMain.handle('get-hardware-acceleration', () => {
    return getHardwareAcceleration()
  })

  ipcMain.handle('set-hardware-acceleration', (event, enabled: boolean) => {
    setHardwareAcceleration(enabled)
    return true // Returns true to indicate restart is required
  })

  // Restart app handler
  ipcMain.handle('restart-app', () => {
    app.relaunch()
    app.exit(0)
  })

  // Probe video file for transcoding info
  ipcMain.handle('probe-video', async (event, filePath: string) => {
    try {
      return await probeVideo(filePath)
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'probe-video' },
        extra: { filePath },
      })
      return null
    }
  })

  // Video quality settings
  ipcMain.handle('get-video-quality', () => {
    return getVideoQuality()
  })

  ipcMain.handle('set-video-quality', (_event, quality: VideoQuality) => {
    setVideoQuality(quality)
    return true
  })

  ipcMain.handle('get-enable-ffmpeg', () => {
    return getEnableFfmpeg()
  })

  ipcMain.handle('set-enable-ffmpeg', (_event, enabled: boolean) => {
    setEnableFfmpeg(enabled)
    return true
  })

  ipcMain.handle('ffmpeg-check-status', () => {
    return checkFFmpegStatus()
  })

  ipcMain.handle('ffmpeg-set-path', (_event, customPath: string) => {
    clearFFmpegCache()
    return setCustomFFmpegPath(customPath)
  })
}
