import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

const {
  handlers,
  mockDecryptString,
  mockEncryptString,
  mockGetSelectedStorageBackend,
  mockIsEncryptionAvailable,
  mockMkdir,
  mockNetFetch,
  mockOpenExternal,
  mockReadFile,
  mockRename,
  mockRm,
  mockWriteFile
} = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  mockDecryptString: vi.fn(),
  mockEncryptString: vi.fn(),
  mockGetSelectedStorageBackend: vi.fn(),
  mockIsEncryptionAvailable: vi.fn(),
  mockMkdir: vi.fn(),
  mockNetFetch: vi.fn(),
  mockOpenExternal: vi.fn(),
  mockReadFile: vi.fn(),
  mockRename: vi.fn(),
  mockRm: vi.fn(),
  mockWriteFile: vi.fn()
}))

const mainWindow = { id: 1 }
const projectionWindow = { id: 2 }

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/hhc-user-data') },
  BrowserWindow: { fromWebContents: vi.fn(() => mainWindow) },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler)
    })
  },
  net: { fetch: mockNetFetch },
  safeStorage: {
    decryptString: mockDecryptString,
    encryptString: mockEncryptString,
    getSelectedStorageBackend: mockGetSelectedStorageBackend,
    isEncryptionAvailable: mockIsEncryptionAvailable
  },
  shell: { openExternal: mockOpenExternal }
}))

vi.mock('node:fs', () => {
  const promises = {
    mkdir: mockMkdir,
    readFile: mockReadFile,
    rename: mockRename,
    rm: mockRm,
    writeFile: mockWriteFile
  }
  return { default: { promises }, promises }
})

import { BrowserWindow } from 'electron'
import type { HhcSession } from '@shared/hhc-auth'
import type { WindowManager } from '../../windowManager'
import { createHhcAuthService, registerHhcAuthIpc, type HhcAuthService } from '../../ipc/hhc-auth'

const credentialPath = '/tmp/hhc-user-data/hhc-auth.enc'
let disk: Buffer | null
let temporaryFiles: Map<string, Buffer>
let plaintextByCiphertext: Map<string, string>
let ciphertextSequence: number
let now: number

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function accessToken(userId = 'user-1', expiresAt = now + 60 * 60_000): string {
  const claims = Buffer.from(
    JSON.stringify({ sub: userId, roles: ['media_sync_user'], exp: expiresAt / 1000 })
  ).toString('base64url')
  return `header.${claims}.signature`
}

function tokenResponse(refreshToken: string, userId = 'user-1'): Response {
  return jsonResponse({
    access_token: accessToken(userId),
    refresh_token: refreshToken,
    expires_in: 3600,
    token_type: 'Bearer'
  })
}

function profileResponse(userId = 'user-1'): Response {
  return jsonResponse({
    id: userId,
    email: 'alice@example.com',
    first_name: ' Alice ',
    last_name: ' Chen ',
    avatar_url: 'https://account.example/avatar.png',
    roles: ['ignored-server-role']
  })
}

function bodyAt(index: number): URLSearchParams {
  const body = mockNetFetch.mock.calls[index]?.[1]?.body
  if (!(body instanceof URLSearchParams)) throw new Error('Expected form body')
  return body
}

function currentStoredRecord(): { installationId: string; refreshToken?: string } {
  if (!disk) throw new Error('Expected encrypted record')
  return JSON.parse(mockDecryptString(disk)) as {
    installationId: string
    refreshToken?: string
  }
}

function callbackFromOpenedUrl(): { kind: 'account-auth'; code: string; state: string } {
  const opened = new URL(mockOpenExternal.mock.calls.at(-1)?.[0] as string)
  return {
    kind: 'account-auth',
    code: 'authorization-code',
    state: opened.searchParams.get('state')!
  }
}

