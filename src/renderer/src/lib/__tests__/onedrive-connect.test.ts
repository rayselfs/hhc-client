import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FILE_EXPLORER_ROOT_ID } from '@renderer/stores/file-explorer'
import {
  buildOneDriveImportPlan,
  importOneDriveFolder,
  loginOneDriveAccount,
  refreshOneDriveFolder,
  scanOneDriveFolder
} from '../onedrive-connect'
import type { OneDriveReadonlyProvider } from '../onedrive-provider'
import { openFileExplorerDB } from '../file-explorer-db'
import { refreshImportedMediaAssets } from '../local-sync-import'
import { listProviderConnectionsByType } from '../sync-db'
import { resetSyncDownloadQueueForTests } from '../sync-download-queue'

const providerMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  initialScan: vi.fn(),
  downloadContent: vi.fn()
}))

const fileStoreMocks = vi.hoisted(() => ({
  state: {
    folders: {},
    items: {},
    _childFoldersByParent: {},
    _itemsByParent: {},
    _foldersArray: [],
    _itemsArray: [],
    loadedParents: new Set<string>(),
    initialize: vi.fn(async () => undefined),
    getChildFolders: vi.fn(() => [])
  },
  setState: vi.fn()
}))

vi.mock('../env', () => ({
  isElectron: vi.fn(() => true),
  isWeb: vi.fn(() => false)
}))

vi.mock('@renderer/stores/file-explorer', () => ({
  FILE_EXPLORER_ROOT_ID: 'root',
  useFileExplorerStore: {
    getState: () => fileStoreMocks.state,
    setState: fileStoreMocks.setState
  }
}))

vi.mock('@renderer/stores/settings', () => ({
  getEffectiveOneDriveClientId: () => '11111111-2222-3333-4444-555555555555',
  useSettingsStore: {
    getState: () => ({ defaultSyncOfflinePolicy: 'always-offline' })
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
    connect = providerMocks.connect
    initialScan = providerMocks.initialScan
    downloadContent = providerMocks.downloadContent
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
  getSyncCursor: vi.fn(async () => undefined),
  getSyncEntryByRemoteItem: vi.fn(async () => undefined),
  listProviderConnectionsByType: vi.fn(async () => []),
  listSyncEntriesByProviderConnection: vi.fn(async () => []),
  putProviderConnection: vi.fn(async (record) => ({
    ...record,
    createdAt: 1,
    updatedAt: 1
  })),
  putSyncCursor: vi.fn(async () => undefined),
  putSyncEntry: vi.fn(async () => undefined)
}))

vi.mock('../file-explorer-db', () => ({
  collectAvailableFileBlobIds: vi.fn(async (records: Array<{ id: string }>) => {
    return new Set(records.map((record) => record.id))
  }),
  getFileBlobRecord: vi.fn(async () => undefined),
  openFileExplorerDB: vi.fn()
}))

vi.mock('../local-sync-import', () => ({
  refreshImportedMediaAssets: vi.fn(async () => undefined)
}))

vi.mock('../sync-download-storage', () => ({
  isSyncStorageLimitError: vi.fn(() => false),
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

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
} {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetSyncDownloadQueueForTests()
  fileStoreMocks.state.folders = {}
  fileStoreMocks.state.items = {}
  fileStoreMocks.state._childFoldersByParent = {}
  fileStoreMocks.state._itemsByParent = {}
  fileStoreMocks.state._foldersArray = []
  fileStoreMocks.state._itemsArray = []
  fileStoreMocks.state.loadedParents = new Set()
  fileStoreMocks.state.getChildFolders.mockReturnValue([])
  fileStoreMocks.setState.mockImplementation((updater: unknown) => {
    const next =
      typeof updater === 'function'
        ? (updater as (state: typeof fileStoreMocks.state) => Partial<typeof fileStoreMocks.state>)(
            fileStoreMocks.state
          )
        : updater
    if (typeof next === 'object' && next !== null) Object.assign(fileStoreMocks.state, next)
  })
  providerMocks.connect.mockResolvedValue({
    id: 'onedrive:account-1',
    providerType: 'onedrive',
    displayName: 'OneDrive - Alice',
    accountLabel: 'alice@example.com'
  })
  vi.mocked(openFileExplorerDB).mockResolvedValue({
    transaction: () => ({
      objectStore: () => ({
        put: vi.fn(async () => undefined)
      }),
      done: Promise.resolve()
    })
  } as never)
})

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
    const fileEntry = plan.syncEntries.find((entry) => entry.remoteItemId === 'file-1')
    expect(fileEntry).toMatchObject({
      itemId: plan.items[0].id,
      status: 'queued'
    })
    expect(fileEntry).not.toHaveProperty('blobId')
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
          remoteItemId: 'psd-file',
          parentRemoteItemId: 'remote-folder-1',
          kind: 'file',
          name: 'layout.psd',
          mimeType: 'image/vnd.adobe.photoshop',
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
    expect(plan.items.find((item) => item.name === 'layout.psd')).toBeUndefined()
    expect(plan.items.find((item) => item.name === 'clip.mkv')).toMatchObject({
      mimeType: 'video/x-matroska'
    })
    const mkvEntry = plan.syncEntries.find((entry) => entry.remoteItemId === 'mkv-file')
    expect(mkvEntry).toMatchObject({
      itemId: plan.items.find((item) => item.name === 'clip.mkv')?.id,
      status: 'queued'
    })
    expect(mkvEntry).not.toHaveProperty('blobId')
    expect(plan.items.find((item) => item.name === 'legacy.avi')).toMatchObject({
      url: expect.stringMatching(/^unsupported:/)
    })
    expect(plan.syncEntries.find((entry) => entry.remoteItemId === 'avi-file')).toMatchObject({
      status: 'remote-only'
    })
    expect(plan.disabledCount).toBe(1)
  })
})

