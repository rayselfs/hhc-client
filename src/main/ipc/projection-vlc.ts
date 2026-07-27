import { BrowserWindow, ipcMain } from 'electron'
import type { VlcPlayer } from 'electron-vlc-player'
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
import {
  loadVlcPlayerRuntime,
  type VlcPlayerRuntime,
  type VlcPlayerRuntimeResult
} from '../vlc-player-runtime'

let player: VlcPlayer | null = null
let activeRuntime: VlcPlayerRuntime | null = null
let playerListenerCleanup: (() => void) | null = null
let playerResizeCleanup: (() => void) | null = null
let currentItemId: string | null = null
let currentDurationMs: number | undefined
let lifecycleVersion = 0

type ListenerTarget = {
  listeners(event: string): unknown[]
  removeListener(event: string, listener: EventListener): unknown
}

type EventListener = (...args: unknown[]) => void

const VLC_WINDOW_EVENTS = [
  'enter-full-screen',
  'leave-full-screen',
  'close',
  'minimize',
  'restore',
  'hide',
  'focus',
  'blur',
  'show',
  'move'
]

const VLC_WEB_CONTENTS_EVENTS = ['paint', 'devtools-opened', 'did-finish-load']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOptionalFiniteNumber(
  value: unknown,
  minimum: number,
  maximum = Number.POSITIVE_INFINITY
): boolean {
  return (
    value === undefined ||
    (typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum)
  )
}

function validateVlcStartRequest(value: unknown): ProjectionVlcStartRequest {
  if (
    !isRecord(value) ||
    typeof value.itemId !== 'string' ||
    value.itemId.length === 0 ||
    !isValidNativeFileId(value.sourceFileId) ||
    value.container !== '#vlc-player' ||
    !isOptionalFiniteNumber(value.durationMs, 0) ||
    !isOptionalFiniteNumber(value.initialPositionSeconds, 0) ||
    !isOptionalFiniteNumber(value.initialVolume, 0, 1) ||
    (value.initialPlaybackState !== undefined &&
      !['playing', 'paused', 'ended'].includes(String(value.initialPlaybackState)))
  ) {
    throw new Error('Invalid VLC start request')
  }
  return value as unknown as ProjectionVlcStartRequest
}

function validateVlcProbeRequest(value: unknown): ProjectionVlcProbeRequest {
  if (!isRecord(value) || !isValidNativeFileId(value.sourceFileId)) {
    throw new Error('Invalid VLC probe request')
  }
  return value as unknown as ProjectionVlcProbeRequest
}

function validateVlcControlRequest(value: unknown): ProjectionVlcControlRequest {
  if (
    !isRecord(value) ||
    (value.itemId !== undefined && (typeof value.itemId !== 'string' || value.itemId.length === 0))
  ) {
    throw new Error('Invalid VLC control request')
  }
  if (value.action === 'play' || value.action === 'pause') {
    return value as unknown as ProjectionVlcControlRequest
  }
  if (
    value.action === 'seek' &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    value.value >= 0
  ) {
    return value as unknown as ProjectionVlcControlRequest
  }
  if (
    value.action === 'volume' &&
    typeof value.value === 'number' &&
    Number.isFinite(value.value) &&
    value.value >= 0 &&
    value.value <= 1
  ) {
    return value as unknown as ProjectionVlcControlRequest
  }
  throw new Error('Invalid VLC control request')
}

function captureListeners(
  target: ListenerTarget,
  events: string[]
): Map<string, Set<EventListener>> {
  return new Map(
    events.map((event) => [event, new Set(target.listeners(event) as EventListener[])])
  )
}

function captureAddedListeners(
  target: ListenerTarget,
  events: string[],
  before: Map<string, Set<EventListener>>
): Map<string, EventListener[]> {
  return new Map(
    events.map((event) => [
      event,
      (target.listeners(event) as EventListener[]).filter(
        (listener) => !before.get(event)?.has(listener)
      )
    ])
  )
}

