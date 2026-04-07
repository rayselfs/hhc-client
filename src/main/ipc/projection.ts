import { ipcMain } from 'electron'
import { WindowManager } from '../windowManager'

export function registerProjectionHandlers(windowManager: WindowManager): void {
  ipcMain.handle('projection:check', () => ({
    exists: windowManager.isProjectionOpen()
  }))

  ipcMain.handle('projection:ensure', () => {
    const wasOpen = windowManager.isProjectionOpen()
    if (!wasOpen) {
      windowManager.createProjectionWindow()
    }
    return {
      created: !wasOpen
    }
  })

  ipcMain.handle('projection:close', () => {
    windowManager.closeProjection()
    return {
      closed: true
    }
  })

  ipcMain.on('projection:send', (_event, channel: string, data: unknown) => {
    windowManager.sendToProjection('projection:message', channel, data)
  })

  ipcMain.on('projection:send-to-main', (_event, channel: string, data: unknown) => {
    windowManager.sendToMain('projection:message', channel, data)
  })

  ipcMain.handle('projection:get-displays', () => {
    const displays = windowManager.getDisplays()
    return displays.map((display) => ({
      id: display.id,
      bounds: display.bounds,
      workArea: display.workArea,
      scaleFactor: display.scaleFactor
    }))
  })
}
