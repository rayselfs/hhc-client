import { BrowserWindow, ipcMain } from 'electron'
import { VlcPlayer, initLibVlc, probeMedia } from 'electron-vlc-player'
import type {
  ProjectionVlcControlRequest,
  ProjectionVlcInfo,
  ProjectionVlcProbeRequest,
  ProjectionVlcProbeResult,
  ProjectionVlcStartRequest
} from '@shared/ipc-channels'
import type { WindowManager } from '../windowManager'
import { getNativeFilePath } from './native-fs'
import { isKnownWindow } from './validate'
import { isValidNativeFileId } from '../../shared/native-media'
import { resolveVlcRuntime } from '../video-engine-runtime'

let player: VlcPlayer | null = null
let currentItemId: string | null = null
let currentDurationMs: number | undefined

function getVlcInfo(): ProjectionVlcInfo {
  const runtime = resolveVlcRuntime()
  if (runtime.status !== 'ready' || !runtime.path) {
    return { status: runtime.status, message: runtime.message ?? 'VLC runtime not found' }
  }
  return { status: 'ready', vlcDir: runtime.path }
}

function probeVlcMedia(request: ProjectionVlcProbeRequest): ProjectionVlcProbeResult {
  if (!isValidNativeFileId(request.sourceFileId)) throw new Error('Invalid VLC source id')
  const info = getVlcInfo()
  if (info.status !== 'ready' || !info.vlcDir) {
    throw new Error(info.message ?? 'VLC runtime not found')
  }

  initLibVlc(info.vlcDir)
  const result = probeMedia(getNativeFilePath(request.sourceFileId), 5000)
  return {
    durationMs: result.parsed && result.length > 0 ? result.length : undefined
  }
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

  const nextPlayer = new VlcPlayer({
    window: projectionWindow,
    container: request.container,
    vlcDir: info.vlcDir,
    controls: false,
    autoAdvancePlaylist: false
  })

  try {
    await nextPlayer.embed()
    if (!nextPlayer.isEmbedded()) throw new Error('VLC player failed to embed')

    await stopVlc()
    player = nextPlayer
    currentItemId = request.itemId
    currentDurationMs = request.durationMs

    nextPlayer.on('timeChanged', () => sendState(wm))
    nextPlayer.on('lengthChanged', () => sendState(wm))
    nextPlayer.on('playing', () => sendState(wm, { isPlaying: true, isEnded: false }))
    nextPlayer.on('paused', () => sendState(wm, { isPlaying: false }))
    nextPlayer.on('stopped', () => sendState(wm, { isPlaying: false }))
    nextPlayer.on('endReached', () => sendState(wm, { isPlaying: false, isEnded: true }))
    nextPlayer.on('error', () => sendState(wm, { isPlaying: false }))
    nextPlayer.setSource(getNativeFilePath(request.sourceFileId), { autoplay: false })
    sendState(wm, { isPlaying: false, isEnded: false })
  } catch (error) {
    nextPlayer.destroy()
    throw error
  }
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

  ipcMain.handle('projection-vlc:probe', (event, request: ProjectionVlcProbeRequest) => {
    if (!isKnownWindow(wm, event)) throw new Error('Unauthorized VLC access')
    return probeVlcMedia(request)
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
