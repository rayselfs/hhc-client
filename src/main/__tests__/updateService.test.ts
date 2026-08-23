import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const updaterHandlers = new Map<string, (payload?: unknown) => void>()
  return {
    updaterHandlers,
    autoUpdater: {
      autoDownload: true,
      autoInstallOnAppQuit: true,
      on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
        updaterHandlers.set(event, handler)
      }),
      checkForUpdates: vi.fn(() => Promise.resolve(null)),
      downloadUpdate: vi.fn(() => Promise.resolve()),
      quitAndInstall: vi.fn()
    },
    ipcHandle: vi.fn(),
    sendToMain: vi.fn()
  }
})

vi.mock('electron-updater', () => ({ autoUpdater: mocks.autoUpdater }))
vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: vi.fn(() => '2.3.0') },
  ipcMain: { handle: mocks.ipcHandle }
}))

import type { WindowManager } from '../windowManager'
import { registerUpdateService } from '../updateService'

describe('registerUpdateService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.updaterHandlers.clear()
    registerUpdateService({ sendToMain: mocks.sendToMain } as unknown as WindowManager)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('publishes the rounded updater download percentage', () => {
    mocks.updaterHandlers.get('download-progress')?.({
      total: 1000,
      delta: 125,
      transferred: 424,
      percent: 42.4,
      bytesPerSecond: 1024
    })

    expect(mocks.sendToMain).toHaveBeenCalledWith('update:status-changed', {
      status: 'downloading',
      percent: 42
    })
  })
})
