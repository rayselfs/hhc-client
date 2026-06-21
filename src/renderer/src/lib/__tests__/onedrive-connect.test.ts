import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FILE_EXPLORER_ROOT_ID } from '@renderer/stores/file-explorer'
import { buildOneDriveImportPlan, loginOneDriveAccount } from '../onedrive-connect'

vi.mock('../env', () => ({
  isElectron: vi.fn(() => true),
  isWeb: vi.fn(() => false)
}))

vi.mock('@renderer/stores/settings', () => ({
  getEffectiveOneDriveClientId: () => '11111111-2222-3333-4444-555555555555',
  useSettingsStore: {
    getState: () => ({
      oneDrive: { customClientId: '' },
      defaultSyncOfflinePolicy: 'always-offline'
    })
  }
}))

vi.mock('../onedrive-auth', async () => {
  const actual = await vi.importActual<typeof import('../onedrive-auth')>('../onedrive-auth')
  return {
    ...actual,
    createOneDriveAuthRequest: vi.fn(async (input: { redirectUri: string }) => ({
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      clientId: '11111111-2222-3333-4444-555555555555',
      redirectUri: input.redirectUri,
      state: 'state-1',
      codeVerifier: 'verifier-1',
      scopes: ['offline_access', 'User.Read', 'Files.Read']
    }))
  }
})

vi.mock('../onedrive-provider', () => {
  class MockOneDriveReadonlyProvider {
    connect = vi.fn(async () => ({
      id: 'onedrive:account-1',
      providerType: 'onedrive',
      displayName: 'OneDrive - Alice',
      accountLabel: 'alice@example.com'
    }))
  }
  return {
    OneDriveReadonlyProvider: MockOneDriveReadonlyProvider
  }
})

vi.mock('../sync-db', () => ({
  deleteProviderConnection: vi.fn(async () => undefined),
  getProviderConnection: vi.fn(async () => ({
    id: 'onedrive:account-1',
    providerType: 'onedrive',
    displayName: 'OneDrive - Alice',
    accountLabel: 'alice@example.com',
    createdAt: 1,
    updatedAt: 1
  })),
  listProviderConnectionsByType: vi.fn(async () => []),
  listSyncEntriesByProviderConnection: vi.fn(async () => []),
  putSyncCursor: vi.fn(async () => undefined),
  putSyncEntry: vi.fn(async () => undefined)
}))

vi.mock('../file-explorer-db', () => ({
  openFileExplorerDB: vi.fn()
}))

vi.mock('../sync-download-storage', () => ({
  saveElectronOneDriveDownloadedContent: vi.fn(),
  saveWebOneDriveDownloadedContent: vi.fn()
}))

vi.mock('../onedrive-web-credentials', () => ({
  deleteWebOneDriveCredentials: vi.fn(async () => undefined),
  getWebOneDriveAccessToken: vi.fn(async () => 'access-token'),
  saveWebOneDriveCredentials: vi.fn(async () => undefined)
}))

vi.mock('@heroui/react/toast', () => ({
  toast: { warning: vi.fn() }
}))

vi.mock('@renderer/i18n', () => ({
  default: { t: (key: string) => key }
}))

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

describe('buildOneDriveImportPlan', () => {
  it('mounts the selected OneDrive folder instead of the account root', () => {
    const plan = buildOneDriveImportPlan({
      connectionId: 'onedrive:account-1',
      displayName: 'Drama Audio',
      rootRemoteFolderId: 'remote-folder-1',
      offlinePolicy: 'always-offline',
      existingRootFolderNames: [],
      platform: 'electron',
      remoteItems: [
        {
          remoteItemId: 'remote-folder-1',
          parentRemoteItemId: 'root',
          kind: 'folder',
          name: 'Drama Audio',
          deleted: false
        },
        {
          remoteItemId: 'child-folder-1',
          parentRemoteItemId: 'remote-folder-1',
          kind: 'folder',
          name: 'Scene 1',
          deleted: false
        },
        {
          remoteItemId: 'file-1',
          parentRemoteItemId: 'child-folder-1',
          kind: 'file',
          name: 'cue.mp4',
          mimeType: 'video/mp4',
          size: 2048,
          deleted: false
        },
        {
          remoteItemId: 'system-file',
          parentRemoteItemId: 'child-folder-1',
          kind: 'file',
          name: '.DS_Store',
          size: 100,
          deleted: false
        }
      ]
    })

    expect(plan.folders[0]).toMatchObject({
      name: 'Drama Audio',
      parentId: FILE_EXPLORER_ROOT_ID,
      syncLink: {
        remoteFolderId: 'remote-folder-1',
        providerType: 'onedrive'
      }
    })
    expect(plan.syncEntries[0]).toMatchObject({
      remoteItemId: 'remote-folder-1',
      parentRemoteItemId: null,
      kind: 'folder',
      folderId: plan.folders[0].id
    })
    expect(plan.folders).toHaveLength(2)
    expect(plan.folders[1]).toMatchObject({
      name: 'Scene 1',
      parentId: plan.folders[0].id
    })
    expect(plan.items[0]).toMatchObject({
      name: 'cue.mp4',
      parentId: plan.folders[1].id
    })
    expect(plan.items.find((item) => item.name === '.DS_Store')).toBeUndefined()
    expect(plan.items[0].id).toMatch(UUID_PATTERN)
    expect(plan.downloadableItems[0]).toMatchObject({ itemId: plan.items[0].id })
  })

  it('uses the shared media policy for Web OneDrive imports', () => {
    const plan = buildOneDriveImportPlan({
      connectionId: 'onedrive:account-1',
      displayName: 'Videos',
      rootRemoteFolderId: 'remote-folder-1',
      offlinePolicy: 'always-offline',
      existingRootFolderNames: [],
      platform: 'web',
      remoteItems: [
        {
          remoteItemId: 'remote-folder-1',
          parentRemoteItemId: 'root',
          kind: 'folder',
          name: 'Videos',
          deleted: false
        },
        {
          remoteItemId: 'mkv-file',
          parentRemoteItemId: 'remote-folder-1',
          kind: 'file',
          name: 'clip.mkv',
          mimeType: 'video/x-matroska',
          size: 100,
          deleted: false
        },
        {
          remoteItemId: 'avi-file',
          parentRemoteItemId: 'remote-folder-1',
          kind: 'file',
          name: 'legacy.avi',
          mimeType: 'video/x-msvideo',
          size: 100,
          deleted: false
        },
        {
          remoteItemId: 'system-file',
          parentRemoteItemId: 'remote-folder-1',
          kind: 'file',
          name: '.DS_Store',
          size: 100,
          deleted: false
        }
      ]
    })

    expect(plan.items.map((item) => item.name)).toEqual(['clip.mkv', 'legacy.avi'])
    expect(plan.items.find((item) => item.name === 'clip.mkv')).toMatchObject({
      mimeType: 'video/x-matroska'
    })
    expect(plan.items.find((item) => item.name === 'legacy.avi')).toMatchObject({
      url: expect.stringMatching(/^unsupported:/)
    })
    expect(plan.disabledCount).toBe(1)
  })
})