function makeEvent(): Electron.IpcMainInvokeEvent {
  return { sender: {} } as Electron.IpcMainInvokeEvent
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const mock of [
    mockDecryptString,
    mockEncryptString,
    mockGetSelectedStorageBackend,
    mockIsEncryptionAvailable,
    mockMkdir,
    mockNetFetch,
    mockOpenExternal,
    mockReadFile,
    mockRename,
    mockRm,
    mockWriteFile
  ]) {
    mock.mockReset()
  }
  handlers.clear()
  disk = null
  temporaryFiles = new Map()
  plaintextByCiphertext = new Map()
  ciphertextSequence = 0
  now = Date.UTC(2026, 7, 16, 4, 0, 0)

  mockIsEncryptionAvailable.mockReturnValue(true)
  mockGetSelectedStorageBackend.mockReturnValue('keychain')
  mockMkdir.mockResolvedValue(undefined)
  mockReadFile.mockImplementation(async (path: string) => {
    if (path === credentialPath && disk) return disk
    throw Object.assign(new Error('missing'), { code: 'ENOENT' })
  })
  mockEncryptString.mockImplementation((plaintext: string) => {
    const ciphertext = Buffer.from(`ciphertext-${++ciphertextSequence}`)
    plaintextByCiphertext.set(ciphertext.toString('hex'), plaintext)
    return ciphertext
  })
  mockDecryptString.mockImplementation((ciphertext: Buffer) => {
    const plaintext = plaintextByCiphertext.get(ciphertext.toString('hex'))
    if (!plaintext) throw new Error('Unable to decrypt')
    return plaintext
  })
  mockWriteFile.mockImplementation(
    async (path: string, value: Buffer) => void temporaryFiles.set(path, value)
  )
  mockRename.mockImplementation(async (source: string, target: string) => {
    const value = temporaryFiles.get(source)
    if (!value) throw new Error('Missing temporary credential')
    if (target === credentialPath) disk = value
    temporaryFiles.delete(source)
  })
  mockRm.mockImplementation(async (path: string) => void temporaryFiles.delete(path))
  mockOpenExternal.mockResolvedValue(undefined)
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(mainWindow as never)
})

describe('HhcAuthService authorization', () => {
  it('creates exact PKCE authorization and token forms with one stable installation id', async () => {
    const service = createHhcAuthService({ now: () => now })
    await service.begin()

    const authorize = new URL(mockOpenExternal.mock.calls[0][0] as string)
    expect(authorize.origin).toBe('https://account.alive.org.tw')
    expect(authorize.pathname).toBe('/api/account/v1/oauth/authorize')
    expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
      client_id: 'hhc-desktop',
      redirect_uri: 'librepresenter://auth/account',
      response_type: 'code',
      code_challenge_method: 'S256',
      scope: 'openid profile'
    })
    expect(authorize.searchParams.get('state')).toBeTruthy()
    expect(authorize.searchParams.get('code_challenge')).toBeTruthy()

    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-1'))
      .mockResolvedValueOnce(profileResponse())
    await expect(service.completeProtocolCallback(callbackFromOpenedUrl())).resolves.toBe(true)

    expect(mockNetFetch.mock.calls[0][0]).toBe(
      'https://account.alive.org.tw/api/account/v1/oauth/token'
    )
    const tokenBody = bodyAt(0)
    expect(Object.fromEntries(tokenBody)).toEqual({
      grant_type: 'authorization_code',
      client_id: 'hhc-desktop',
      redirect_uri: 'librepresenter://auth/account',
      code_verifier: expect.any(String),
      code: 'authorization-code',
      device_id: expect.any(String),
      device_name: expect.stringContaining('LibrePresenter Electron')
    })
    expect(createHash('sha256').update(tokenBody.get('code_verifier')!).digest('base64url')).toBe(
      authorize.searchParams.get('code_challenge')
    )
    expect(currentStoredRecord()).toEqual({
      installationId: tokenBody.get('device_id'),
      refreshToken: 'refresh-1'
    })
  })

  it('rejects a second active begin without replacing state and keeps mismatches non-destructive', async () => {
    const service = createHhcAuthService({ now: () => now })
    await service.begin()
    const callback = callbackFromOpenedUrl()

    await expect(service.begin()).rejects.toThrow('HHC sign-in is already in progress')
    await expect(
      service.completeProtocolCallback({ ...callback, state: 'wrong-state' })
    ).resolves.toBe(false)

    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-1'))
      .mockResolvedValueOnce(profileResponse())
    await expect(service.completeProtocolCallback(callback)).resolves.toBe(true)
    expect(mockOpenExternal).toHaveBeenCalledTimes(1)
  })

  it('expires state after five minutes and consumes a match before network completion', async () => {
    const service = createHhcAuthService({ now: () => now })
    await service.begin()
    const expiredCallback = callbackFromOpenedUrl()
    now += 5 * 60_000 + 1

    await expect(service.completeProtocolCallback(expiredCallback)).resolves.toBe(false)
    await expect(service.begin()).resolves.toBeUndefined()
    const activeCallback = callbackFromOpenedUrl()

    let resolveToken!: (response: Response) => void
    mockNetFetch
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (resolveToken = resolve)))
      .mockResolvedValueOnce(profileResponse())
    const completion = service.completeProtocolCallback(activeCallback)
    await expect(service.completeProtocolCallback(activeCallback)).resolves.toBe(false)
    resolveToken(tokenResponse('refresh-1'))
    await expect(completion).resolves.toBe(true)
    expect(mockNetFetch).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['unavailable encryption', false, 'keychain'],
    ['basic_text storage', true, 'basic_text']
  ])('fails closed with no write for %s', async (_label, available, backend) => {
    mockIsEncryptionAvailable.mockReturnValue(available)
    mockGetSelectedStorageBackend.mockReturnValue(backend)
    const service = createHhcAuthService({ now: () => now })

    await expect(service.begin()).rejects.toThrow('Secure credential storage is unavailable')
    expect(mockWriteFile).not.toHaveBeenCalled()
    expect(mockOpenExternal).not.toHaveBeenCalled()
  })
})

