import { ipcMain } from 'electron'
import { WindowManager } from '../windowManager'
import type { ProjectionChannel, ProjectionPayload } from '@shared/projection-messages'

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

  ipcMain.on(
    'projection:send',
    (_event, channel: ProjectionChannel, data: ProjectionPayload<typeof channel>) => {
      windowManager.sendToProjection('projection:message', channel, data)
    }
  )

  ipcMain.on(
    'projection:send-to-main',
    (_event, channel: ProjectionChannel, data: ProjectionPayload<typeof channel>) => {
      windowManager.sendToMain('projection:message', channel, data)
    }
  )

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
