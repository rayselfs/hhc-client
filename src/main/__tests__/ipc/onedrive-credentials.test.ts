import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handleHandlers,
  mockMkdir,
  mockReadFile,
  mockWriteFile,
  mockRename,
  mockRm,
  mockNetFetch,
  mockEncryptString,
  mockDecryptString
} = vi.hoisted(() => ({
  handleHandlers: new Map<string, (...args: unknown[]) => unknown>(),
  mockMkdir: vi.fn(),
  mockReadFile: vi.fn(),
  mockWriteFile: vi.fn(),
  mockRename: vi.fn(),
  mockRm: vi.fn(),
  mockNetFetch: vi.fn(),
  mockEncryptString: vi.fn(),
  mockDecryptString: vi.fn()
}))

const mockMainWindow = { id: 1, show: vi.fn(), focus: vi.fn() }
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
  net: {
    fetch: mockNetFetch
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
import {
  handleOneDriveAuthCallbackUrl,
  registerOneDriveCredentialHandlers
} from '../../ipc/onedrive-credentials'

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
  mockMkdir.mockReset()
  mockReadFile.mockReset()
  mockWriteFile.mockReset()
  mockRename.mockReset()
  mockRm.mockReset()
  mockNetFetch.mockReset()
  mockEncryptString.mockReset()
  mockDecryptString.mockReset()
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
  mockRename.mockResolvedValue(undefined)
  mockRm.mockResolvedValue(undefined)
  mockNetFetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        scope: 'offline_access User.Read Files.Read',
        token_type: 'Bearer'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  )
  mockReadFile.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }))
  mockEncryptString.mockImplementation((value: string) => Buffer.from(`encrypted:${value}`))
  mockDecryptString.mockImplementation((value: Buffer) =>
    value.toString('utf8').replace(/^encrypted:/, '')
  )
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockMainWindow as never)
  registerOneDriveCredentialHandlers(wm)
})

describe('OneDrive credential IPC', () => {
  it('rejects non-main window access', async () => {
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mockProjectionWindow as never)

    await expect(
      getHandler('onedrive:get-credential-status')(makeEvent(), 'onedrive:account-1')
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

  it('refreshes an access token without returning refresh token material', async () => {
    mockReadFile.mockResolvedValueOnce(
      Buffer.from(
        `encrypted:${JSON.stringify({
          connectionId: 'onedrive:account-1',
          refreshToken: 'old-refresh-token',
          updatedAt: 1
        })}`
      )
    )

    const result = (await getHandler('onedrive:get-access-token')(makeEvent(), {
      connectionId: 'onedrive:account-1',
      clientId: '4f4c2f2c-8f2a-4c4b-9d2e-8c3a7d638c02'
    })) as { accessToken: string; expiresAt?: number; scope?: string; tokenType?: 'Bearer' }

    expect(result).toMatchObject({
      accessToken: 'new-access-token',
      scope: 'offline_access User.Read Files.Read',
      tokenType: 'Bearer'
    })
    expect(result.expiresAt).toBeGreaterThan(Date.now())
    expect(JSON.stringify(result)).not.toContain('new-refresh-token')
    expect(JSON.stringify(result)).not.toContain('old-refresh-token')

    const [, init] = mockNetFetch.mock.calls[0]
    expect(mockNetFetch.mock.calls[0][0]).toBe(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    )
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(URLSearchParams)
    expect(init.body.get('grant_type')).toBe('refresh_token')
    expect(init.body.get('client_id')).toBe('4f4c2f2c-8f2a-4c4b-9d2e-8c3a7d638c02')
    expect(init.body.get('refresh_token')).toBe('old-refresh-token')
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('onedrive%3Aaccount-1.enc.'),
      expect.any(Buffer)
    )
  })

  it('completes auth in main without returning token material', async () => {
    mockNetFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
            scope: 'offline_access User.Read Files.Read',
            token_type: 'Bearer'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'account-1',
            displayName: 'Alice',
            userPrincipalName: 'alice@example.com'
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )

    const result = (await getHandler('onedrive:complete-auth')(makeEvent(), {
      clientId: '4f4c2f2c-8f2a-4c4b-9d2e-8c3a7d638c02',
      redirectUri: 'librepresenter://auth/onedrive',
      code: 'code-1',
      codeVerifier: 'verifier-1'
    })) as {
      id: string
      providerType: 'onedrive'
      displayName: string
      accountLabel?: string
    }

    expect(result).toMatchObject({
      id: 'onedrive:account-1',
      providerType: 'onedrive',
      displayName: 'OneDrive - Alice',
      accountLabel: 'alice@example.com'
    })
    expect(JSON.stringify(result)).not.toContain('new-access-token')
    expect(JSON.stringify(result)).not.toContain('new-refresh-token')

    const [, init] = mockNetFetch.mock.calls[0]
    expect(mockNetFetch.mock.calls[0][0]).toBe(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token'
    )
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(URLSearchParams)
    expect(init.body.get('grant_type')).toBe('authorization_code')
    expect(init.body.get('redirect_uri')).toBe('librepresenter://auth/onedrive')
    expect(init.body.get('code')).toBe('code-1')
    expect(init.body.get('code_verifier')).toBe('verifier-1')
    expect(mockNetFetch.mock.calls[1][0]).toBe('https://graph.microsoft.com/v1.0/me')
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('onedrive%3Aaccount-1.enc.'),
      expect.any(Buffer)
    )
  })

  it('rejects access token refresh when credential is missing', async () => {
    await expect(
      getHandler('onedrive:get-access-token')(makeEvent(), {
        connectionId: 'onedrive:account-1',
        clientId: '4f4c2f2c-8f2a-4c4b-9d2e-8c3a7d638c02'
      })
    ).rejects.toThrow('OneDrive credentials not found')
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

  it('returns the custom protocol auth redirect URI', async () => {
    await expect(getHandler('onedrive:get-auth-redirect-uri')(makeEvent())).resolves.toBe(
      'librepresenter://auth/onedrive'
    )
  })

  it('resolves auth callback from the custom protocol URL', async () => {
    const waiting = getHandler('onedrive:wait-auth-callback')(makeEvent()) as Promise<string | null>

    handleOneDriveAuthCallbackUrl('librepresenter://auth/onedrive?code=code-1&state=state-1', wm)

    await expect(waiting).resolves.toBe('librepresenter://auth/onedrive?code=code-1&state=state-1')
    expect(mockMainWindow.show).toHaveBeenCalled()
    expect(mockMainWindow.focus).toHaveBeenCalled()
  })
})