describe('HhcAuthService credentials and session', () => {
  it('writes only ciphertext through a same-directory atomic replace with mode 0600', async () => {
    const service = createHhcAuthService({ now: () => now })
    await service.begin()
    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('plaintext-refresh'))
      .mockResolvedValueOnce(profileResponse())
    await service.completeProtocolCallback(callbackFromOpenedUrl())

    const [temporaryPath, ciphertext, options] = mockWriteFile.mock.calls.at(-1)!
    expect(temporaryPath).toMatch(/^\/tmp\/hhc-user-data\/hhc-auth\.enc\./)
    expect((ciphertext as Buffer).toString()).not.toContain('plaintext-refresh')
    expect(options).toEqual({ mode: 0o600 })
    expect(mockRename).toHaveBeenLastCalledWith(temporaryPath, credentialPath)
  })

  it('cleans a failed temporary replace without deleting the prior ciphertext', async () => {
    const service = createHhcAuthService({ now: () => now })
    await service.begin()
    const priorCiphertext = disk
    mockRename.mockRejectedValueOnce(new Error('rename failed'))
    mockNetFetch.mockResolvedValueOnce(tokenResponse('refresh-1'))

    await expect(service.completeProtocolCallback(callbackFromOpenedUrl())).rejects.toThrow(
      'rename failed'
    )
    expect(disk).toBe(priorCiphertext)
    expect(mockRm).toHaveBeenCalledWith(expect.stringContaining('hhc-auth.enc.'), { force: true })
  })

  it('maps /me only after token claim validation and clears credentials on subject mismatch', async () => {
    const service = createHhcAuthService({ now: () => now })
    const listener = vi.fn()
    service.subscribe(listener)
    await service.begin()
    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-1'))
      .mockResolvedValueOnce(profileResponse())

    await service.completeProtocolCallback(callbackFromOpenedUrl())
    await expect(service.getSession()).resolves.toEqual({
      userId: 'user-1',
      displayName: 'Alice Chen',
      avatarUrl: 'https://account.example/avatar.png',
      roles: ['media_sync_user']
    })
    expect(mockNetFetch.mock.calls[1][0]).toBe('https://account.alive.org.tw/api/account/v1/me')
    expect(mockNetFetch.mock.calls[1][1].headers).toMatchObject({
      authorization: expect.stringMatching(/^Bearer /)
    })
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }))

    const mismatched = createHhcAuthService({ now: () => now })
    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-2'))
      .mockResolvedValueOnce(profileResponse('other-user'))
    await expect(mismatched.getSession()).rejects.toThrow('HHC account identity mismatch')
    expect(currentStoredRecord()).not.toHaveProperty('refreshToken')
  })

  it('keeps rotated credentials when /me fails transiently', async () => {
    const service = createHhcAuthService({ now: () => now })
    await service.begin()
    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-1'))
      .mockResolvedValueOnce(jsonResponse({}, 503))

    await expect(service.completeProtocolCallback(callbackFromOpenedUrl())).rejects.toThrow(
      'HHC account request failed'
    )
    expect(currentStoredRecord()).toMatchObject({ refreshToken: 'refresh-1' })

    mockNetFetch.mockResolvedValueOnce(profileResponse())
    await expect(service.getAccessToken()).resolves.toBeTruthy()
    expect(mockNetFetch.mock.calls[2][0]).toBe('https://account.alive.org.tw/api/account/v1/me')
  })

  it('coalesces refresh, rotates atomically, and restores the same installation id', async () => {
    const service = createHhcAuthService({ now: () => now })
    await service.begin()
    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-1'))
      .mockResolvedValueOnce(profileResponse())
    await service.completeProtocolCallback(callbackFromOpenedUrl())
    const installationId = currentStoredRecord().installationId

    now += 2 * 60 * 60_000
    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-2'))
      .mockResolvedValueOnce(profileResponse())
    const [first, second] = await Promise.all([service.getAccessToken(), service.getAccessToken()])
    expect(first).toBe(second)
    expect(mockNetFetch).toHaveBeenCalledTimes(4)
    expect(Object.fromEntries(bodyAt(2))).toEqual({
      grant_type: 'refresh_token',
      client_id: 'hhc-desktop',
      refresh_token: 'refresh-1',
      device_id: installationId,
      device_name: expect.stringContaining('LibrePresenter Electron')
    })
    expect(currentStoredRecord()).toEqual({ installationId, refreshToken: 'refresh-2' })

    const restarted = createHhcAuthService({ now: () => now })
    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-3'))
      .mockResolvedValueOnce(profileResponse())
    await expect(restarted.getSession()).resolves.toMatchObject({ userId: 'user-1' })
    expect(bodyAt(4).get('device_id')).toBe(installationId)
    expect(currentStoredRecord()).toEqual({ installationId, refreshToken: 'refresh-3' })
  })

  it('clears invalid refresh credentials while preserving the installation id', async () => {
    const service = createHhcAuthService({ now: () => now })
    await service.begin()
    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-1'))
      .mockResolvedValueOnce(profileResponse())
    await service.completeProtocolCallback(callbackFromOpenedUrl())
    const installationId = currentStoredRecord().installationId
    now += 2 * 60 * 60_000
    mockNetFetch.mockResolvedValueOnce(jsonResponse({ error: 'invalid_grant' }, 400))

    await expect(service.getAccessToken()).rejects.toThrow('HHC account request failed')
    expect(currentStoredRecord()).toEqual({ installationId })
  })

  it('revokes the refresh family and clears tokens even when remote revoke fails', async () => {
    const service = createHhcAuthService({ now: () => now })
    await service.begin()
    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-1'))
      .mockResolvedValueOnce(profileResponse())
    await service.completeProtocolCallback(callbackFromOpenedUrl())
    const installationId = currentStoredRecord().installationId
    mockNetFetch.mockResolvedValueOnce(jsonResponse({ error: 'unavailable' }, 503))

    await expect(service.signOut()).resolves.toBeUndefined()
    const revokeBody = bodyAt(2)
    expect(mockNetFetch.mock.calls[2][0]).toBe(
      'https://account.alive.org.tw/api/account/v1/oauth/revoke'
    )
    expect(Object.fromEntries(revokeBody)).toEqual({
      token: 'refresh-1',
      client_id: 'hhc-desktop',
      token_type_hint: 'refresh_token'
    })
    expect(currentStoredRecord()).toEqual({ installationId })

    await service.begin()
    expect(currentStoredRecord().installationId).toBe(installationId)
  })

  it('waits for refresh rotation before revoking during sign-out', async () => {
    const service = createHhcAuthService({ now: () => now })
    await service.begin()
    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-1'))
      .mockResolvedValueOnce(profileResponse())
    await service.completeProtocolCallback(callbackFromOpenedUrl())
    now += 2 * 60 * 60_000

    let resolveRefresh!: (response: Response) => void
    mockNetFetch.mockImplementation((url: string) => {
      if (url.endsWith('/oauth/token')) {
        return new Promise<Response>((resolve) => (resolveRefresh = resolve))
      }
      if (url.endsWith('/me')) return Promise.resolve(profileResponse())
      return Promise.resolve(jsonResponse({}))
    })
    const refresh = service.getAccessToken()
    await vi.waitFor(() => expect(mockNetFetch).toHaveBeenCalledTimes(3))
    const signOut = service.signOut()
    await Promise.resolve()
    expect(mockNetFetch).toHaveBeenCalledTimes(3)
    resolveRefresh(tokenResponse('refresh-2'))

    await expect(refresh).resolves.toBeTruthy()
    await expect(signOut).resolves.toBeUndefined()
    expect(bodyAt(4).get('token')).toBe('refresh-2')
    expect(currentStoredRecord()).not.toHaveProperty('refreshToken')
  })

  it('does not report clean sign-out when local token removal fails', async () => {
    const service = createHhcAuthService({ now: () => now })
    await service.begin()
    mockNetFetch
      .mockResolvedValueOnce(tokenResponse('refresh-1'))
      .mockResolvedValueOnce(profileResponse())
    await service.completeProtocolCallback(callbackFromOpenedUrl())
    mockNetFetch.mockResolvedValueOnce(jsonResponse({}))
    mockRename.mockRejectedValueOnce(new Error('local write failed'))

    await expect(service.signOut()).rejects.toThrow('local write failed')
    expect(currentStoredRecord()).toHaveProperty('refreshToken', 'refresh-1')
  })
})