function createListenerCleanup(
  window: BrowserWindow,
  beforeWindow: Map<string, Set<EventListener>>,
  beforeWebContents: Map<string, Set<EventListener>>
): () => void {
  const addedWindow = captureAddedListeners(window, VLC_WINDOW_EVENTS, beforeWindow)
  const addedWebContents = captureAddedListeners(
    window.webContents,
    VLC_WEB_CONTENTS_EVENTS,
    beforeWebContents
  )

  return () => {
    removeListeners(window, addedWindow)
    if (!window.isDestroyed()) removeListeners(window.webContents, addedWebContents)
  }
}

function removeListeners(
  target: ListenerTarget,
  addedListeners: Map<string, EventListener[]>
): void {
  for (const [event, listeners] of addedListeners) {
    for (const listener of listeners) target.removeListener(event, listener)
  }
}

type LoadVlcPlayerRuntime = () => Promise<VlcPlayerRuntimeResult>

async function resolveVlcInfo(
  loadRuntime: LoadVlcPlayerRuntime
): Promise<{ info: ProjectionVlcInfo; runtime?: VlcPlayerRuntime }> {
  const loaded = await loadRuntime()
  if (loaded.status === 'error') {
    return { info: { status: 'error', message: loaded.message } }
  }
  activeRuntime = loaded.runtime
  const resolved = resolveVlcRuntime(loaded.runtime.probeDefaultVlcDir)
  if (resolved.status !== 'ready' || !resolved.path) {
    return {
      info: {
        status: resolved.status,
        message: resolved.message ?? 'VLC runtime not found'
      }
    }
  }
  return {
    info: { status: 'ready', vlcDir: resolved.path },
    runtime: loaded.runtime
  }
}

async function probeVlcMedia(
  loadRuntime: LoadVlcPlayerRuntime,
  request: ProjectionVlcProbeRequest
): Promise<ProjectionVlcProbeResult> {
  const { info, runtime } = await resolveVlcInfo(loadRuntime)
  if (info.status !== 'ready' || !info.vlcDir) {
    throw new Error(info.message ?? 'VLC runtime not found')
  }
  if (!runtime) throw new Error('VLC native binding unavailable')

  runtime.initLibVlc(info.vlcDir)
  const result = runtime.probeMedia(getNativeFilePath(request.sourceFileId), 5000)
  return {
    durationMs: result.parsed && result.length > 0 ? result.length : undefined
  }
}

function sendState(wm: WindowManager, next?: { isPlaying?: boolean; isEnded?: boolean }): void {
  if (!player || !currentItemId) return
  const generation = wm.getProjectionState().lifecycle.generation
  if (!Number.isSafeInteger(generation) || generation <= 0) return
  const currentTime = Math.max(0, player.getTime()) / 1000
  const duration =
    currentDurationMs !== undefined && currentDurationMs > 0
      ? currentDurationMs / 1000
      : Math.max(0, player.getLength()) / 1000

  wm.sendToMain('projection:message', generation, 'file:playback-state', {
    itemId: currentItemId,
    currentTime,
    duration,
    isPlaying: next?.isPlaying ?? player.isPlaying(),
    isEnded: next?.isEnded ?? player.getState() === 6
  })
}

function hideNativePlayerWindow(currentPlayer: VlcPlayer): void {
  if (currentPlayer.playerId < 0) return
  try {
    activeRuntime?.getBinding().setPlayerWindowVisible(currentPlayer.playerId, false)
  } catch {
    // Window teardown can race with native view teardown.
  }
}

async function stopVlc(): Promise<void> {
  lifecycleVersion += 1
  currentItemId = null
  currentDurationMs = undefined
  if (!player) return
  const currentPlayer = player
  player = null
  hideNativePlayerWindow(currentPlayer)
  currentPlayer.destroy()
  playerListenerCleanup?.()
  playerListenerCleanup = null
  playerResizeCleanup?.()
  playerResizeCleanup = null
}

