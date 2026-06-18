import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockMainWindow = { id: 1 }
const mockProjectionWindow = new EventEmitter() as EventEmitter & {
  id: number
  webContents: EventEmitter
  isDestroyed: () => boolean
}
mockProjectionWindow.id = 2
mockProjectionWindow.webContents = new EventEmitter()
mockProjectionWindow.isDestroyed = () => false

const mockWindowManager = {
  getMainWindow: vi.fn(() => mockMainWindow),
  getProjectionWindow: vi.fn(() => mockProjectionWindow),
  sendToMain: vi.fn()
}
const mockSetPlayerWindowVisible = vi.fn()
const mockVlcPlayers: Array<{
  destroy: ReturnType<typeof vi.fn>
  notifyLayoutChange: ReturnType<typeof vi.fn>
  playerId: number
}> = []
let mockEmbedImplementation: () => Promise<void> = () => Promise.resolve()

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

vi.mock('electron', () => {
  const handleHandlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    BrowserWindow: {
      fromWebContents: vi.fn(() => mockMainWindow)
    },
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handleHandlers.set(channel, handler)
      }),
      _getHandler: (channel: string) => handleHandlers.get(channel),
      _clearHandlers: () => handleHandlers.clear()
    }
  }
})

vi.mock('electron-vlc-player', () => ({
  getBinding: vi.fn(() => ({
    setPlayerWindowVisible: mockSetPlayerWindowVisible
  })),
  initLibVlc: vi.fn(),
  probeMedia: vi.fn(() => ({ parsed: true, length: 1000 })),
  VlcPlayer: class MockVlcPlayer extends EventEmitter {
    window: typeof mockProjectionWindow
    playerId = 7

    constructor(options: { window: typeof mockProjectionWindow }) {
      super()
      this.window = options.window
      mockVlcPlayers.push(this)
      for (const event of VLC_WINDOW_EVENTS) this.window.on(event, () => {})
      for (const event of VLC_WEB_CONTENTS_EVENTS) this.window.webContents.on(event, () => {})
    }

    embed = vi.fn(() => mockEmbedImplementation())
    isEmbedded = vi.fn(() => true)
    setSource = vi.fn()
    destroy = vi.fn()
    notifyLayoutChange = vi.fn()
    getTime = vi.fn(() => 0)
    getLength = vi.fn(() => 1000)
    isPlaying = vi.fn(() => false)
    getState = vi.fn(() => 0)
    play = vi.fn()
    pause = vi.fn()
    setTime = vi.fn()
    setVolume = vi.fn()
  }
}))

vi.mock('../../video-engine-runtime', () => ({
  resolveVlcRuntime: vi.fn(() => ({ status: 'ready', path: '/vlc' }))
}))

vi.mock('../../ipc/native-fs', () => ({
  getNativeFilePath: vi.fn(() => '/media/source')
}))

import { ipcMain } from 'electron'
import { registerProjectionVlcHandlers } from '../../ipc/projection-vlc'
import type { WindowManager } from '../../windowManager'

type ExtendedIpcMain = typeof ipcMain & {
  _getHandler: (c: string) => (...args: unknown[]) => unknown
  _clearHandlers: () => void
}

function getHandler(channel: string): (...args: unknown[]) => unknown {
  return (ipcMain as ExtendedIpcMain)._getHandler(channel)
}

function makeEvent(): Electron.IpcMainInvokeEvent {
  return { sender: {} } as Electron.IpcMainInvokeEvent
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(ipcMain as ExtendedIpcMain)._clearHandlers()
  mockProjectionWindow.removeAllListeners()
  mockProjectionWindow.webContents.removeAllListeners()
  mockVlcPlayers.length = 0
  mockEmbedImplementation = () => Promise.resolve()
  registerProjectionVlcHandlers(mockWindowManager as unknown as WindowManager)
})

describe('projection-vlc listener cleanup', () => {
  it('removes window listeners added by embedded VlcPlayer instances', async () => {
    const start = getHandler('projection-vlc:start')
    const stop = getHandler('projection-vlc:stop')

    for (let i = 0; i < 3; i++) {
      await start(makeEvent(), {
        itemId: `item-${i}`,
        sourceFileId: '550e8400-e29b-41d4-a716-446655440000',
        container: '#vlc-player'
      })
      await stop(makeEvent())
    }

    for (const event of VLC_WINDOW_EVENTS) {
      expect(mockProjectionWindow.listenerCount(event)).toBe(0)
    }
    for (const event of VLC_WEB_CONTENTS_EVENTS) {
      expect(mockProjectionWindow.webContents.listenerCount(event)).toBe(0)
    }
  })

  it('hides the native VLC window before destroying the embedded player', async () => {
    const start = getHandler('projection-vlc:start')
    const stop = getHandler('projection-vlc:stop')

    await start(makeEvent(), {
      itemId: 'item-1',
      sourceFileId: '550e8400-e29b-41d4-a716-446655440000',
      container: '#vlc-player'
    })
    await stop(makeEvent())

    expect(mockSetPlayerWindowVisible).toHaveBeenCalledWith(7, false)
  })

  it('destroys a stale VLC player when stop runs while embed is pending', async () => {
    const start = getHandler('projection-vlc:start')
    const stop = getHandler('projection-vlc:stop')
    let resolveEmbed: (() => void) | undefined
    mockEmbedImplementation = () =>
      new Promise<void>((resolve) => {
        resolveEmbed = resolve
      })

    const startPromise = start(makeEvent(), {
      itemId: 'item-1',
      sourceFileId: '550e8400-e29b-41d4-a716-446655440000',
      container: '#vlc-player'
    })

    await Promise.resolve()
    await stop(makeEvent())
    resolveEmbed?.()
    await startPromise

    expect(mockSetPlayerWindowVisible).toHaveBeenCalledWith(7, false)
    expect(mockVlcPlayers[0].destroy).toHaveBeenCalled()
    for (const event of VLC_WINDOW_EVENTS) {
      expect(mockProjectionWindow.listenerCount(event)).toBe(0)
    }
  })

  it('syncs VLC native bounds when the projection window resizes', async () => {
    const start = getHandler('projection-vlc:start')
    const stop = getHandler('projection-vlc:stop')

    await start(makeEvent(), {
      itemId: 'item-1',
      sourceFileId: '550e8400-e29b-41d4-a716-446655440000',
      container: '#vlc-player'
    })

    mockProjectionWindow.emit('resize')
    mockProjectionWindow.emit('resized')

    expect(mockVlcPlayers[0].notifyLayoutChange).toHaveBeenCalledTimes(2)

    await stop(makeEvent())
    mockProjectionWindow.emit('resize')
    expect(mockVlcPlayers[0].notifyLayoutChange).toHaveBeenCalledTimes(2)
  })
})