describe('loginOneDriveAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        oneDrive: {
          saveCredentials: vi.fn(async () => ({ exists: true })),
          deleteCredentials: vi.fn(async () => undefined),
          startAuthCallback: vi.fn(async () => ({
            callbackId: '11111111-1111-4111-8111-111111111111',
            redirectUri: 'http://localhost:49152/onedrive-callback'
          })),
          waitAuthCallback: vi.fn(
            async () => 'http://localhost:49152/onedrive-callback?code=code-1&state=state-1'
          ),
          exchangeAuthCode: vi.fn(async () => ({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            expiresIn: 3600,
            tokenType: 'Bearer'
          })),
          cancelAuthCallback: vi.fn(async () => undefined)
        }
      }
    })
    window.open = vi.fn()
    window.prompt = vi.fn()
    global.fetch = vi.fn(async () =>
      Response.json({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      })
    )
  })

  it('uses an app-provided callback URL instead of window.prompt in Electron', async () => {
    const callbackUrl =
      'https://login.microsoftonline.com/common/oauth2/nativeclient?code=code-1&state=state-1'

    await expect(
      loginOneDriveAccount({
        requestCallbackUrl: vi.fn(async () => callbackUrl)
      })
    ).resolves.toMatchObject({ id: 'onedrive:account-1' })

    expect(window.prompt).not.toHaveBeenCalled()
    expect(window.api.oneDrive.exchangeAuthCode).toHaveBeenCalledWith({
      clientId: '11111111-2222-3333-4444-555555555555',
      redirectUri: 'https://login.microsoftonline.com/common/oauth2/nativeclient',
      code: 'code-1',
      codeVerifier: 'verifier-1'
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses a localhost callback server for the default Electron flow', async () => {
    await expect(loginOneDriveAccount()).resolves.toMatchObject({ id: 'onedrive:account-1' })

    expect(window.api.oneDrive.startAuthCallback).toHaveBeenCalled()
    expect(window.open).toHaveBeenCalledWith(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      '_blank',
      'noopener,noreferrer'
    )
    expect(window.api.oneDrive.waitAuthCallback).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111'
    )
    expect(window.api.oneDrive.exchangeAuthCode).toHaveBeenCalledWith({
      clientId: '11111111-2222-3333-4444-555555555555',
      redirectUri: 'http://localhost:49152/onedrive-callback',
      code: 'code-1',
      codeVerifier: 'verifier-1'
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('supports Web login with the same callback flow', async () => {
    const { isElectron } = await import('../env')
    vi.mocked(isElectron).mockReturnValue(false)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: undefined
    })
    const callbackUrl = `${window.location.origin}/onedrive-callback.html?code=code-1&state=state-1`

    await expect(
      loginOneDriveAccount({
        requestCallbackUrl: vi.fn(async () => callbackUrl)
      })
    ).resolves.toMatchObject({ id: 'onedrive:account-1' })
  })

  it('opens Web OAuth with an opener so the callback page can notify the app', async () => {
    const { isElectron } = await import('../env')
    vi.mocked(isElectron).mockReturnValue(false)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: undefined
    })
    const callbackUrl = `${window.location.origin}/onedrive-callback.html?code=code-1&state=state-1`

    await loginOneDriveAccount({
      requestCallbackUrl: vi.fn(async () => callbackUrl)
    })

    expect(window.open).toHaveBeenCalledWith(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      '_blank',
      'popup,width=520,height=720'
    )
  })

  it('unblocks Web login when the OAuth popup is closed without a callback', async () => {
    vi.useFakeTimers()
    const { isElectron } = await import('../env')
    vi.mocked(isElectron).mockReturnValue(false)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: undefined
    })
    let popupClosed = false
    const popup = {
      get closed() {
        return popupClosed
      }
    } as Window
    window.open = vi.fn(() => popup)

    const login = loginOneDriveAccount()
    popupClosed = true
    await vi.advanceTimersByTimeAsync(500)

    await expect(login).resolves.toBeNull()
    vi.useRealTimers()
  })

  it('unblocks Web login when the OAuth popup cannot be opened', async () => {
    const { isElectron } = await import('../env')
    vi.mocked(isElectron).mockReturnValue(false)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: undefined
    })
    window.open = vi.fn(() => null)

    await expect(loginOneDriveAccount()).resolves.toBeNull()
  })
})
