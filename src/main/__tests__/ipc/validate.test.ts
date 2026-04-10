import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMainWindow = { id: 1 }
const mockProjectionWindow = { id: 2 }
const mockUnknownWindow = { id: 3 }

const mockWindowManager = {
  getMainWindow: vi.fn(() => mockMainWindow),
  getProjectionWindow: vi.fn(() => mockProjectionWindow)
}

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn()
  }
}))

import { BrowserWindow } from 'electron'
import {
  isKnownWindow,
  isMainWindow,
  validateTheme,
  validateTimerCommand,
  validateTimerSettings
} from '../../ipc/validate'
import type { WindowManager } from '../../windowManager'

const wm = mockWindowManager as unknown as WindowManager

function makeEvent(): Electron.IpcMainInvokeEvent {
  return { sender: {} } as Electron.IpcMainInvokeEvent
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('isKnownWindow', () => {
  it('returns true for main window', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
    expect(isKnownWindow(wm, makeEvent())).toBe(true)
  })

  it('returns true for projection window', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)
    expect(isKnownWindow(wm, makeEvent())).toBe(true)
  })

  it('returns false for unknown window', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockUnknownWindow as never)
    expect(isKnownWindow(wm, makeEvent())).toBe(false)
  })

  it('returns false when sender has no window', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(null as never)
    expect(isKnownWindow(wm, makeEvent())).toBe(false)
  })
})

describe('isMainWindow', () => {
  it('returns true for main window', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
    expect(isMainWindow(wm, makeEvent())).toBe(true)
  })

  it('returns false for projection window', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)
    expect(isMainWindow(wm, makeEvent())).toBe(false)
  })

  it('returns false for unknown window', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockUnknownWindow as never)
    expect(isMainWindow(wm, makeEvent())).toBe(false)
  })
})

describe('validateTheme', () => {
  it.each(['light', 'dark', 'system'])('returns true for "%s"', (theme) => {
    expect(validateTheme(theme)).toBe(true)
  })

  it('returns false for invalid string', () => {
    expect(validateTheme('invalid')).toBe(false)
  })

  it('returns false for non-string', () => {
    expect(validateTheme(42)).toBe(false)
  })

  it('returns false for null', () => {
    expect(validateTheme(null)).toBe(false)
  })
})

describe('validateTimerCommand', () => {
  it.each([
    'start',
    'pause',
    'resume',
    'reset',
    'setDuration',
    'addTime',
    'removeTime',
    'setMode',
    'setReminder',
    'setOvertimeMessage',
    'startStopwatch',
    'pauseStopwatch',
    'resetStopwatch'
  ])('returns true for valid command "%s"', (type) => {
    expect(validateTimerCommand({ type })).toBe(true)
  })

  it('returns false for unknown type', () => {
    expect(validateTimerCommand({ type: 'explode' })).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(validateTimerCommand('start')).toBe(false)
  })

  it('returns false for null', () => {
    expect(validateTimerCommand(null)).toBe(false)
  })

  it('returns false for missing type', () => {
    expect(validateTimerCommand({ foo: 'bar' })).toBe(false)
  })

  it('returns false for non-string type', () => {
    expect(validateTimerCommand({ type: 42 })).toBe(false)
  })
})

describe('validateTimerSettings', () => {
  const valid = {
    mode: 'timer',
    totalDuration: 300,
    reminderEnabled: false,
    reminderDuration: 60,
    reminderColor: '#ff0000',
    overtimeMessageEnabled: false,
    overtimeMessage: ''
  }

  it('returns true for valid settings', () => {
    expect(validateTimerSettings(valid)).toBe(true)
  })

  it('returns false for null', () => {
    expect(validateTimerSettings(null)).toBe(false)
  })

  it('returns false for non-object', () => {
    expect(validateTimerSettings('invalid')).toBe(false)
  })

  it('returns false for invalid mode', () => {
    expect(validateTimerSettings({ ...valid, mode: 'invalid' })).toBe(false)
  })

  it('returns false for non-string mode', () => {
    expect(validateTimerSettings({ ...valid, mode: 42 })).toBe(false)
  })

  it('returns false for negative totalDuration', () => {
    expect(validateTimerSettings({ ...valid, totalDuration: -1 })).toBe(false)
  })

  it('returns false for non-number totalDuration', () => {
    expect(validateTimerSettings({ ...valid, totalDuration: '300' })).toBe(false)
  })

  it('returns false for non-boolean reminderEnabled', () => {
    expect(validateTimerSettings({ ...valid, reminderEnabled: 'yes' })).toBe(false)
  })

  it('returns false for negative reminderDuration', () => {
    expect(validateTimerSettings({ ...valid, reminderDuration: -1 })).toBe(false)
  })

  it('returns false for non-string reminderColor', () => {
    expect(validateTimerSettings({ ...valid, reminderColor: 42 })).toBe(false)
  })

  it('returns false for non-boolean overtimeMessageEnabled', () => {
    expect(validateTimerSettings({ ...valid, overtimeMessageEnabled: 1 })).toBe(false)
  })

  it('returns false for non-string overtimeMessage', () => {
    expect(validateTimerSettings({ ...valid, overtimeMessage: null })).toBe(false)
  })
})
