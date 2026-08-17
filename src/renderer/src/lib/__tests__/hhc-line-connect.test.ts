import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import type { HhcAssetApi } from '../hhc-asset-api'
import type { HhcSession } from '@shared/hhc-auth'
import type {
  HhcAssetCollection,
  HhcAssetCollectionChangePage,
  HhcAssetCollectionItem
} from '@shared/hhc-assets'
import type { FolderRecord } from '@shared/types/folder'
import type { HhcLineCloudAuth } from '../cloud-provider'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import {
  getSyncEntryByRemoteItem,
  putProviderConnection,
  putSyncEntry,
  resetSyncDBForTests
} from '../sync-db'
import * as syncDB from '../sync-db'
import * as syncRefresh from '../sync-refresh'
import {
  importHhcLineCollection,
  ensureHhcLineDesktopItemAvailableForPresentation,
  listHhcLineCollections,
  prepareHhcLinePresentationSource,
  refreshHhcLineFolder
} from '../hhc-line-connect'
import { resetSyncDownloadQueueForTests } from '../sync-download-queue'

const mocks = vi.hoisted(() => ({
  electron: false,
  api: null as HhcAssetApi | null,
  state: {
    folders: {} as Record<string, FolderRecord>,
    items: {},
    _foldersArray: [] as FolderRecord[],
    _itemsArray: [],
    _childFoldersByParent: {} as Record<string, FolderRecord[]>,
    _itemsByParent: {},
    loadedParents: new Set<string>(['file-root']),
    initialize: vi.fn(async () => undefined),
    getChildFolders(parentId: string) {
      return this._childFoldersByParent[parentId] ?? []
    }
  },
  handleAccessError: vi.fn()
}))

vi.mock('../env', () => ({
  isElectron: () => mocks.electron,
  isWeb: () => !mocks.electron
}))

vi.mock('../hhc-asset-api', () => ({
  createHhcAssetApi: vi.fn(async () => mocks.api)
}))

vi.mock('../hhc-line-access', () => ({
  handleHhcLineAccessError: mocks.handleAccessError,
  isHhcLineRootAuthorized: vi.fn(async () => true)
}))

vi.mock('@renderer/stores/file-explorer', () => ({
  FILE_EXPLORER_ROOT_ID: 'file-root',
  removeCleanedEntriesFromStore: vi.fn(),
  useFileExplorerStore: {
    getState: () => mocks.state,
    setState: (update: (state: typeof mocks.state) => Partial<typeof mocks.state>) => {
      Object.assign(mocks.state, update(mocks.state))
    }
  }
}))

const collection = (id: string, name: string): HhcAssetCollection => ({
  id,
  namespace: 'line.group.media-sync',
  name,
  revision: 1,
  createdAt: '2026-08-17T00:00:00Z',
  updatedAt: '2026-08-17T00:00:00Z'
})

function auth(
  sessionRef: { current: HhcSession | null },
  generationRef: { current: number } = { current: 0 }
): HhcLineCloudAuth {
  return {
    getSession: () => sessionRef.current,
    getAuthGeneration: () => generationRef.current,
    getAccessToken: vi.fn(async () => 'access-token'),
    refreshAccessToken: vi.fn(async () => 'refresh-token'),
    endSession: vi.fn(async () => undefined)
  }
}

function resetChanges(items: HhcAssetCollectionItem[] = []): HhcAssetApi['getCollectionChanges'] {
  return vi.fn(async (collectionId: string, cursor?: string) => ({
    collection: collection(collectionId, collectionId),
    items: cursor ? [] : items,
    tombstones: [],
    cursor: cursor ? `${collectionId}-revision-1` : `${collectionId}-reset-barrier`,
    hasMore: !cursor,
    reset: !cursor
  }))
}

function api(overrides: Partial<HhcAssetApi> = {}): HhcAssetApi {
  return {
    listCollections: vi.fn(async () => ({ collections: [], hasMore: false })),
    getCollectionChanges: resetChanges(),
    getCollectionItem: vi.fn(),
    issueContentTicket: vi.fn(),
    getRemoteContentSource: vi.fn(),
    downloadContent: vi.fn(),
    ...overrides
  }
}

