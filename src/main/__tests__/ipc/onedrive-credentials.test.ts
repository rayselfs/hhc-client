import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleHandlers,
  mockMkdir,
  mockReadFile,
  mockWriteFile,
  mockRename,
  mockRm,
  mockEncryptString,
  mockDecryptString
} = vi.hoisted(() => ({
  handleHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  mockMkdir: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockRename: vi.fn(),
  mockRm: vi.fn(),
  mockEncryptString: vi.fn(),
  mockDecryptString: vi.fn()
}))

const mockMainWindow = { id: 1 }
const mockProjectionWindow = { id: 2 }
const mockWindowManager = {
  getMainWindow: vi.fn(() => mockMainWindow)
}

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/hhc-user-data')
  },
  BrowserWindow: {
    fromWebContents: vi.fn()
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handleHandlers.set(channel, handler)
    })
  },
  safeStorage: {
    encryptString: mockEncryptString,
    decryptString: mockDecryptString
  }
}))

vi.mock('fs', () => {
  const promises = {
    mkdir: mockMkdir,
    readFile: mockReadFile,
    writeFile: mockWriteFile,
    rename: mockRename,
    rm: mockRm
  }
  return { default: { promises }, promises }
})

import { BrowserWindow } from 'electron'
import type { WindowManager } from '../../windowManager'
import { registerOneDriveCredentialHandlers } from '../../ipc/onedrive-credentials'

const wm = mockWindowManager as unknown as WindowManager

function makeEvent(): Electron.IpcMainInvokeEvent {
  return { sender: {} } as Electron.IpcMainInvokeEvent
}

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const handler = handleHandlers.get(channel)
  if (!handler) throw new Error(`Missing IPC handler: ${channel}`)
  return handler
}

beforeEach(() => {
  vi.clearAllMocks()
  handleHandlers.clear()
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
  mockRename.mockResolvedValue(undefined)
  mockRm.mockResolvedValue(undefined)
  mockReadFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
  mockEncryptString.mockImplementation((value: string) => Buffer.from(`encrypted:${value}`))
  mockDecryptString.mockImplementation((value: Buffer) =>
    value.toString('utf8').replace(/^encrypted:/, '')
  )
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
  registerOneDriveCredentialHandlers(wm)
})

describe('OneDrive credential IPC', () => {
  it('saves encrypted credentials and returns only status', async () => {
    const result = await getHandler('onedrive:save-credentials')(makeEvent(), {
      connectionId: 'onedrive:account-1',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 1000,
      scope: 'offline_access User.Read Files.Read',
      tokenType: 'Bearer'
    })

    expect(result).toEqual({
      hasRefreshToken: true,
      expiresAt: 1000,
      scope: 'offline_access User.Read Files.Read'
    })
    expect(JSON.stringify(result)).not.toContain('refresh-token')
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('onedrive%3Aaccount-1.enc.'),
      expect.any(Buffer)
    )
    expect(mockRename).toHaveBeenCalledWith(
      expect.stringContaining('onedrive%3Aaccount-1.enc.'),
      '/tmp/hhc-user-data/onedrive-credentials/onedrive%3Aaccount-1.enc'
    )
  })

  it('rejects non-main window access', async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)

    await expect(
      getHandler('onedrive:save-credentials')(makeEvent(), {
        connectionId: 'onedrive:account-1',
        refreshToken: 'refresh-token'
      })
    ).rejects.toThrow('Unauthorized OneDrive credential access')
  })

  it.each(['../escape', 'onedrive:../escape', 'onedrive:bad/slash', 'not-onedrive'])(
    'rejects invalid connection id %s',
    async (connectionId) => {
      await expect(
        getHandler('onedrive:get-credential-status')(makeEvent(), connectionId)
      ).rejects.toThrow('Invalid OneDrive connection id')
    }
  )

  it('reads credential status without returning token material', async () => {
    mockReadFile.mockResolvedValueOnce(
      Buffer.from(
        `encrypted:${JSON.stringify({
          connectionId: 'onedrive:account-1',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresAt: 1000,
          scope: 'offline_access User.Read Files.Read',
          updatedAt: 1
        })}`
      )
    )

    const result = await getHandler('onedrive:get-credential-status')(
      makeEvent(),
      'onedrive:account-1'
    )

    expect(result).toEqual({
      hasRefreshToken: true,
      expiresAt: 1000,
      scope: 'offline_access User.Read Files.Read'
    })
    expect(JSON.stringify(result)).not.toContain('refresh-token')
    expect(JSON.stringify(result)).not.toContain('access-token')
  })

  it('returns missing status when credential file does not exist', async () => {
    await expect(
      getHandler('onedrive:get-credential-status')(makeEvent(), 'onedrive:account-1')
    ).resolves.toEqual({ hasRefreshToken: false })
  })

  it('deletes credentials by validated connection id', async () => {
    await expect(
      getHandler('onedrive:delete-credentials')(makeEvent(), 'onedrive:account-1')
    ).resolves.toBeUndefined()

    expect(mockRm).toHaveBeenCalledWith(
      '/tmp/hhc-user-data/onedrive-credentials/onedrive%3Aaccount-1.enc',
      { force: true }
    )
  })
})
