import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'path'
import fs from 'fs'
import type { WindowManager } from '../windowManager'
import { isMainWindow } from './validate'

let whisperModelDir: string | null = null

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

  ipcMain.handle('app:select-directory', async (event) => {
    if (!isMainWindow(wm, event)) return null
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('app:set-model-dir', (event, dir: string) => {
    if (!isMainWindow(wm, event)) return
    whisperModelDir = dir
  })
}

export function registerLocalModelProtocol(): void {
  protocol.handle('local-model', (request) => {
    if (!whisperModelDir) return new Response('Model dir not set', { status: 503 })
    const url = new URL(request.url)
    const filePath = path.join(whisperModelDir, url.pathname)
    try {
      const data = fs.readFileSync(filePath)
      return new Response(data)
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