async function startVlc(
  wm: WindowManager,
  loadRuntime: LoadVlcPlayerRuntime,
  request: ProjectionVlcStartRequest
): Promise<void> {
  const projectionWindow = wm.getProjectionWindow()
  if (!projectionWindow || projectionWindow.isDestroyed())
    throw new Error('Projection window not open')

  const { info, runtime } = await resolveVlcInfo(loadRuntime)
  if (info.status !== 'ready' || !info.vlcDir) {
    throw new Error(info.message ?? 'VLC runtime not found')
  }
  if (!runtime) throw new Error('VLC native binding unavailable')

  await stopVlc()
  const startVersion = lifecycleVersion + 1
  lifecycleVersion = startVersion
  const beforeWindowListeners = captureListeners(projectionWindow, VLC_WINDOW_EVENTS)
  const beforeWebContentsListeners = captureListeners(
    projectionWindow.webContents,
    VLC_WEB_CONTENTS_EVENTS
  )
  const nextPlayer = new runtime.VlcPlayer({
    window: projectionWindow,
    container: request.container,
    vlcDir: info.vlcDir,
    controls: false,
    autoAdvancePlaylist: false
  })

  try {
    await nextPlayer.embed()
    if (startVersion !== lifecycleVersion) {
      hideNativePlayerWindow(nextPlayer)
      nextPlayer.destroy()
      createListenerCleanup(projectionWindow, beforeWindowListeners, beforeWebContentsListeners)()
      return
    }
    if (!nextPlayer.isEmbedded()) throw new Error('VLC player failed to embed')

    player = nextPlayer
    playerListenerCleanup = createListenerCleanup(
      projectionWindow,
      beforeWindowListeners,
      beforeWebContentsListeners
    )
    const notifyLayoutChange = (): void => nextPlayer.notifyLayoutChange()
    projectionWindow.on('resize', notifyLayoutChange)
    projectionWindow.on('resized', notifyLayoutChange)
    playerResizeCleanup = () => {
      projectionWindow.removeListener('resize', notifyLayoutChange)
      projectionWindow.removeListener('resized', notifyLayoutChange)
    }
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
    if (request.initialVolume !== undefined) {
      nextPlayer.setVolume(Math.round(Math.max(0, Math.min(1, request.initialVolume)) * 100))
    }
    if (request.initialPositionSeconds !== undefined) {
      nextPlayer.setTime(Math.max(0, Math.round(request.initialPositionSeconds * 1000)))
    }
    if (request.initialPlaybackState === 'playing') nextPlayer.play()
    sendState(wm, { isPlaying: false, isEnded: false })
  } catch (error) {
    nextPlayer.destroy()
    createListenerCleanup(projectionWindow, beforeWindowListeners, beforeWebContentsListeners)()
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

export function registerProjectionVlcHandlers(
  wm: WindowManager,
  loadRuntime: LoadVlcPlayerRuntime = loadVlcPlayerRuntime
): void {
  ipcMain.handle('projection-vlc:get-info', async (event): Promise<ProjectionVlcInfo> => {
    if (!isKnownWindow(wm, event)) return { status: 'error', message: 'Unauthorized VLC access' }
    return (await resolveVlcInfo(loadRuntime)).info
  })

  ipcMain.handle('projection-vlc:start', async (event, request: unknown) => {
    if (!isProjectionOrMainWindow(wm, event)) throw new Error('Unauthorized VLC access')
    await startVlc(wm, loadRuntime, validateVlcStartRequest(request))
  })

  ipcMain.handle('projection-vlc:probe', async (event, request: unknown) => {
    if (!isKnownWindow(wm, event)) throw new Error('Unauthorized VLC access')
    return probeVlcMedia(loadRuntime, validateVlcProbeRequest(request))
  })

  ipcMain.handle('projection-vlc:control', (event, command: unknown) => {
    if (!isProjectionOrMainWindow(wm, event)) throw new Error('Unauthorized VLC access')
    controlVlc(validateVlcControlRequest(command))
  })

  ipcMain.handle('projection-vlc:stop', async (event) => {
    if (!isProjectionOrMainWindow(wm, event)) throw new Error('Unauthorized VLC access')
    await stopVlc()
  })
}
