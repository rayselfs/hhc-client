import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { registerAppProtocol } from '../app-protocol'

const electronMocks = vi.hoisted(() => ({
  setAsDefaultProtocolClient: vi.fn(() => true)
}))

vi.mock('electron', () => ({ app: electronMocks }))

const originalPlatform = process.platform
const originalArgv = process.argv
const originalExecPath = process.execPath
const originalDefaultApp = process.defaultApp

function setProcessProperty(
  key: 'platform' | 'argv' | 'execPath' | 'defaultApp',
  value: unknown
): void {
  Object.defineProperty(process, key, { configurable: true, value })
}

beforeEach(() => {
  electronMocks.setAsDefaultProtocolClient.mockClear()
})

afterEach(() => {
  setProcessProperty('platform', originalPlatform)
  setProcessProperty('argv', originalArgv)
  setProcessProperty('execPath', originalExecPath)
  setProcessProperty('defaultApp', originalDefaultApp)
})

describe('HHC Presenter protocol registration', () => {
  it('registers the current macOS development bundle without unsupported argv', () => {
    setProcessProperty('platform', 'darwin')
    setProcessProperty('defaultApp', true)
    setProcessProperty('argv', ['electron', '/repo'])

    registerAppProtocol()

    expect(electronMocks.setAsDefaultProtocolClient).toHaveBeenCalledWith('hhc-presenter')
  })

  it('preserves the Windows development executable and app path registration', () => {
    setProcessProperty('platform', 'win32')
    setProcessProperty('defaultApp', true)
    setProcessProperty('execPath', 'C:\\Electron\\electron.exe')
    setProcessProperty('argv', ['electron.exe', 'C:\\repo'])

    registerAppProtocol()

    expect(electronMocks.setAsDefaultProtocolClient).toHaveBeenCalledWith(
      'hhc-presenter',
      'C:\\Electron\\electron.exe',
      ['C:\\repo']
    )
  })
})