describe('scanOneDriveFolder', () => {
  it('starts from incremental changes when a cursor is available', async () => {
    const provider = {
      initialScan: vi.fn(),
      incrementalChanges: vi.fn().mockResolvedValueOnce({
        items: [
          {
            remoteItemId: 'file-1',
            parentRemoteItemId: 'folder-1',
            kind: 'file',
            name: 'one.mp4'
          }
        ],
        nextCursor: 'cursor-2',
        hasMore: false
      })
    } as unknown as OneDriveReadonlyProvider

    await expect(
      scanOneDriveFolder(provider, 'connection-1', 'folder-1', 'cursor-1')
    ).resolves.toMatchObject({
      usedCursor: true,
      nextCursor: 'cursor-2',
      remoteItems: [expect.objectContaining({ remoteItemId: 'file-1' })]
    })
    expect(provider.initialScan).not.toHaveBeenCalled()
    expect(provider.incrementalChanges).toHaveBeenCalledWith({
      providerConnectionId: 'connection-1',
      remoteFolderId: 'folder-1',
      cursor: 'cursor-1'
    })
  })
})

describe('refreshOneDriveFolder', () => {
  it('coalesces concurrent refreshes for the same root folder', async () => {
    const scan = deferred<{ items: []; nextCursor: string; hasMore: false }>()
    const rootFolder = {
      id: 'onedrive-root',
      name: 'OneDrive',
      parentId: FILE_EXPLORER_ROOT_ID,
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerConnectionId: 'onedrive:account-1',
        remoteFolderId: 'remote-folder-1',
        providerType: 'onedrive' as const,
        offlinePolicy: 'always-offline' as const
      }
    }
    vi.mocked(openFileExplorerDB).mockResolvedValue({
      getAll: vi.fn(async (store: string) => {
        if (store === 'folder-records') return [rootFolder]
        return []
      }),
      transaction: () => ({
        objectStore: () => ({
          delete: vi.fn(async () => undefined),
          get: vi.fn(async () => undefined),
          getAll: vi.fn(async () => []),
          put: vi.fn(async () => undefined)
        }),
        done: Promise.resolve()
      })
    } as never)
    providerMocks.initialScan.mockReturnValue(scan.promise)

    const first = refreshOneDriveFolder('onedrive-root')
    const second = refreshOneDriveFolder('onedrive-root')

    await vi.waitFor(() => expect(providerMocks.initialScan).toHaveBeenCalled())
    expect(providerMocks.initialScan).toHaveBeenCalledTimes(1)

    scan.resolve({ items: [], nextCursor: 'cursor-1', hasMore: false })
    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
  })
})