beforeEach(async () => {
  await resetFileExplorerDBForTests()
  await resetSyncDBForTests()
  mocks.electron = false
  mocks.api = api()
  Object.assign(mocks.state, {
    folders: {},
    items: {},
    _foldersArray: [],
    _itemsArray: [],
    _childFoldersByParent: {},
    _itemsByParent: {},
    loadedParents: new Set(['file-root'])
  })
  mocks.state.initialize.mockClear()
  mocks.handleAccessError.mockReset()
  mocks.handleAccessError.mockResolvedValue(undefined)
  resetSyncDownloadQueueForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HHC LINE collection connection', () => {
  it('routes a list 403 through the current account access owner', async () => {
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }
    const currentAuth = auth(sessionRef)
    const error = Object.assign(new Error('forbidden'), {
      classification: 'access-revoked',
      status: 403
    })
    mocks.api = api({
      listCollections: vi.fn(async () => {
        throw error
      })
    })

    await expect(listHhcLineCollections(currentAuth)).rejects.toBe(error)
    expect(mocks.handleAccessError).toHaveBeenCalledWith(
      currentAuth,
      { kind: 'account', accountUserId: 'user-1' },
      error,
      { accountUserId: 'user-1', authGeneration: 0 }
    )
  })

  it.each(['account switch', 'same-user re-login'] as const)(
    'does not end the current session for a delayed list 401 after %s',
    async (transition) => {
      const actualAccess =
        await vi.importActual<typeof import('../hhc-line-access')>('../hhc-line-access')
      mocks.handleAccessError.mockImplementation(actualAccess.handleHhcLineAccessError)
      let rejectList!: (error: unknown) => void
      mocks.api = api({
        listCollections: vi.fn(
          () =>
            new Promise<Awaited<ReturnType<HhcAssetApi['listCollections']>>>((_, reject) => {
              rejectList = reject
            })
        )
      })
      const sessionRef: { current: HhcSession | null } = {
        current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
      }
      const generationRef = { current: 0 }
      const currentAuth = auth(sessionRef, generationRef)
      const pending = listHhcLineCollections(currentAuth)
      await vi.waitFor(() => expect(mocks.api?.listCollections).toHaveBeenCalledOnce())

      generationRef.current += 1
      sessionRef.current =
        transition === 'account switch'
          ? { userId: 'user-2', displayName: 'Grace', roles: ['media_sync_user'] }
          : { ...sessionRef.current!, roles: ['media_sync_user', 'reader'] }
      rejectList(Object.assign(new Error('expired'), { classification: 'auth-required' }))

      await expect(pending).rejects.toMatchObject({ classification: 'auth-required' })
      expect(currentAuth.endSession).not.toHaveBeenCalled()
    }
  )

  it('ends the current session exactly once for a current list 401', async () => {
    const actualAccess =
      await vi.importActual<typeof import('../hhc-line-access')>('../hhc-line-access')
    mocks.handleAccessError.mockImplementation(actualAccess.handleHhcLineAccessError)
    const currentAuth = auth({
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    })
    mocks.api = api({
      listCollections: vi.fn(async () => {
        throw Object.assign(new Error('expired'), { classification: 'auth-required' })
      })
    })

    await expect(listHhcLineCollections(currentAuth)).rejects.toMatchObject({
      classification: 'auth-required'
    })
    expect(currentAuth.endSession).toHaveBeenCalledOnce()
  })

  it('leaves local media inert when there is no HHC session', async () => {
    await expect(
      prepareHhcLinePresentationSource(auth({ current: null }), {
        id: 'local-only',
        parentId: 'root',
        type: 'file',
        sortIndex: 0,
        createdAt: 1,
        expiresAt: null,
        name: 'local.png',
        mimeType: 'image/png',
        size: 1,
        url: 'blob:local-only'
      })
    ).resolves.toBeNull()
  })

  it('classifies a connection account mismatch as auth-required rather than access-revoked', async () => {
    await putProviderConnection({
      id: 'hhc-line:user-1',
      providerType: 'hhc-line',
      displayName: 'HHC LINE',
      accountUserId: 'user-1'
    })
    await putSyncEntry({
      providerConnectionId: 'hhc-line:user-1',
      remoteItemId: 'asset-1',
      parentRemoteItemId: 'collection-1',
      kind: 'file',
      name: 'photo.png',
      itemId: 'local-1',
      mimeType: 'image/png',
      status: 'remote-only'
    })

    await expect(
      prepareHhcLinePresentationSource(
        auth({ current: { userId: 'user-2', displayName: 'Grace', roles: [] } }),
        {
          id: 'local-1',
          parentId: 'root',
          type: 'file',
          sortIndex: 0,
          createdAt: 1,
          expiresAt: null,
          name: 'photo.png',
          mimeType: 'image/png',
          size: 1,
          url: 'hhc-line:asset-1'
        }
      )
    ).rejects.toMatchObject({ classification: 'auth-required' })
    expect(mocks.api?.getRemoteContentSource).not.toHaveBeenCalled()
  })

  it('propagates an Asset API 403 as access-revoked for the exact remote item', async () => {
    await putProviderConnection({
      id: 'hhc-line:user-1',
      providerType: 'hhc-line',
      displayName: 'HHC LINE',
      accountUserId: 'user-1'
    })
    await putSyncEntry({
      providerConnectionId: 'hhc-line:user-1',
      remoteItemId: 'asset-1',
      parentRemoteItemId: 'collection-1',
      kind: 'file',
      name: 'photo.png',
      itemId: 'local-1',
      mimeType: 'image/png',
      status: 'remote-only'
    })
    mocks.api = api({
      getRemoteContentSource: vi.fn(async () => {
        throw Object.assign(new Error('HHC Asset request failed'), {
          classification: 'access-revoked',
          status: 403
        })
      })
    })

    const currentAuth = auth({
      current: { userId: 'user-1', displayName: 'Ada', roles: [] }
    })
    await expect(
      prepareHhcLinePresentationSource(currentAuth, {
        id: 'local-1',
        parentId: 'root',
        type: 'file',
        sortIndex: 0,
        createdAt: 1,
        expiresAt: null,
        name: 'photo.png',
        mimeType: 'image/png',
        size: 1,
        url: 'hhc-line:asset-1'
      })
    ).rejects.toMatchObject({
      classification: 'access-revoked',
      status: 403,
      providerConnectionId: 'hhc-line:user-1',
      remoteItemId: 'asset-1'
    })
    expect(mocks.handleAccessError).toHaveBeenCalledWith(
      currentAuth,
      {
        kind: 'root',
        providerConnectionId: 'hhc-line:user-1',
        rootRemoteFolderId: 'collection-1',
        remoteItemId: 'asset-1'
      },
      expect.objectContaining({ classification: 'access-revoked', status: 403 }),
      { accountUserId: 'user-1', authGeneration: 0 }
    )
  })

  it('prepares an ephemeral source from the exact imported collection without persisting it', async () => {
    await putProviderConnection({
      id: 'hhc-line:user-1',
      providerType: 'hhc-line',
      displayName: 'HHC LINE',
      accountUserId: 'user-1'
    })
    await putSyncEntry({
      providerConnectionId: 'hhc-line:user-1',
      remoteItemId: 'asset-1',
      parentRemoteItemId: 'collection-1',
      kind: 'file',
      name: 'photo.png',
      itemId: 'local-1',
      mimeType: 'image/png',
      status: 'remote-only'
    })
    mocks.api = api({
      getRemoteContentSource: vi.fn(async () => ({
        kind: 'ticket' as const,
        url: 'https://www.alive.org.tw/api/assets/content?ticket=secret',
        expiresAt: 123,
        etag: 'etag-1'
      }))
    })

    await expect(
      prepareHhcLinePresentationSource(
        auth({
          current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
        }),
        {
          id: 'local-1',
          parentId: 'root',
          type: 'file',
          sortIndex: 0,
          createdAt: 1,
          expiresAt: null,
          name: 'photo.png',
          mimeType: 'image/png',
          size: 1,
          url: 'hhc-line:asset-1'
        }
      )
    ).resolves.toMatchObject({
      providerConnectionId: 'hhc-line:user-1',
      rootRemoteFolderId: 'collection-1',
      source: { kind: 'ticket', url: expect.stringContaining('ticket=secret') }
    })
    expect(mocks.api.getRemoteContentSource).toHaveBeenCalledWith('collection-1', 'asset-1')
    expect((await getSyncEntryByRemoteItem('hhc-line:user-1', 'asset-1'))?.status).toBe(
      'remote-only'
    )
  })

  it.each(['logout', 'account switch'] as const)(
    'releases a native lease returned after %s before rejecting the stale source',
    async (transition) => {
      mocks.electron = true
      let resolveSource!: (source: {
        kind: 'native-lease'
        url: string
        leaseId: string
        etag: string
      }) => void
      const releaseContentLease = vi.fn(async () => undefined)
      Object.defineProperty(window, 'api', {
        configurable: true,
        value: { hhcAssets: { releaseContentLease } }
      })
      await putProviderConnection({
        id: 'hhc-line:user-1',
        providerType: 'hhc-line',
        displayName: 'HHC LINE',
        accountUserId: 'user-1'
      })
      await putSyncEntry({
        providerConnectionId: 'hhc-line:user-1',
        remoteItemId: 'asset-1',
        parentRemoteItemId: 'collection-1',
        kind: 'file',
        name: 'photo.png',
        itemId: 'local-1',
        mimeType: 'image/png',
        status: 'remote-only'
      })
      mocks.api = api({
        getRemoteContentSource: vi.fn(
          () =>
            new Promise<Awaited<ReturnType<HhcAssetApi['getRemoteContentSource']>>>((resolve) => {
              resolveSource = resolve
            })
        )
      })
      const sessionRef: { current: HhcSession | null } = {
        current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
      }
      const pending = prepareHhcLinePresentationSource(auth(sessionRef), {
        id: 'local-1',
        parentId: 'root',
        type: 'file',
        sortIndex: 0,
        createdAt: 1,
        expiresAt: null,
        name: 'photo.png',
        mimeType: 'image/png',
        size: 1,
        url: 'hhc-line:asset-1'
      })
      await vi.waitFor(() => expect(mocks.api?.getRemoteContentSource).toHaveBeenCalledOnce())

      sessionRef.current =
        transition === 'logout'
          ? null
          : { userId: 'user-2', displayName: 'Grace', roles: ['media_sync_user'] }
      resolveSource({
        kind: 'native-lease',
        url: 'hhc-media://lease/123e4567-e89b-12d3-a456-426614174000?type=image%2Fpng',
        leaseId: '123e4567-e89b-12d3-a456-426614174000',
        etag: 'etag-1'
      })

      await expect(pending).rejects.toMatchObject({ classification: 'auth-required' })
      expect(releaseContentLease).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000')
      expect(releaseContentLease).toHaveBeenCalledOnce()
    }
  )

  it('downloads desktop-engine content into persistent native storage before presentation', async () => {
    mocks.electron = true
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { nativeFs: { delete: vi.fn(async () => undefined) } }
    })
    await putProviderConnection({
      id: 'hhc-line:user-1',
      providerType: 'hhc-line',
      displayName: 'HHC LINE',
      accountUserId: 'user-1'
    })
    await putSyncEntry({
      providerConnectionId: 'hhc-line:user-1',
      remoteItemId: 'asset-1',
      parentRemoteItemId: 'collection-1',
      kind: 'file',
      name: 'movie.mkv',
      itemId: 'local-1',
      mimeType: 'video/x-matroska',
      status: 'remote-only'
    })
    mocks.api = api({
      getCollectionItem: vi.fn(async () => ({
        id: 'asset-1',
        collectionId: 'collection-1',
        remoteItemId: 'source-1',
        displayName: 'movie.mkv',
        sourceRevision: 'hash-1',
        createdRevision: 1,
        mimeType: 'video/x-matroska',
        sizeBytes: 10,
        etag: 'etag-1',
        createdAt: '2026-08-17T00:00:00Z'
      })),
      downloadContent: vi.fn(async () => ({
        fileId: 'local-1',
        size: 10,
        mimeType: 'video/x-matroska'
      }))
    })
    const item = {
      id: 'local-1',
      parentId: 'root',
      type: 'file' as const,
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'movie.mkv',
      mimeType: 'video/x-matroska',
      size: 10,
      url: 'blob:local-1'
    }

    await expect(
      ensureHhcLineDesktopItemAvailableForPresentation(
        auth({
          current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
        }),
        item
      )
    ).resolves.toBe(true)

    expect(mocks.api.downloadContent).toHaveBeenCalledWith(
      {
        collectionId: 'collection-1',
        itemId: 'asset-1',
        rootRemoteFolderId: 'collection-1',
        targetFileId: 'local-1'
      },
      expect.any(AbortSignal)
    )
    expect((await getSyncEntryByRemoteItem('hhc-line:user-1', 'asset-1'))?.status).toBe(
      'available-offline'
    )
  })

  it('preserves status 403 when a queued desktop presentation download is access-revoked', async () => {
    mocks.electron = true
    await putProviderConnection({
      id: 'hhc-line:user-1',
      providerType: 'hhc-line',
      displayName: 'HHC LINE',
      accountUserId: 'user-1'
    })
    await putSyncEntry({
      providerConnectionId: 'hhc-line:user-1',
      remoteItemId: 'asset-1',
      parentRemoteItemId: 'collection-1',
      kind: 'file',
      name: 'movie.mkv',
      itemId: 'local-1',
      mimeType: 'video/x-matroska',
      status: 'remote-only'
    })
    mocks.api = api({
      getCollectionItem: vi.fn(async () => ({
        id: 'asset-1',
        collectionId: 'collection-1',
        remoteItemId: 'source-1',
        displayName: 'movie.mkv',
        sourceRevision: 'hash-1',
        createdRevision: 1,
        mimeType: 'video/x-matroska',
        sizeBytes: 10,
        etag: 'etag-1',
        createdAt: '2026-08-17T00:00:00Z'
      })),
      downloadContent: vi.fn(async () => {
        throw Object.assign(new Error('forbidden'), {
          classification: 'access-revoked',
          status: 403
        })
      })
    })

    await expect(
      ensureHhcLineDesktopItemAvailableForPresentation(
        auth({
          current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
        }),
        {
          id: 'local-1',
          parentId: 'root',
          type: 'file',
          sortIndex: 0,
          createdAt: 1,
          expiresAt: null,
          name: 'movie.mkv',
          mimeType: 'video/x-matroska',
          size: 10,
          url: 'blob:local-1'
        }
      )
    ).rejects.toMatchObject({ classification: 'access-revoked', status: 403 })
    expect(mocks.handleAccessError).toHaveBeenCalledWith(
      expect.anything(),
      {
        kind: 'root',
        providerConnectionId: 'hhc-line:user-1',
        rootRemoteFolderId: 'collection-1',
        remoteItemId: 'asset-1'
      },
      expect.objectContaining({ classification: 'access-revoked', status: 403 }),
      { accountUserId: 'user-1', authGeneration: 0 }
    )
  })
  it('collects every authorized page and excludes only roots imported by the current account', async () => {
    const currentRoot: FolderRecord = {
      id: 'root-current',
      name: 'Already imported',
      parentId: 'file-root',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerType: 'hhc-line',
        providerConnectionId: 'hhc-line:user-1',
        remoteFolderId: 'collection-1',
        offlinePolicy: 'online-only',
        status: 'active'
      }
    }
    const otherAccountRoot: FolderRecord = {
      ...currentRoot,
      id: 'root-other',
      name: 'Other account root',
      sortIndex: 1,
      syncLink: {
        ...currentRoot.syncLink!,
        providerConnectionId: 'hhc-line:user-2',
        remoteFolderId: 'collection-2'
      }
    }
    Object.assign(mocks.state, {
      folders: { [currentRoot.id]: currentRoot, [otherAccountRoot.id]: otherAccountRoot },
      _foldersArray: [currentRoot, otherAccountRoot],
      _childFoldersByParent: { 'file-root': [currentRoot, otherAccountRoot] }
    })
    mocks.api = api({
      listCollections: vi
        .fn()
        .mockResolvedValueOnce({
          collections: [collection('collection-1', 'Imported')],
          cursor: 'page-2',
          hasMore: true
        })
        .mockResolvedValueOnce({
          collections: [collection('collection-2', 'Available')],
          hasMore: false
        })
    })
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }

    await expect(listHhcLineCollections(auth(sessionRef))).resolves.toEqual([
      {
        remoteItemId: 'collection-2',
        name: 'Available',
        parentRemoteItemId: null
      }
    ])
    expect(mocks.api.listCollections).toHaveBeenNthCalledWith(2, 'page-2')
  })

  it('deduplicates concurrent imports and persists an active browser online-only root', async () => {
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }
    const target = { remoteItemId: 'collection-1', name: 'Sunday', parentRemoteItemId: null }

    const [first, second] = await Promise.all([
      importHhcLineCollection(auth(sessionRef), target),
      importHhcLineCollection(auth(sessionRef), target)
    ])

    expect(first).toEqual(second)
    expect(mocks.api!.getCollectionChanges).toHaveBeenCalledTimes(2)
    const roots = await (await openFileExplorerDB()).getAll('folder-records')
    expect(roots).toEqual([
      expect.objectContaining({
        name: 'Sunday',
        syncLink: {
          providerConnectionId: 'hhc-line:user-1',
          providerType: 'hhc-line',
          remoteFolderId: 'collection-1',
          offlinePolicy: 'online-only',
          status: 'active'
        }
      })
    ])
  })

  it('uses on-demand policy in Electron', async () => {
    mocks.electron = true
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }

    await importHhcLineCollection(auth(sessionRef), {
      remoteItemId: 'collection-1',
      name: 'Sunday',
      parentRemoteItemId: null
    })

    const roots = await (await openFileExplorerDB()).getAll('folder-records')
    expect(roots[0].syncLink?.offlinePolicy).toBe('on-demand')
  })

  it('keeps multiple imported collections independent', async () => {
    mocks.api = api({
      getCollectionChanges: resetChanges()
    })
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }

    await importHhcLineCollection(auth(sessionRef), {
      remoteItemId: 'collection-1',
      name: 'Sunday',
      parentRemoteItemId: null
    })
    await importHhcLineCollection(auth(sessionRef), {
      remoteItemId: 'collection-2',
      name: 'Youth',
      parentRemoteItemId: null
    })

    const roots = await (await openFileExplorerDB()).getAll('folder-records')
    expect(roots.map((root) => root.syncLink?.remoteFolderId).sort()).toEqual([
      'collection-1',
      'collection-2'
    ])
  })

  it('serializes distinct imports when resolving root names and positions', async () => {
    mocks.api = api({
      getCollectionChanges: resetChanges()
    })
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }

    await Promise.all([
      importHhcLineCollection(auth(sessionRef), {
        remoteItemId: 'collection-1',
        name: 'Sunday',
        parentRemoteItemId: null
      }),
      importHhcLineCollection(auth(sessionRef), {
        remoteItemId: 'collection-2',
        name: 'Sunday',
        parentRemoteItemId: null
      })
    ])

    const roots = (await (await openFileExplorerDB()).getAll('folder-records')).sort(
      (left, right) => left.sortIndex - right.sortIndex
    )
    expect(roots.map(({ name, sortIndex }) => ({ name, sortIndex }))).toEqual([
      { name: 'Sunday', sortIndex: 0 },
      { name: 'Sunday 2', sortIndex: 1 }
    ])
  })

  it('retries an active-looking root that has no completed cursor', async () => {
    const partialRoot: FolderRecord = {
      id: 'hhc-line:user-1:collection:collection-1',
      name: 'Sunday',
      parentId: 'file-root',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerConnectionId: 'hhc-line:user-1',
        providerType: 'hhc-line',
        remoteFolderId: 'collection-1',
        offlinePolicy: 'online-only',
        status: 'active'
      }
    }
    Object.assign(mocks.state, {
      folders: { [partialRoot.id]: partialRoot },
      _foldersArray: [partialRoot],
      _childFoldersByParent: { 'file-root': [partialRoot] }
    })
    await (await openFileExplorerDB()).put('folder-records', partialRoot)
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }

    await importHhcLineCollection(auth(sessionRef), {
      remoteItemId: 'collection-1',
      name: 'Sunday',
      parentRemoteItemId: null
    })

    expect(mocks.api!.getCollectionChanges).toHaveBeenCalledTimes(2)
  })

  it.each(['plan', 'cursor'] as const)(
    'removes a partial import after a %s write failure so retry starts cleanly',
    async (failure) => {
      const remoteItem = {
        id: 'item-1',
        collectionId: 'collection-1',
        remoteItemId: 'source-1',
        displayName: 'photo.jpg',
        sourceRevision: 'sha256:one',
        createdRevision: 1,
        mimeType: 'image/jpeg',
        sizeBytes: 42,
        etag: '"etag-1"',
        createdAt: '2026-08-17T00:00:00Z'
      }
      mocks.api = api({
        getCollectionChanges: resetChanges([remoteItem])
      })
      const sessionRef = {
        current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
      }
      const target = {
        remoteItemId: 'collection-1',
        name: 'Sunday',
        parentRemoteItemId: null
      }
      const failureSpy =
        failure === 'plan'
          ? vi.spyOn(syncRefresh, 'applySyncRefreshPlan').mockRejectedValueOnce(new Error('write'))
          : vi.spyOn(syncDB, 'putSyncCursor').mockRejectedValueOnce(new Error('write'))

      await expect(importHhcLineCollection(auth(sessionRef), target)).rejects.toThrow('write')
      const db = await openFileExplorerDB()
      await expect(db.getAll('folder-records')).resolves.toEqual([])
      await expect(db.getAll('folder-items')).resolves.toEqual([])
      await expect(getSyncEntryByRemoteItem('hhc-line:user-1', 'item-1')).resolves.toBeUndefined()

      failureSpy.mockRestore()
      await importHhcLineCollection(auth(sessionRef), target)

      await expect(db.getAll('folder-records')).resolves.toHaveLength(1)
      await expect(db.getAll('folder-items')).resolves.toHaveLength(1)
    }
  )

  it('rejects a response completed after the account changes', async () => {
    let resolvePage!: (value: Awaited<ReturnType<HhcAssetApi['listCollections']>>) => void
    mocks.api = api({
      listCollections: vi.fn(
        () =>
          new Promise<Awaited<ReturnType<HhcAssetApi['listCollections']>>>((resolve) => {
            resolvePage = resolve
          })
      )
    })
    const sessionRef: { current: HhcSession | null } = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }
    const pending = listHhcLineCollections(auth(sessionRef))
    await Promise.resolve()
    await Promise.resolve()
    sessionRef.current = { userId: 'user-2', displayName: 'Grace', roles: ['media_sync_user'] }
    resolvePage({ collections: [collection('collection-1', 'Sunday')], hasMore: false })

    await expect(pending).rejects.toThrow('HHC account changed')
  })

  it('rolls back the imported root when the account changes during its final commit', async () => {
    const remoteItem = {
      id: 'item-1',
      collectionId: 'collection-1',
      remoteItemId: 'source-1',
      displayName: 'photo.jpg',
      sourceRevision: 'sha256:one',
      createdRevision: 1,
      mimeType: 'image/jpeg',
      sizeBytes: 42,
      etag: '"etag-1"',
      createdAt: '2026-08-17T00:00:00Z'
    }
    mocks.api = api({
      getCollectionChanges: resetChanges([remoteItem])
    })
    const sessionRef: { current: HhcSession | null } = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }
    const db = await openFileExplorerDB()
    const put = db.put.bind(db)
    vi.spyOn(db, 'put').mockImplementation(async (storeName, value) => {
      const result = await put(storeName, value)
      if (storeName === 'folder-records' && value.id.includes(':collection:')) {
        sessionRef.current = {
          userId: 'user-2',
          displayName: 'Grace',
          roles: ['media_sync_user']
        }
      }
      return result
    })

    await expect(
      importHhcLineCollection(auth(sessionRef), {
        remoteItemId: 'collection-1',
        name: 'Sunday',
        parentRemoteItemId: null
      })
    ).rejects.toThrow('HHC account changed')

    await expect(db.getAll('folder-records')).resolves.toEqual([])
    await expect(db.getAll('folder-items')).resolves.toEqual([])
    await expect(getSyncEntryByRemoteItem('hhc-line:user-1', 'item-1')).resolves.toBeUndefined()
  })

  it('rejects repeated collection cursors', async () => {
    mocks.api = api({
      listCollections: vi.fn(async () => ({
        collections: [],
        cursor: 'same-cursor',
        hasMore: true
      }))
    })
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }

    await expect(listHhcLineCollections(auth(sessionRef))).rejects.toThrow(
      'Invalid HHC collection pagination'
    )
    expect(mocks.api.listCollections).toHaveBeenCalledTimes(2)
  })

  it('bounds unique collection cursor chains', async () => {
    let page = 0
    mocks.api = api({
      listCollections: vi.fn(async () => {
        page += 1
        if (page > 1_000) throw new Error('unbounded collection pagination escaped')
        return {
          collections: [],
          cursor: `page-${page}`,
          hasMore: true
        }
      })
    })
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }

    await expect(listHhcLineCollections(auth(sessionRef))).rejects.toThrow(
      'Invalid HHC collection pagination'
    )
    expect(mocks.api!.listCollections).toHaveBeenCalledTimes(1_000)
  })

  it('waits for a full snapshot when a delta cannot safely update pending entries', async () => {
    const remoteItem = {
      id: 'item-1',
      collectionId: 'collection-1',
      remoteItemId: 'source-1',
      displayName: 'photo.jpg',
      sourceRevision: 'sha256:one',
      createdRevision: 1,
      mimeType: 'image/jpeg',
      sizeBytes: 42,
      etag: '"etag-1"',
      createdAt: '2026-08-17T00:00:00Z'
    }
    const getCollectionChanges = vi
      .fn()
      .mockResolvedValueOnce({
        collection: collection('collection-1', 'Sunday'),
        items: [remoteItem],
        tombstones: [],
        cursor: 'reset-barrier-1',
        hasMore: true,
        reset: true
      })
      .mockResolvedValueOnce({
        collection: collection('collection-1', 'Sunday'),
        items: [],
        tombstones: [],
        cursor: 'revision-1',
        hasMore: false,
        reset: false
      })
      .mockResolvedValueOnce({
        collection: collection('collection-1', 'Sunday'),
        items: [],
        tombstones: [],
        cursor: 'revision-2',
        hasMore: false,
        reset: false
      })
      .mockResolvedValueOnce({
        collection: collection('collection-1', 'Sunday'),
        items: [remoteItem],
        tombstones: [],
        cursor: 'reset-barrier-2',
        hasMore: true,
        reset: true
      })
      .mockResolvedValueOnce({
        collection: collection('collection-1', 'Sunday'),
        items: [],
        tombstones: [],
        cursor: 'revision-3',
        hasMore: false,
        reset: false
      })
    mocks.api = api({ getCollectionChanges })
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }
    await importHhcLineCollection(auth(sessionRef), {
      remoteItemId: 'collection-1',
      name: 'Sunday',
      parentRemoteItemId: null
    })
    const entry = await getSyncEntryByRemoteItem('hhc-line:user-1', 'item-1')
    await putSyncEntry({ ...entry!, status: 'queued' })
    const [root] = await (await openFileExplorerDB()).getAll('folder-records')

    await refreshHhcLineFolder(auth(sessionRef), root.id)

    expect(getCollectionChanges).toHaveBeenNthCalledWith(3, 'collection-1', 'revision-1')
    expect(getCollectionChanges).toHaveBeenNthCalledWith(4, 'collection-1')
  })

  it('removes an account-scoped root when the account changes after refresh writes', async () => {
    const sessionRef: { current: HhcSession | null } = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }
    await importHhcLineCollection(auth(sessionRef), {
      remoteItemId: 'collection-1',
      name: 'Sunday',
      parentRemoteItemId: null
    })
    const [root] = await (await openFileExplorerDB()).getAll('folder-records')
    const apply = syncRefresh.applySyncRefreshPlan
    vi.spyOn(syncRefresh, 'applySyncRefreshPlan').mockImplementationOnce(async (plan) => {
      await apply(plan)
      sessionRef.current = {
        userId: 'user-2',
        displayName: 'Grace',
        roles: ['media_sync_user']
      }
    })

    await expect(refreshHhcLineFolder(auth(sessionRef), root.id)).rejects.toThrow(
      'HHC account changed'
    )
    await expect((await openFileExplorerDB()).getAll('folder-records')).resolves.toEqual([])
  })

  it('coalesces refreshes by root while allowing different roots to proceed', async () => {
    const sessionRef = {
      current: { userId: 'user-1', displayName: 'Ada', roles: ['media_sync_user'] }
    }
    await importHhcLineCollection(auth(sessionRef), {
      remoteItemId: 'collection-1',
      name: 'Sunday',
      parentRemoteItemId: null
    })
    await importHhcLineCollection(auth(sessionRef), {
      remoteItemId: 'collection-2',
      name: 'Youth',
      parentRemoteItemId: null
    })
    const roots = await (await openFileExplorerDB()).getAll('folder-records')
    const rootByCollection = new Map(roots.map((root) => [root.syncLink!.remoteFolderId, root]))
    const resolvers = new Map<string, (value: HhcAssetCollectionChangePage) => void>()
    const getCollectionChanges = vi.fn(
      (collectionId: string) =>
        new Promise<HhcAssetCollectionChangePage>((resolve) => {
          resolvers.set(collectionId, resolve)
        })
    )
    mocks.api!.getCollectionChanges = getCollectionChanges

    const first = refreshHhcLineFolder(auth(sessionRef), rootByCollection.get('collection-1')!.id)
    const duplicate = refreshHhcLineFolder(
      auth(sessionRef),
      rootByCollection.get('collection-1')!.id
    )
    const independent = refreshHhcLineFolder(
      auth(sessionRef),
      rootByCollection.get('collection-2')!.id
    )
    await vi.waitFor(() => expect(getCollectionChanges).toHaveBeenCalledTimes(2))

    expect(first).toBe(duplicate)
    for (const collectionId of ['collection-1', 'collection-2']) {
      resolvers.get(collectionId)!({
        collection: collection(collectionId, collectionId),
        items: [],
        tombstones: [],
        cursor: `${collectionId}-revision-2`,
        hasMore: false,
        reset: false
      })
    }
    await Promise.all([first, duplicate, independent])
  })
})
