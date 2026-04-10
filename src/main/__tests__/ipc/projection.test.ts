import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMainWindow = { id: 1 }
const mockProjectionWindow = { id: 2 }
const mockUnknownWindow = { id: 3 }

const mockWindowManager = {
  getMainWindow: vi.fn(() => mockMainWindow),
  getProjectionWindow: vi.fn(() => mockProjectionWindow),
  isProjectionOpen: vi.fn(() => false),
  createProjectionWindow: vi.fn(),
  closeProjection: vi.fn(),
  sendToProjection: vi.fn(),
  sendToMain: vi.fn(),
  getDisplays: vi.fn(() => [
    {
      id: 1,
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      workArea: { x: 0, y: 0, width: 1920, height: 1040 },
      scaleFactor: 1
    }
  ])
}

vi.mock('electron', () => {
  const handleHandlers = new Map<string, (...args: unknown[]) => unknown>()
  const onHandlers = new Map<string, (...args: unknown[]) => void>()
  return {
    BrowserWindow: {
      fromWebContents: vi.fn()
    },
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handleHandlers.set(channel, handler)
      }),
      on: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
        onHandlers.set(channel, handler)
      }),
      _getHandler: (channel: string) => handleHandlers.get(channel),
      _getOnHandler: (channel: string) => onHandlers.get(channel),
      _clearHandlers: () => {
        handleHandlers.clear()
        onHandlers.clear()
      }
    }
  }
})

import { BrowserWindow, ipcMain } from 'electron'
import type { WindowManager } from '../../windowManager'

const wm = mockWindowManager as unknown as WindowManager

function makeEvent(): Electron.IpcMainInvokeEvent {
  return { sender: {} } as Electron.IpcMainInvokeEvent
}

type ExtendedIpcMain = typeof ipcMain & {
  _getHandler: (c: string) => (...args: unknown[]) => unknown
  _getOnHandler: (c: string) => (...args: unknown[]) => void
  _clearHandlers: () => void
}

function getHandler(channel: string): (...args: unknown[]) => unknown {
  return (ipcMain as ExtendedIpcMain)._getHandler(channel)
}

function getOnHandler(channel: string): (...args: unknown[]) => void {
  return (ipcMain as ExtendedIpcMain)._getOnHandler(channel)
}

beforeEach(async () => {
  vi.clearAllMocks()
  ;(ipcMain as ExtendedIpcMain)._clearHandlers()

  const { registerProjectionHandlers } = await import('../../ipc/projection')
  registerProjectionHandlers(wm)
})

describe('projection:check', () => {
  it('known window returns { exists: true } when projection is open', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
    mockWindowManager.isProjectionOpen.mockReturnValue(true)
    const result = getHandler('projection:check')(makeEvent())
    expect(result).toEqual({ exists: true })
  })

  it('known window returns { exists: false } when projection is closed', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
    mockWindowManager.isProjectionOpen.mockReturnValue(false)
    const result = getHandler('projection:check')(makeEvent())
    expect(result).toEqual({ exists: false })
  })

  it('unknown window returns { exists: false }', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockUnknownWindow as never)
    const result = getHandler('projection:check')(makeEvent())
    expect(result).toEqual({ exists: false })
  })
})

describe('projection:ensure', () => {
  it('main window creates projection and returns { created: true }', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
    mockWindowManager.isProjectionOpen.mockReturnValue(false)
    const result = getHandler('projection:ensure')(makeEvent())
    expect(result).toEqual({ created: true })
    expect(mockWindowManager.createProjectionWindow).toHaveBeenCalledOnce()
  })

  it('main window returns { created: false } if already open', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
    mockWindowManager.isProjectionOpen.mockReturnValue(true)
    const result = getHandler('projection:ensure')(makeEvent())
    expect(result).toEqual({ created: false })
    expect(mockWindowManager.createProjectionWindow).not.toHaveBeenCalled()
  })

  it('non-main window returns { created: false }', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)
    const result = getHandler('projection:ensure')(makeEvent())
    expect(result).toEqual({ created: false })
  })
})

describe('projection:close', () => {
  it('main window closes projection and returns { closed: true }', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
    const result = getHandler('projection:close')(makeEvent())
    expect(result).toEqual({ closed: true })
    expect(mockWindowManager.closeProjection).toHaveBeenCalledOnce()
  })

  it('non-main window returns { closed: false }', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)
    const result = getHandler('projection:close')(makeEvent())
    expect(result).toEqual({ closed: false })
    expect(mockWindowManager.closeProjection).not.toHaveBeenCalled()
  })
})

describe('projection:send', () => {
  it('main window forwards to sendToProjection', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
    const handler = getOnHandler('projection:send')
    handler(makeEvent(), 'timer:tick', { data: 'test' })
    expect(mockWindowManager.sendToProjection).toHaveBeenCalledWith(
      'projection:message',
      'timer:tick',
      { data: 'test' }
    )
  })

  it('non-main window does NOT forward', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)
    const handler = getOnHandler('projection:send')
    handler(makeEvent(), 'timer:tick', { data: 'test' })
    expect(mockWindowManager.sendToProjection).not.toHaveBeenCalled()
  })
})

describe('projection:send-to-main', () => {
  it('known window forwards to sendToMain', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)
    const handler = getOnHandler('projection:send-to-main')
    handler(makeEvent(), '__system:ready', null)
    expect(mockWindowManager.sendToMain).toHaveBeenCalledWith(
      'projection:message',
      '__system:ready',
      null
    )
  })

  it('unknown window does NOT forward', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockUnknownWindow as never)
    const handler = getOnHandler('projection:send-to-main')
    handler(makeEvent(), '__system:ready', null)
    expect(mockWindowManager.sendToMain).not.toHaveBeenCalled()
  })
})

describe('projection:get-displays', () => {
  it('main window returns display metadata', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
    const result = getHandler('projection:get-displays')(makeEvent())
    expect(result).toEqual([
      {
        id: 1,
        bounds: { x: 0, y: 0, width: 1920, height: 1080 },
        workArea: { x: 0, y: 0, width: 1920, height: 1040 },
        scaleFactor: 1
      }
    ])
  })

  it('non-main window returns empty array', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)
    const result = getHandler('projection:get-displays')(makeEvent())
    expect(result).toEqual([])
  })
})
