import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const updaterHandlers = new Map<string, (payload?: unknown) => void>()
  const ipcHandlers = new Map<string, (...args: unknown[]) => unknown>()

  return {
    updaterHandlers,
    ipcHandlers,
    autoUpdater: {
      autoDownload: false,
      autoInstallOnAppQuit: true,
      on: vi.fn((event: string, handler: (payload?: unknown) => void) => {
        updaterHandlers.set(event, handler)
      }),
      checkForUpdates: vi.fn(() => Promise.resolve(null)),
      downloadUpdate: vi.fn(() => Promise.resolve()),
      quitAndInstall: vi.fn()
    },
    ipcHandle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler)
    }),
    openPath: vi.fn(() => Promise.resolve('')),
    downloadMacUpdate: vi.fn(() => Promise.resolve('/tmp/hhc-presenter-2.4.1.dmg')),
    sendToMain: vi.fn(),
    getMainWindow: vi.fn(() => ({ id: 'main-window' }))
  }
})

vi.mock('electron-updater', () => ({ autoUpdater: mocks.autoUpdater }))
vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: vi.fn(() => '2.4.0') },
  ipcMain: { handle: mocks.ipcHandle },
  shell: { openPath: mocks.openPath }
}))
vi.mock('../macUpdateDownloader', () => ({ downloadMacUpdate: mocks.downloadMacUpdate }))

import type { WindowManager } from '../windowManager'
import { registerUpdateService } from '../updateService'

const HOUR_MS = 60 * 60 * 1000

function register(platform: NodeJS.Platform = 'win32'): void {
  vi.spyOn(process, 'platform', 'get').mockReturnValue(platform)
  registerUpdateService({
    sendToMain: mocks.sendToMain,
    getMainWindow: mocks.getMainWindow
  } as unknown as WindowManager)
}

describe('registerUpdateService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    mocks.updaterHandlers.clear()
    mocks.ipcHandlers.clear()
    mocks.autoUpdater.checkForUpdates.mockResolvedValue(null)
    mocks.autoUpdater.autoDownload = false
    mocks.autoUpdater.autoInstallOnAppQuit = true
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('automatically downloads Windows updates without installing on app quit', () => {
    register('win32')

    expect(mocks.autoUpdater.autoDownload).toBe(true)
    expect(mocks.autoUpdater.autoInstallOnAppQuit).toBe(false)
  })

  it('keeps macOS updates fully manual', () => {
    register('darwin')

    expect(mocks.autoUpdater.autoDownload).toBe(false)
    expect(mocks.autoUpdater.autoInstallOnAppQuit).toBe(false)
  })

  it('checks after startup and once per hour', async () => {
    register()

    await vi.advanceTimersByTimeAsync(3000)
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(HOUR_MS)
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('does not overlap update checks', async () => {
    let resolveCheck: (() => void) | undefined
    mocks.autoUpdater.checkForUpdates.mockImplementationOnce(
      () => new Promise((resolve) => (resolveCheck = () => resolve(null)))
    )
    register()

    await vi.advanceTimersByTimeAsync(3000 + HOUR_MS)
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)

    resolveCheck?.()
    await vi.runAllTicks()
    await vi.advanceTimersByTimeAsync(HOUR_MS)
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(2)
  })

  it('does not check while an update is downloading', async () => {
    register()
    mocks.updaterHandlers.get('download-progress')?.({ percent: 10 })

    await vi.advanceTimersByTimeAsync(3000 + HOUR_MS)
    expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled()

    mocks.updaterHandlers.get('update-downloaded')?.({ version: '2.4.1' })
    await vi.advanceTimersByTimeAsync(HOUR_MS)
    expect(mocks.autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('installs an already-downloaded Windows update only after IPC confirmation', async () => {
    register()

    await mocks.ipcHandlers.get('update:install-downloaded')?.()

    expect(mocks.autoUpdater.downloadUpdate).not.toHaveBeenCalled()
    expect(mocks.autoUpdater.quitAndInstall).toHaveBeenCalledOnce()
  })

  it('downloads, verifies, and opens the macOS installer', async () => {
    register('darwin')
    mocks.updaterHandlers.get('update-available')?.({ version: '2.4.1' })

    await mocks.ipcHandlers.get('update:download-mac-installer')?.()

    expect(mocks.downloadMacUpdate).toHaveBeenCalledWith(
      mocks.getMainWindow.mock.results[0].value,
      '2.4.1',
      expect.any(Function),
      expect.any(Function)
    )
    expect(mocks.openPath).toHaveBeenCalledWith('/tmp/hhc-presenter-2.4.1.dmg')
    expect(mocks.sendToMain).toHaveBeenCalledWith('update:status-changed', {
      status: 'installer-opened',
      version: '2.4.1'
    })
  })

  it('rejects updater actions on the wrong platform', async () => {
    register('darwin')
    expect(() => mocks.ipcHandlers.get('update:install-downloaded')?.()).toThrow('Windows')

    vi.restoreAllMocks()
    mocks.ipcHandlers.clear()
    register('win32')
    await expect(mocks.ipcHandlers.get('update:download-mac-installer')?.()).rejects.toThrow(
      'macOS'
    )
  })

  it('publishes the rounded updater download percentage', () => {
    register()
    mocks.updaterHandlers.get('download-progress')?.({ percent: 42.4 })

    expect(mocks.sendToMain).toHaveBeenCalledWith('update:status-changed', {
      status: 'downloading',
      percent: 42
    })
  })

  it('keeps the downloaded version in the status payload', () => {
    register()
    mocks.updaterHandlers.get('update-available')?.({ version: '2.4.1' })
    mocks.updaterHandlers.get('update-downloaded')?.({ version: '2.4.1' })

    expect(mocks.sendToMain).toHaveBeenLastCalledWith('update:status-changed', {
      status: 'downloaded',
      version: '2.4.1'
    })
  })
})
