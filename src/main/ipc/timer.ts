import { ipcMain, BrowserWindow } from 'electron'
import { timerService } from '../timerService'
import type { TimerCommand, TimerSettings } from '@shared/types/timer'

export function registerTimerHandlers(): void {
  ipcMain.handle('timer:command', (event, cmd: TimerCommand) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    timerService.handleCommand(cmd)
  })

  ipcMain.handle('timer:get-state', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    return timerService.getState()
  })

  ipcMain.handle('timer:initialize', (event, settings: TimerSettings) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    timerService.initializeState(settings)
  })
}
