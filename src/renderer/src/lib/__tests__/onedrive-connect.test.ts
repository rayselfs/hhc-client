import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FILE_EXPLORER_ROOT_ID } from '@renderer/stores/file-explorer'
import type { FileItemRecord, FolderRecord, SyncOfflinePolicy } from '@shared/types/folder'
import {
  buildOneDriveImportPlan,
  ensureOneDriveItemAvailableForPresentation,
  importOneDriveFolder,
  loginOneDriveAccount,
  refreshOneDriveFolder,
  scanOneDriveFolder
} from '../onedrive-connect'
import type { OneDriveReadonlyProvider } from '../onedrive-provider'
import type { SyncChangePage } from '../sync-provider'
import { openFileExplorerDB } from '../file-explorer-db'
import { refreshImportedMediaAssets } from '../local-sync-import'
import {
  getSyncCursor,
  listProviderConnectionsByType,
  listSyncEntriesByProviderConnection,
  putSyncEntry,
  putSyncTombstone,
  type SyncEntryRecord
} from '../sync-db'
import { getSyncEntryByLocalItem } from '../sync-db'
import { resetSyncDownloadQueueForTests } from '../sync-download-queue'
import { cleanupFileResources } from '../file-resource-cleanup'

const providerMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  initialScan: vi.fn(),
  incrementalChanges: vi.fn(),
  downloadContent: vi.fn()
}))

