import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  screen: {
    getPrimaryDisplay: vi.fn(() => ({ id: 1 })),
    getAllDisplays: vi.fn(() => [{ id: 1 }, { id: 2 }])
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
})
