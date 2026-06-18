import { BrowserWindow, ipcMain } from 'electron'
import { VlcPlayer, probeDefaultVlcDir } from 'electron-vlc-player'
import type {
  ProjectionVlcControlRequest,
  ProjectionVlcInfo,
  ProjectionVlcStartRequest
} from '@shared/ipc-channels'
import type { WindowManager } from '../windowManager'
import { getNativeFilePath } from './native-fs'
import { isKnownWindow } from './validate'
import { isValidNativeFileId } from '../../shared/native-media'

let player: VlcPlayer | null = null
let currentItemId: string | null = null
let currentDurationMs: number | undefined

function getVlcInfo(): ProjectionVlcInfo {
  const vlcDir = probeDefaultVlcDir()
  if (!vlcDir) {
    return { status: 'missing', message: 'VLC runtime not found' }
  }
  return { status: 'ready', vlcDir }
}

function sendState(wm: WindowManager, next?: { isPlaying?: boolean; isEnded?: boolean }): void {
  if (!player || !currentItemId) return
  const currentTime = Math.max(0, player.getTime()) / 1000
  const duration =
    currentDurationMs !== undefined && currentDurationMs > 0
      ? currentDurationMs / 1000
      : Math.max(0, player.getLength()) / 1000

  wm.sendToMain('projection:message', 'file:playback-state', {
    itemId: currentItemId,
    currentTime,
    duration,
    isPlaying: next?.isPlaying ?? player.isPlaying(),
    isEnded: next?.isEnded ?? player.getState() === 6
  })
}

async function stopVlc(): Promise<void> {
  currentItemId = null
  currentDurationMs = undefined
  if (!player) return
  player.destroy()
  player = null
}

async function startVlc(wm: WindowManager, request: ProjectionVlcStartRequest): Promise<void> {
  if (!isValidNativeFileId(request.sourceFileId)) throw new Error('Invalid VLC source id')
  const projectionWindow = wm.getProjectionWindow()
  if (!projectionWindow || projectionWindow.isDestroyed())
    throw new Error('Projection window not open')

  const info = getVlcInfo()
  if (info.status !== 'ready' || !info.vlcDir) {
    throw new Error(info.message ?? 'VLC runtime not found')
  }

  await stopVlc()
  currentItemId = request.itemId
  currentDurationMs = request.durationMs

  player = new VlcPlayer({
    window: projectionWindow,
    container: request.container,
    vlcDir: info.vlcDir,
    controls: false,
    autoAdvancePlaylist: false
  })

  player.on('timeChanged', () => sendState(wm))
  player.on('lengthChanged', () => sendState(wm))
  player.on('playing', () => sendState(wm, { isPlaying: true, isEnded: false }))
  player.on('paused', () => sendState(wm, { isPlaying: false }))
  player.on('stopped', () => sendState(wm, { isPlaying: false }))
  player.on('endReached', () => sendState(wm, { isPlaying: false, isEnded: true }))
  player.on('error', () => sendState(wm, { isPlaying: false }))

  await player.embed()
  player.setSource(getNativeFilePath(request.sourceFileId), { autoplay: false })
  sendState(wm, { isPlaying: false, isEnded: false })
}

function controlVlc(command: ProjectionVlcControlRequest): void {
  if (!player) return
  if (command.itemId && command.itemId !== currentItemId) return

  switch (command.action) {
    case 'play':
      player.play()
      break
    case 'pause':
      player.pause()
      break
    case 'seek':
      player.setTime(Math.max(0, Math.round(command.value * 1000)))
      break
    case 'volume':
      player.setVolume(Math.round(Math.max(0, Math.min(1, command.value)) * 100))
      break
  }
}

function isProjectionOrMainWindow(wm: WindowManager, event: Electron.IpcMainInvokeEvent): boolean {
  const senderWindow = BrowserWindow.fromWebContents(event.sender)
  return senderWindow === wm.getProjectionWindow() || isKnownWindow(wm, event)
}

export function registerProjectionVlcHandlers(wm: WindowManager): void {
  ipcMain.handle('projection-vlc:get-info', (event): ProjectionVlcInfo => {
    if (!isKnownWindow(wm, event)) return { status: 'error', message: 'Unauthorized VLC access' }
    return getVlcInfo()
  })

  ipcMain.handle('projection-vlc:start', async (event, request: ProjectionVlcStartRequest) => {
    if (!isProjectionOrMainWindow(wm, event)) throw new Error('Unauthorized VLC access')
    await startVlc(wm, request)
  })

  ipcMain.handle('projection-vlc:control', (event, command: ProjectionVlcControlRequest) => {
    if (!isProjectionOrMainWindow(wm, event)) throw new Error('Unauthorized VLC access')
    controlVlc(command)
  })

  ipcMain.handle('projection-vlc:stop', async (event) => {
    if (!isProjectionOrMainWindow(wm, event)) throw new Error('Unauthorized VLC access')
    await stopVlc()
  })
}
