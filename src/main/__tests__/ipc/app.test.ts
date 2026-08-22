import { beforeEach, describe, expect, it, vi } from 'vitest'
import path from 'path'

const { ipcHandlers, protocolHandlers, mockReadFileSync, mockRmSync, mockClearData } = vi.hoisted(
  () => ({
    ipcHandlers: new Map<string, (...args: unknown[]) => unknown>(),
    protocolHandlers: new Map<string, (request: Request) => Response>(),
    mockReadFileSync: vi.fn(),
    mockRmSync: vi.fn(),
    mockClearData: vi.fn()
  })
)

const mockMainWindow = { id: 1 }
const mockProjectionWindow = { id: 2 }
const mockWindowManager = {
  getMainWindow: vi.fn(() => mockMainWindow),
  getProjectionWindow: vi.fn(() => mockProjectionWindow),
  confirmMainWindowClose: vi.fn(() => true)
}

vi.mock('electron', () => ({
  app: { relaunch: vi.fn(), exit: vi.fn(), getPath: vi.fn(() => '/tmp/hhc-user-data') },
  BrowserWindow: { fromWebContents: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler)
    })
  },
  session: { defaultSession: { clearData: mockClearData } },
  protocol: {
    handle: vi.fn((scheme: string, handler: (request: Request) => Response) => {
      protocolHandlers.set(scheme, handler)
    })
  }
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readdirSync: vi.fn(() => []),
    readFileSync: mockReadFileSync,
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(),
    statSync: vi.fn(),
    renameSync: vi.fn(),
    rmSync: mockRmSync
  }
}))

vi.mock('https', () => ({
  default: {
    request: vi.fn(),
    get: vi.fn()
  }
}))

vi.mock('@electron-toolkit/utils', () => ({
  is: { dev: false }
}))

import { BrowserWindow } from 'electron'
import type { WindowManager } from '../../windowManager'
import { registerAppIpc, registerLocalModelProtocol } from '../../ipc/app'

const wm = mockWindowManager as unknown as WindowManager

function makeEvent(): Electron.IpcMainInvokeEvent {
  return { sender: {} } as Electron.IpcMainInvokeEvent
}

beforeEach(() => {
  vi.clearAllMocks()
  mockClearData.mockResolvedValue(undefined)
  ipcHandlers.clear()
  protocolHandlers.clear()
  registerAppIpc(wm)
  registerLocalModelProtocol()
})

describe('model IPC security', () => {
  it('clears native uploaded files from app user data', async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)

    await ipcHandlers.get('app:clear-user-data')!(makeEvent())

    expect(mockRmSync).toHaveBeenCalledWith(path.join('/tmp/hhc-user-data', 'native-files'), {
      force: true,
      recursive: true
    })
    expect(mockClearData).toHaveBeenCalledWith()
  })

  it('rejects relative model directories', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)

    expect(() => ipcHandlers.get('app:set-model-dir')!(makeEvent(), '../models')).toThrow(
      'Invalid model directory'
    )
  })

  it('rejects model directory updates from non-main windows', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)

    expect(ipcHandlers.get('app:set-model-dir')!(makeEvent(), '/models')).toBeUndefined()
  })

  it('serves only files contained by the authorized model directory', async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
    await ipcHandlers.get('app:set-model-dir')!(makeEvent(), '/models')
    mockReadFileSync.mockReturnValue(Buffer.from('model'))
    const handler = protocolHandlers.get('local-model')!

    const valid = handler(new Request('local-model://model/whisper/config.json'))
    expect(valid.status).toBe(200)
    expect(mockReadFileSync).toHaveBeenCalledWith(path.resolve('/models/whisper/config.json'))

    mockReadFileSync.mockClear()
    const traversal = handler(new Request('local-model://model/..%2Fsecret.txt'))
    expect(traversal.status).toBe(400)
    expect(mockReadFileSync).not.toHaveBeenCalled()
  })
})

describe('main window close IPC', () => {
  it('confirms a pending close request from the main window', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)

    expect(ipcHandlers.get('app:confirm-close')!(makeEvent())).toEqual({ closing: true })
    expect(mockWindowManager.confirmMainWindowClose).toHaveBeenCalledOnce()
  })

  it('rejects close confirmation from the projection window', () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)

    expect(ipcHandlers.get('app:confirm-close')!(makeEvent())).toEqual({ closing: false })
    expect(mockWindowManager.confirmMainWindowClose).not.toHaveBeenCalled()
  })
})