const settingsMocks = vi.hoisted(() => ({
  offlinePolicy: 'always-offline' as SyncOfflinePolicy
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

const cleanupMocks = vi.hoisted(() => ({
  cleanupFileResources: vi.fn(async () => ({ folderIds: [], itemIds: [] }))
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
    getState: () => ({ defaultSyncOfflinePolicy: settingsMocks.offlinePolicy })
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
    incrementalChanges = providerMocks.incrementalChanges
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
  getSyncEntryByLocalItem: vi.fn(async () => undefined),
  getSyncEntryByRemoteItem: vi.fn(async () => undefined),
  listProviderConnectionsByType: vi.fn(async () => []),
  listSyncEntriesByProviderConnection: vi.fn(async () => []),
  putProviderConnection: vi.fn(async (record) => ({
    ...record,
    createdAt: 1,
    updatedAt: 1
  })),
  putSyncCursor: vi.fn(async () => undefined),
  putSyncEntry: vi.fn(async () => undefined),
  putSyncTombstone: vi.fn(async () => undefined)
}))

vi.mock('../file-resource-cleanup', () => cleanupMocks)

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

function setupTwoRootRefresh(options: {
  rootAOfflinePolicy: SyncOfflinePolicy
  availableA: boolean
}): {
  rootA: FolderRecord
  rootB: FolderRecord
  itemA: FileItemRecord
  itemB: FileItemRecord
} {
  const rootA: FolderRecord = {
    id: 'onedrive-root-a',
    name: 'Root A',
    parentId: FILE_EXPLORER_ROOT_ID,
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    syncLink: {
      providerConnectionId: 'onedrive:account-1',
      remoteFolderId: 'remote-root-a',
      providerType: 'onedrive',
      offlinePolicy: options.rootAOfflinePolicy
    }
  }
  const rootB: FolderRecord = {
    id: 'onedrive-root-b',
    name: 'Root B',
    parentId: FILE_EXPLORER_ROOT_ID,
    sortIndex: 1,
    createdAt: 1,
    expiresAt: null,
    syncLink: {
      providerConnectionId: 'onedrive:account-1',
      remoteFolderId: 'remote-root-b',
      providerType: 'onedrive',
      offlinePolicy: 'on-demand'
    }
  }
  const itemA: FileItemRecord = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'a.jpg',
    type: 'file',
    parentId: rootA.id,
    url: 'blob:11111111-1111-4111-8111-111111111111',
    size: 10,
    mimeType: 'image/jpeg',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null
  }
  const itemB: FileItemRecord = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'b.jpg',
    type: 'file',
    parentId: rootB.id,
    url: 'blob:22222222-2222-4222-8222-222222222222',
    size: 20,
    mimeType: 'image/jpeg',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null
  }
  const entries: SyncEntryRecord[] = [
    {
      id: 'entry-root-a',
      providerConnectionId: 'onedrive:account-1',
      remoteItemId: 'remote-root-a',
      parentRemoteItemId: null,
      kind: 'folder',
      name: 'Root A',
      folderId: rootA.id,
      status: 'remote-only',
      createdAt: 1,
      updatedAt: 1
    },
    {
      id: 'entry-file-a',
      providerConnectionId: 'onedrive:account-1',
      remoteItemId: 'remote-file-a',
      parentRemoteItemId: 'remote-root-a',
      kind: 'file',
      name: itemA.name,
      itemId: itemA.id,
      ...(options.availableA ? { blobId: itemA.id } : {}),
      mimeType: itemA.mimeType,
      size: itemA.size,
      etag: 'etag-a',
      status: options.availableA ? 'available-offline' : 'remote-only',
      createdAt: 1,
      updatedAt: 1
    },
    {
      id: 'entry-root-b',
      providerConnectionId: 'onedrive:account-1',
      remoteItemId: 'remote-root-b',
      parentRemoteItemId: null,
      kind: 'folder',
      name: 'Root B',
      folderId: rootB.id,
      status: 'remote-only',
      createdAt: 1,
      updatedAt: 1
    },
    {
      id: 'entry-file-b',
      providerConnectionId: 'onedrive:account-1',
      remoteItemId: 'remote-file-b',
      parentRemoteItemId: 'remote-root-b',
      kind: 'file',
      name: itemB.name,
      itemId: itemB.id,
      blobId: itemB.id,
      mimeType: itemB.mimeType,
      size: itemB.size,
      etag: 'etag-b',
      status: 'remote-only',
      createdAt: 1,
      updatedAt: 1
    }
  ]
  const fileBlobs = [
    ...(options.availableA ? [{ id: itemA.id, blob: new Blob(['a']), refCount: 1 }] : []),
    { id: itemB.id, blob: new Blob(['b']), refCount: 1 }
  ]

  fileStoreMocks.state.folders = { [rootA.id]: rootA, [rootB.id]: rootB }
  fileStoreMocks.state.items = { [itemA.id]: itemA, [itemB.id]: itemB }
  vi.mocked(listSyncEntriesByProviderConnection).mockResolvedValueOnce(entries)
  vi.mocked(openFileExplorerDB).mockResolvedValue({
    getAll: vi.fn(async (store: string) => {
      if (store === 'folder-records') return [rootA, rootB]
      if (store === 'folder-items') return [itemA, itemB]
      if (store === 'file-blobs') return fileBlobs
      return []
    }),
    put: vi.fn(async () => undefined),
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

  return { rootA, rootB, itemA, itemB }
}

function rootASnapshot(): SyncChangePage {
  return {
    items: [
      {
        remoteItemId: 'remote-root-a',
        parentRemoteItemId: null,
        kind: 'folder',
        name: 'Root A'
      },
      {
        remoteItemId: 'remote-file-a',
        parentRemoteItemId: 'remote-root-a',
        kind: 'file',
        name: 'a.jpg',
        mimeType: 'image/jpeg',
        size: 10,
        etag: 'etag-a'
      }
    ],
    nextCursor: 'cursor-full',
    hasMore: false
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  settingsMocks.offlinePolicy = 'always-offline'
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

  it('rejects a repeated page cursor instead of looping forever', async () => {
    const provider = {
      initialScan: vi.fn(),
      incrementalChanges: vi
        .fn()
        .mockResolvedValueOnce({
          items: [],
          nextCursor: 'cursor-1',
          hasMore: true
        })
        .mockRejectedValueOnce(new Error('unbounded pagination escaped'))
    } as unknown as OneDriveReadonlyProvider

    await expect(
      scanOneDriveFolder(provider, 'connection-1', 'folder-1', 'cursor-1')
    ).rejects.toThrow('Invalid sync change pagination')
  })
})

describe('refreshOneDriveFolder', () => {
  it('refreshes a persisted OneDrive root with the selected offline policy', async () => {
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
        offlinePolicy: 'on-demand' as const
      }
    }
    const put = vi.fn(async () => undefined)
    fileStoreMocks.state.folders = { [rootFolder.id]: rootFolder }
    settingsMocks.offlinePolicy = 'always-offline'
    vi.mocked(openFileExplorerDB).mockResolvedValue({
      getAll: vi.fn(async (store: string) => (store === 'folder-records' ? [rootFolder] : [])),
      put,
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
    providerMocks.initialScan.mockResolvedValueOnce({
      items: [
        {
          remoteItemId: 'remote-folder-1',
          parentRemoteItemId: null,
          kind: 'folder',
          name: 'Selected'
        },
        {
          remoteItemId: 'remote-file-1',
          parentRemoteItemId: 'remote-folder-1',
          kind: 'file',
          name: 'photo.jpg',
          mimeType: 'image/jpeg',
          size: 10
        }
      ],
      nextCursor: 'cursor-1',
      hasMore: false
    })

    await refreshOneDriveFolder(rootFolder.id)

    expect(put).toHaveBeenCalledWith(
      'folder-records',
      expect.objectContaining({
        id: rootFolder.id,
        syncLink: expect.objectContaining({ offlinePolicy: 'always-offline' })
      })
    )
    expect(fileStoreMocks.state.folders).toMatchObject({
      [rootFolder.id]: {
        id: rootFolder.id,
        syncLink: { offlinePolicy: 'always-offline' }
      }
    })
    expect(putSyncEntry).toHaveBeenCalledWith(
      expect.objectContaining({ remoteItemId: 'remote-file-1', status: 'queued' })
    )
  })

  it('reconciles root A as always-offline without planning or cleaning sibling root B', async () => {
    const { rootA, itemA, itemB } = setupTwoRootRefresh({
      rootAOfflinePolicy: 'on-demand',
      availableA: false
    })
    vi.mocked(getSyncCursor).mockResolvedValueOnce({
      id: 'cursor-record',
      providerConnectionId: 'onedrive:account-1',
      remoteFolderId: 'remote-root-a',
      cursor: 'cursor-1',
      updatedAt: 1
    })
    providerMocks.incrementalChanges.mockResolvedValueOnce({
      items: [],
      nextCursor: 'cursor-2',
      hasMore: false
    })
    providerMocks.initialScan.mockResolvedValueOnce(rootASnapshot())
    providerMocks.downloadContent.mockResolvedValueOnce({
      blobId: itemA.id,
      size: 10,
      mimeType: 'image/jpeg'
    })

    const summary = await refreshOneDriveFolder(rootA.id)

    expect(summary).toMatchObject({
      fullScanFallback: true,
      pendingFileCount: 1,
      removedFolderCount: 0,
      removedItemCount: 0
    })
    await vi.waitFor(() => expect(providerMocks.downloadContent).toHaveBeenCalledOnce())
    expect(providerMocks.downloadContent.mock.calls[0]?.[0]).toMatchObject({
      rootRemoteFolderId: 'remote-root-a',
      remoteItemId: 'remote-file-a'
    })
    expect(putSyncTombstone).not.toHaveBeenCalledWith(
      expect.objectContaining({ remoteItemId: 'remote-root-b' })
    )
    expect(putSyncTombstone).not.toHaveBeenCalledWith(
      expect.objectContaining({ remoteItemId: 'remote-file-b', blobId: itemB.id })
    )
    expect(cleanupFileResources).toHaveBeenCalledWith({ folderIds: [], itemIds: [] })
  })

  it.each(['missing', 'expired'] as const)(
    'keeps sibling root B outside a %s-cursor full scan of root A',
    async (cursorState) => {
      const { rootA, itemB } = setupTwoRootRefresh({
        rootAOfflinePolicy: 'always-offline',
        availableA: true
      })
      if (cursorState === 'missing') {
        vi.mocked(getSyncCursor).mockResolvedValueOnce(undefined)
      } else {
        vi.mocked(getSyncCursor).mockResolvedValueOnce({
          id: 'cursor-record',
          providerConnectionId: 'onedrive:account-1',
          remoteFolderId: 'remote-root-a',
          cursor: 'cursor-expired',
          updatedAt: 1
        })
        providerMocks.incrementalChanges.mockRejectedValueOnce(
          Object.assign(new Error('410 expired cursor'), { status: 410 })
        )
      }
      providerMocks.initialScan.mockResolvedValueOnce(rootASnapshot())

      const summary = await refreshOneDriveFolder(rootA.id)

      expect(summary).toMatchObject({
        usedCursor: false,
        removedFolderCount: 0,
        removedItemCount: 0
      })
      expect(providerMocks.initialScan).toHaveBeenCalledOnce()
      expect(putSyncTombstone).not.toHaveBeenCalledWith(
        expect.objectContaining({ remoteItemId: 'remote-root-b' })
      )
      expect(putSyncTombstone).not.toHaveBeenCalledWith(
        expect.objectContaining({ remoteItemId: 'remote-file-b', blobId: itemB.id })
      )
      expect(cleanupFileResources).toHaveBeenCalledWith({ folderIds: [], itemIds: [] })
    }
  )

  it('coalesces concurrent refreshes for the same root folder', async () => {
    const scan = deferred<SyncChangePage>()
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
    providerMocks.downloadContent.mockResolvedValue({
      blobId: 'local-file-1',
      size: 10,
      mimeType: 'image/jpeg'
    })

    const first = refreshOneDriveFolder('onedrive-root')
    const second = refreshOneDriveFolder('onedrive-root')

    await vi.waitFor(() => expect(providerMocks.initialScan).toHaveBeenCalled())
    expect(providerMocks.initialScan).toHaveBeenCalledTimes(1)

    scan.resolve({
      items: [
        {
          remoteItemId: 'remote-folder-1',
          parentRemoteItemId: null,
          kind: 'folder',
          name: 'Selected'
        },
        {
          remoteItemId: 'remote-file-1',
          parentRemoteItemId: 'remote-folder-1',
          kind: 'file',
          name: 'photo.jpg',
          mimeType: 'image/jpeg',
          size: 10
        }
      ],
      nextCursor: 'cursor-1',
      hasMore: false
    })
    await expect(Promise.all([first, second])).resolves.toHaveLength(2)
    await vi.waitFor(() => expect(providerMocks.downloadContent).toHaveBeenCalledOnce())
    expect(providerMocks.downloadContent.mock.calls[0]?.[0]).toMatchObject({
      rootRemoteFolderId: 'remote-folder-1'
    })
  })
})

describe('OneDrive production download roots', () => {
  it('uses the selected sync root for presentation downloads', async () => {
    fileStoreMocks.state.folders = {
      'selected-root': {
        id: 'selected-root',
        name: 'Selected',
        parentId: 'root',
        sortIndex: 0,
        createdAt: 1,
        expiresAt: null,
        syncLink: {
          providerConnectionId: 'onedrive:account-1',
          remoteFolderId: 'remote-selected-root',
          providerType: 'onedrive'
        }
      }
    }
    vi.mocked(getSyncEntryByLocalItem).mockResolvedValueOnce({
      id: 'entry-1',
      providerConnectionId: 'onedrive:account-1',
      remoteItemId: 'remote-file-1',
      parentRemoteItemId: 'remote-selected-root',
      kind: 'file',
      name: 'photo.jpg',
      itemId: 'item-1',
      status: 'remote-only',
      createdAt: 1,
      updatedAt: 1
    })
    providerMocks.downloadContent.mockResolvedValueOnce({
      blobId: 'item-1',
      size: 10,
      mimeType: 'image/jpeg'
    })

    await ensureOneDriveItemAvailableForPresentation({
      id: 'item-1',
      name: 'photo.jpg',
      type: 'file',
      parentId: 'selected-root',
      url: '',
      size: 10,
      mimeType: 'image/jpeg',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null
    })

    expect(providerMocks.downloadContent.mock.calls[0]?.[0]).toMatchObject({
      rootRemoteFolderId: 'remote-selected-root'
    })
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
    expect(providerMocks.downloadContent.mock.calls[0]?.[0]).toMatchObject({
      rootRemoteFolderId: 'remote-folder-1'
    })

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
      providerMocks.downloadContent.mock.calls.map(([request]) => request.remoteItemId)
    ).toEqual(['file-1', 'file-2'])
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
