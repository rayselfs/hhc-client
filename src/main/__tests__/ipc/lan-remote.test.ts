import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LanRemoteServerOptions } from '../../lan-remote/server'
import type { WindowManager } from '../../windowManager'

const mainWindow = { id: 1 }
const unknownWindow = { id: 2 }
const captured = vi.hoisted(() => ({
  options: null as LanRemoteServerOptions | null,
  serverController: {
    start: vi.fn(),
    stop: vi.fn(),
    createPairingSecret: vi.fn(),
    consumePairingSecret: vi.fn(),
    publishState: vi.fn(),
    getStatus: vi.fn(() => ({ enabled: false, host: '', port: 0 }))
  }
}))

vi.mock('electron', () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>()
  return {
    BrowserWindow: {
      fromWebContents: vi.fn()
    },
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler)
      }),
      _getHandler: (channel: string) => handlers.get(channel),
      _clearHandlers: () => handlers.clear()
    }
  }
})

vi.mock('../../lan-remote/server', () => ({
  createLanRemoteServer: vi.fn((options: LanRemoteServerOptions) => {
    captured.options = options
    return captured.serverController
  })
}))

import { BrowserWindow, ipcMain } from 'electron'
import { registerLanRemoteIpc } from '../../ipc/lan-remote'

const windowManager = {
  getMainWindow: vi.fn(() => mainWindow),
  sendToMain: vi.fn()
} as unknown as WindowManager

type ExtendedIpcMain = typeof ipcMain & {
  _getHandler: (channel: string) => (...args: unknown[]) => unknown
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
  captured.options = null
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mainWindow as never)
  registerLanRemoteIpc(windowManager)
})

describe('LAN remote command acknowledgements', () => {
  it('waits for the renderer result before acknowledging the HTTP command', async () => {
    const command = { requestId: 'r1', type: 'presentation:next' } as const
    const result = captured.options!.commandHandler(command)
    let settled = false
    void result.then(() => {
      settled = true
    })

    await Promise.resolve()
    expect(settled).toBe(false)
    expect(windowManager.sendToMain).toHaveBeenCalledWith('lan-remote:command', command)

    await getHandler('lan-remote:publish-ack')(makeEvent(), {
      requestId: 'r1',
      status: 'rejected',
      reason: 'presentation-end'
    })

    await expect(result).resolves.toEqual({
      requestId: 'r1',
      status: 'rejected',
      reason: 'presentation-end'
    })
  })

  it('rejects duplicate in-flight request IDs', async () => {
    const command = { requestId: 'same', type: 'presentation:next' } as const
    const first = captured.options!.commandHandler(command)

    await expect(captured.options!.commandHandler(command)).resolves.toEqual({
      requestId: 'same',
      status: 'rejected',
      reason: 'duplicate-request'
    })

    await getHandler('lan-remote:publish-ack')(makeEvent(), {
      requestId: 'same',
      status: 'accepted'
    })
    await expect(first).resolves.toEqual({ requestId: 'same', status: 'accepted' })
  })

  it('rejects when the renderer does not respond', async () => {
    vi.useFakeTimers()
    const result = captured.options!.commandHandler({
      requestId: 'timeout',
      type: 'presentation:next'
    })

    await vi.advanceTimersByTimeAsync(3000)

    await expect(result).resolves.toEqual({
      requestId: 'timeout',
      status: 'rejected',
      reason: 'renderer-timeout'
    })
    vi.useRealTimers()
  })

  it('ignores ACKs from non-main renderers', async () => {
    const result = captured.options!.commandHandler({
      requestId: 'r2',
      type: 'presentation:next'
    })
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(unknownWindow as never)

    await getHandler('lan-remote:publish-ack')(makeEvent(), {
      requestId: 'r2',
      status: 'accepted'
    })
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mainWindow as never)
    await getHandler('lan-remote:publish-ack')(makeEvent(), {
      requestId: 'r2',
      status: 'rejected',
      reason: 'not-active'
    })

    await expect(result).resolves.toEqual({
      requestId: 'r2',
      status: 'rejected',
      reason: 'not-active'
    })
  })
})