describe('HHC auth IPC', () => {
  function fakeService(): HhcAuthService {
    return {
      begin: vi.fn().mockResolvedValue(undefined),
      completeProtocolCallback: vi.fn().mockResolvedValue(false),
      getAccessToken: vi.fn().mockResolvedValue('access-token'),
      getSession: vi.fn().mockResolvedValue(null),
      signOut: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(() => () => undefined)
    }
  }

  it.each([projectionWindow, null])(
    'rejects every HHC method outside the main window',
    async (sender) => {
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(sender as never)
      const service = fakeService()
      const wm = {
        getMainWindow: vi.fn(() => mainWindow),
        sendToMain: vi.fn()
      } as unknown as WindowManager
      registerHhcAuthIpc(wm, service)

      for (const channel of [
        'hhc-auth:begin',
        'hhc-auth:get-access-token',
        'hhc-auth:get-session',
        'hhc-auth:sign-out'
      ]) {
        await expect(handlers.get(channel)!(makeEvent())).rejects.toThrow(
          'Unauthorized HHC authentication access'
        )
      }
    }
  )

  it('forwards main-window calls and session events without exposing completion', async () => {
    const service = fakeService()
    let sessionListener: ((session: HhcSession | null) => void) | undefined
    vi.mocked(service.subscribe).mockImplementation((listener) => {
      sessionListener = listener
      return () => undefined
    })
    const sendToMain = vi.fn()
    const wm = {
      getMainWindow: vi.fn(() => mainWindow),
      sendToMain
    } as unknown as WindowManager
    registerHhcAuthIpc(wm, service)

    await expect(handlers.get('hhc-auth:begin')!(makeEvent())).resolves.toBeUndefined()
    await expect(handlers.get('hhc-auth:get-access-token')!(makeEvent())).resolves.toBe(
      'access-token'
    )
    expect(handlers.has('hhc-auth:complete')).toBe(false)

    sessionListener?.({ userId: 'user-1', displayName: 'Alice', roles: [] })
    expect(sendToMain).toHaveBeenCalledWith('hhc-auth:session-changed', {
      userId: 'user-1',
      displayName: 'Alice',
      roles: []
    })
  })
})
