import { ipcMain } from 'electron'
import { WindowManager } from '../windowManager'
import type { ProjectionMessageTuple } from '@shared/projection-messages'

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

  ipcMain.on('projection:send', (_event, ...args: [...ProjectionMessageTuple]) => {
    windowManager.sendToProjection('projection:message', ...args)
  })

  ipcMain.on('projection:send-to-main', (_event, ...args: [...ProjectionMessageTuple]) => {
    windowManager.sendToMain('projection:message', ...args)
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