describe('importOneDriveFolder', () => {
  it('returns after linking the folder without waiting for background downloads', async () => {
    vi.mocked(listProviderConnectionsByType).mockResolvedValueOnce([
      {
        id: 'onedrive:account-1',
        providerType: 'onedrive',
        displayName: 'OneDrive - Alice',
        createdAt: 1,
        updatedAt: 1
      }
    ])
    providerMocks.initialScan.mockResolvedValueOnce({
      items: [
        {
          remoteItemId: 'remote-folder-1',
          parentRemoteItemId: 'root',
          kind: 'folder',
          name: 'Media',
          deleted: false
        },
        {
          remoteItemId: 'file-1',
          parentRemoteItemId: 'remote-folder-1',
          kind: 'file',
          name: 'one.png',
          mimeType: 'image/png',
          size: 100,
          deleted: false
        }
      ],
      nextCursor: 'cursor-1',
      hasMore: false
    })
    const download = deferred<{ blobId: string; size: number; mimeType: string }>()
    providerMocks.downloadContent.mockReturnValue(download.promise)

    const result = await importOneDriveFolder({
      remoteItemId: 'remote-folder-1',
      parentRemoteItemId: null,
      name: 'Media'
    })

    expect(result).toMatchObject({ itemCount: 1, downloadedCount: 0 })
    await vi.waitFor(() => expect(providerMocks.downloadContent).toHaveBeenCalledTimes(1))

    download.resolve({ blobId: 'file-1', size: 100, mimeType: 'image/png' })
    await vi.waitFor(() => expect(refreshImportedMediaAssets).toHaveBeenCalledTimes(1))
  })

  it('refreshes media assets after each downloaded file', async () => {
    vi.mocked(listProviderConnectionsByType).mockResolvedValueOnce([
      {
        id: 'onedrive:account-1',
        providerType: 'onedrive',
        displayName: 'OneDrive - Alice',
        createdAt: 1,
        updatedAt: 1
      }
    ])
    providerMocks.initialScan.mockResolvedValueOnce({
      items: [
        {
          remoteItemId: 'remote-folder-1',
          parentRemoteItemId: 'root',
          kind: 'folder',
          name: 'Media',
          deleted: false
        },
        {
          remoteItemId: 'file-1',
          parentRemoteItemId: 'remote-folder-1',
          kind: 'file',
          name: 'one.png',
          mimeType: 'image/png',
          size: 100,
          deleted: false
        },
        {
          remoteItemId: 'file-2',
          parentRemoteItemId: 'remote-folder-1',
          kind: 'file',
          name: 'two.png',
          mimeType: 'image/png',
          size: 100,
          deleted: false
        }
      ],
      nextCursor: 'cursor-1',
      hasMore: false
    })
    providerMocks.downloadContent.mockResolvedValue({
      blobId: 'blob-1',
      size: 100,
      mimeType: 'image/png'
    })

    await importOneDriveFolder({
      remoteItemId: 'remote-folder-1',
      parentRemoteItemId: null,
      name: 'Media'
    })

    await vi.waitFor(() => expect(refreshImportedMediaAssets).toHaveBeenCalledTimes(2))
    expect(
      vi
        .mocked(refreshImportedMediaAssets)
        .mock.calls.map(([items]) => items.map((item) => item.name))
    ).toEqual([['one.png'], ['two.png']])
  })
})

describe('loginOneDriveAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    providerMocks.connect.mockResolvedValue({
      id: 'onedrive:account-1',
      providerType: 'onedrive',
      displayName: 'OneDrive - Alice',
      accountLabel: 'alice@example.com'
    })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        oneDrive: {
          deleteCredentials: vi.fn(async () => undefined),
          getAuthRedirectUri: vi.fn(async () => 'librepresenter://auth/onedrive'),
          waitAuthCallback: vi.fn(
            async () => 'librepresenter://auth/onedrive?code=code-1&state=state-1'
          ),
          completeAuth: vi.fn(async () => ({
            id: 'onedrive:account-1',
            providerType: 'onedrive',
            displayName: 'OneDrive - Alice',
            accountLabel: 'alice@example.com'
          }))
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

  it('uses a custom protocol callback for the default Electron flow', async () => {
    await expect(loginOneDriveAccount()).resolves.toMatchObject({ id: 'onedrive:account-1' })

    expect(window.api.oneDrive.getAuthRedirectUri).toHaveBeenCalled()
    expect(window.open).toHaveBeenCalledWith(
      'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      '_blank',
      'noopener,noreferrer'
    )
    expect(window.api.oneDrive.waitAuthCallback).toHaveBeenCalledWith('state-1')
    expect(window.api.oneDrive.completeAuth).toHaveBeenCalledWith({
      clientId: '11111111-2222-3333-4444-555555555555',
      redirectUri: 'librepresenter://auth/onedrive',
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

  it('unblocks Web login when no OAuth callback arrives', async () => {
    vi.useFakeTimers()
    const { isElectron } = await import('../env')
    vi.mocked(isElectron).mockReturnValue(false)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: undefined
    })
    const popup = {
      get closed(): boolean {
        throw new Error('window.closed should not be read for Web OAuth popups')
      }
    } as Window
    window.open = vi.fn(() => popup)

    const login = loginOneDriveAccount()
    await vi.advanceTimersByTimeAsync(2 * 60_000)

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
