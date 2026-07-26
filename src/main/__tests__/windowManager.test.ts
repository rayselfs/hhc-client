import { describe, it, expect, vi, beforeEach } from 'vitest'

const { FakeBrowserWindow } = vi.hoisted(() => {
  class FakeBrowserWindow {
    static instances: FakeBrowserWindow[] = []

    webContents = {
      setWindowOpenHandler: vi.fn(),
      on: vi.fn(),
      send: vi.fn()
    }

    loadURL = vi.fn(() => Promise.resolve())
    loadFile = vi.fn(() => Promise.resolve())
    once = vi.fn((event: string, handler: () => void) => {
      this.onceHandlers.set(event, handler)
    })
    on = vi.fn()
    isDestroyed = vi.fn(() => false)
    isMinimized = vi.fn(() => false)
    isVisible = vi.fn(() => true)
    restore = vi.fn()
    showInactive = vi.fn()
    moveTop = vi.fn()
    focus = vi.fn()
    show = vi.fn()
    setAlwaysOnTop = vi.fn()
    close = vi.fn()
    destroy = vi.fn()

    private onceHandlers = new Map<string, () => void>()

    constructor() {
      FakeBrowserWindow.instances.push(this)
    }

    emitOnce(event: string): void {
      this.onceHandlers.get(event)?.()
    }
  }

  return { FakeBrowserWindow }
})

vi.mock('electron', () => ({
  BrowserWindow: FakeBrowserWindow,
  screen: {
    getPrimaryDisplay: vi.fn(() => ({
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 }
    })),
    getAllDisplays: vi.fn(() => [
      { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
      { id: 2, bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
    ]),
    on: vi.fn()
  },
  app: {
    quit: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  optimizer: { watchWindowShortcuts: vi.fn() },
  is: { dev: false }
}))

import { WindowManager } from '../windowManager'

describe('WindowManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const instance = WindowManager.getInstance()
    instance.cleanup()
    FakeBrowserWindow.instances = []
  })

  it('getInstance returns a singleton', () => {
    const a = WindowManager.getInstance()
    const b = WindowManager.getInstance()
    expect(a).toBe(b)
  })

  it('getMainWindow returns null before creation', () => {
    const wm = WindowManager.getInstance()
    expect(wm.getMainWindow()).toBeNull()
  })

  it('getProjectionWindow returns null before creation', () => {
    const wm = WindowManager.getInstance()
    expect(wm.getProjectionWindow()).toBeNull()
  })

  it('isProjectionOpen returns false before creation', () => {
    const wm = WindowManager.getInstance()
    expect(wm.isProjectionOpen()).toBe(false)
  })

  it('sendToProjection does nothing when no projection window', () => {
    const wm = WindowManager.getInstance()
    expect(() => wm.sendToProjection('projection:message' as never, ...([] as never))).not.toThrow()
  })

  it('sendToMain does nothing when no main window', () => {
    const wm = WindowManager.getInstance()
    expect(() => wm.sendToMain('projection:opened' as never, ...([] as never))).not.toThrow()
  })

  it('closeProjection does nothing when no projection window', () => {
    const wm = WindowManager.getInstance()
    expect(() => wm.closeProjection()).not.toThrow()
  })

  it('cleanup sets both windows to null', () => {
    const wm = WindowManager.getInstance()
    wm.cleanup()
    expect(wm.getMainWindow()).toBeNull()
    expect(wm.getProjectionWindow()).toBeNull()
  })

  it('getDisplays returns all displays', () => {
    const wm = WindowManager.getInstance()
    const displays = wm.getDisplays()
    expect(displays).toHaveLength(2)
    expect(displays[0].id).toBe(1)
    expect(displays[1].id).toBe(2)
  })

  it('brings an existing projection to the top without activating or pinning it', () => {
    const wm = WindowManager.getInstance()
    wm.createProjectionWindow()
    const projection = FakeBrowserWindow.instances[0]
    projection.moveTop.mockClear()

    expect(wm.bringProjectionToFront()).toBe(true)
    expect(projection.moveTop).toHaveBeenCalledOnce()
    expect(projection.focus).not.toHaveBeenCalled()
    expect(projection.show).not.toHaveBeenCalled()
    expect(projection.setAlwaysOnTop).not.toHaveBeenCalled()
  })

  it('restores a minimized projection before moving it to the top', () => {
    const wm = WindowManager.getInstance()
    wm.createProjectionWindow()
    const projection = FakeBrowserWindow.instances[0]
    projection.isMinimized.mockReturnValue(true)

    expect(wm.bringProjectionToFront()).toBe(true)
    expect(projection.restore).toHaveBeenCalledOnce()
    expect(projection.restore.mock.invocationCallOrder[0]).toBeLessThan(
      projection.moveTop.mock.invocationCallOrder[0]
    )
  })

  it('shows a hidden projection without activation before moving it to the top', () => {
    const wm = WindowManager.getInstance()
    wm.createProjectionWindow()
    const projection = FakeBrowserWindow.instances[0]
    projection.isVisible.mockReturnValue(false)

    expect(wm.bringProjectionToFront()).toBe(true)
    expect(projection.showInactive).toHaveBeenCalledOnce()
    expect(projection.moveTop).toHaveBeenCalledOnce()
  })

  it('returns false when projection is missing or destroyed', () => {
    const wm = WindowManager.getInstance()

    expect(wm.bringProjectionToFront()).toBe(false)

    wm.createProjectionWindow()
    const projection = FakeBrowserWindow.instances[0]
    projection.isDestroyed.mockReturnValue(true)

    expect(wm.bringProjectionToFront()).toBe(false)
    expect(projection.moveTop).not.toHaveBeenCalled()
  })

  it('brings a newly ready projection forward exactly once without activation', () => {
    const wm = WindowManager.getInstance()
    wm.createProjectionWindow()
    const projection = FakeBrowserWindow.instances[0]

    projection.emitOnce('ready-to-show')

    expect(projection.showInactive).not.toHaveBeenCalled()
    expect(projection.moveTop).toHaveBeenCalledOnce()
    expect(projection.focus).not.toHaveBeenCalled()
    expect(projection.show).not.toHaveBeenCalled()
    expect(projection.setAlwaysOnTop).not.toHaveBeenCalled()
  })
})
