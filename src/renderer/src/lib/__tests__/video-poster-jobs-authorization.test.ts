import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HhcSession } from '@shared/hhc-auth'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { mediaJobQueue } from '../media-job-queue'
import { enqueueVideoPosterJob, fenceVideoPosterScope } from '../video-poster-jobs'
import { registerHhcSessionOwner } from '../hhc-auth'
import {
  getDerivedAsset,
  listMediaJobs,
  putMediaJob,
  resetMediaWorkDBForTests,
  type MediaJobRecord
} from '../media-work-db'
import { putSyncEntry, putSyncTombstone, resetSyncDBForTests } from '../sync-db'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function authorizeHhcPoster(): HhcSession {
  const session: HhcSession = {
    userId: 'user-a',
    displayName: 'User A',
    roles: ['media_sync_user']
  }
  useFileExplorerStore.setState({
    folders: {
      root: {
        id: 'root',
        name: 'Collection A',
        parentId: 'file-root',
        sortIndex: 0,
        createdAt: 1,
        expiresAt: null,
        syncLink: {
          providerConnectionId: 'hhc-line:user-a',
          providerType: 'hhc-line',
          remoteFolderId: 'collection-a',
          offlinePolicy: 'always-offline',
          status: 'active'
        }
      }
    }
  })
  return session
}

describe('video poster authorization', () => {
  const getJob = async (): Promise<MediaJobRecord | undefined> => (await listMediaJobs())[0]
  let currentSession: HhcSession | null = null
  let unregisterSessionOwner = (): void => undefined

  beforeEach(async () => {
    await Promise.all([
      resetMediaWorkDBForTests(),
      resetSyncDBForTests(),
      resetFileExplorerDBForTests()
    ])
    currentSession = null
    unregisterSessionOwner()
    unregisterSessionOwner = registerHhcSessionOwner(() => currentSession)
    useFileExplorerStore.setState({ folders: {} })
  })

  afterEach(() => {
    unregisterSessionOwner()
  })

  it('does not persist a poster job when authorization is already revoked', async () => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { videoPoster: { getInfo: vi.fn(), generate: vi.fn() } }
    })

    await enqueueVideoPosterJob({
      sourceBlobId: 'revoked-video',
      itemId: 'revoked-item',
      canCommit: async () => false
    })

    await expect(listMediaJobs()).resolves.toEqual([])
  })

  it('blocks a poster result and ready event when authorization changes during generation', async () => {
    const generated = deferred<{ dataUrl: string }>()
    const generate = vi.fn(() => generated.promise)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    let authorized = true
    const ready = vi.fn()
    window.addEventListener('hhc:thumbnail-ready', ready)
    await putSyncEntry({
      providerConnectionId: 'hhc-line:user-a',
      remoteItemId: 'guarded-video',
      parentRemoteItemId: 'collection-a',
      kind: 'file',
      name: 'video.mp4',
      itemId: 'guarded-item',
      mimeType: 'video/mp4',
      status: 'available-offline'
    })
    currentSession = authorizeHhcPoster()

    await enqueueVideoPosterJob({
      sourceBlobId: 'guarded-video',
      itemId: 'guarded-item',
      canCommit: async () => authorized
    })
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce())
    authorized = false
    generated.resolve({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' })

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('blocked'))
    await expect(getDerivedAsset('guarded-video', 'cover-thumbnail')).resolves.toBeUndefined()
    expect(ready).not.toHaveBeenCalled()
    window.removeEventListener('hhc:thumbnail-ready', ready)
  })

  it('blocks a late poster result after unlink creates its lifecycle fence', async () => {
    const generated = deferred<{ dataUrl: string }>()
    const generate = vi.fn(() => generated.promise)
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    await putSyncEntry({
      providerConnectionId: 'hhc-line:user-a',
      remoteItemId: 'guarded-video',
      parentRemoteItemId: 'collection-a',
      kind: 'file',
      name: 'video.mp4',
      itemId: 'guarded-item',
      mimeType: 'video/mp4',
      status: 'available-offline'
    })
    currentSession = authorizeHhcPoster()
    await enqueueVideoPosterJob({ sourceBlobId: 'guarded-video', itemId: 'guarded-item' })
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce())

    await putSyncTombstone({
      providerConnectionId: 'hhc-line:user-a',
      remoteItemId: 'collection-a',
      folderId: 'root',
      reason: 'unlink'
    })
    generated.resolve({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' })

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('blocked'))
    await expect(getDerivedAsset('guarded-video', 'cover-thumbnail')).resolves.toBeUndefined()
  })

  it('fails closed when HHC ancestry conflicts with a non-HHC sync entry', async () => {
    const generate = vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' }))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    const db = await openFileExplorerDB()
    await db.put(
      'folder-records',
      authorizeHhcPoster() && useFileExplorerStore.getState().folders.root
    )
    await db.put('folder-items', {
      id: 'conflict-item',
      parentId: 'root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'conflict.mp4',
      url: 'blob:conflict-video',
      size: 5,
      mimeType: 'video/mp4'
    })
    await putSyncEntry({
      providerConnectionId: 'onedrive:user-a',
      remoteItemId: 'remote-video',
      parentRemoteItemId: 'remote-root',
      kind: 'file',
      name: 'conflict.mp4',
      itemId: 'conflict-item',
      mimeType: 'video/mp4',
      status: 'available-offline'
    })
    currentSession = authorizeHhcPoster()

    await enqueueVideoPosterJob({ sourceBlobId: 'conflict-video', itemId: 'conflict-item' })

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('blocked'))
    expect(generate).not.toHaveBeenCalled()
  })

  it('fails closed when duplicate entries claim different HHC scopes', async () => {
    const generate = vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' }))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    await Promise.all(
      ['collection-a', 'collection-b'].map((parentRemoteItemId, index) =>
        putSyncEntry({
          providerConnectionId: 'hhc-line:user-a',
          remoteItemId: `remote-video-${index}`,
          parentRemoteItemId,
          kind: 'file',
          name: 'duplicate.mp4',
          itemId: 'duplicate-item',
          mimeType: 'video/mp4',
          status: 'available-offline'
        })
      )
    )
    currentSession = authorizeHhcPoster()

    await enqueueVideoPosterJob({ sourceBlobId: 'duplicate-video', itemId: 'duplicate-item' })

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('blocked'))
    expect(generate).not.toHaveBeenCalled()
  })

  it('fails closed when HHC ancestry and its entry claim different roots', async () => {
    const generate = vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' }))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    const db = await openFileExplorerDB()
    const root = authorizeHhcPoster() && useFileExplorerStore.getState().folders.root
    await db.put('folder-records', root)
    await db.put('folder-items', {
      id: 'ancestry-conflict-item',
      parentId: 'root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'conflict.mp4',
      url: 'blob:ancestry-conflict-video',
      size: 5,
      mimeType: 'video/mp4'
    })
    await putSyncEntry({
      providerConnectionId: 'hhc-line:user-a',
      remoteItemId: 'remote-video',
      parentRemoteItemId: 'collection-b',
      kind: 'file',
      name: 'conflict.mp4',
      itemId: 'ancestry-conflict-item',
      mimeType: 'video/mp4',
      status: 'available-offline'
    })
    currentSession = authorizeHhcPoster()

    await enqueueVideoPosterJob({
      sourceBlobId: 'ancestry-conflict-video',
      itemId: 'ancestry-conflict-item'
    })

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('blocked'))
    expect(generate).not.toHaveBeenCalled()
  })

  it('keeps a sibling root available while another root has an unlink tombstone', async () => {
    const generate = vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' }))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    const db = await openFileExplorerDB()
    await db.put('folder-records', {
      id: 'root-b',
      name: 'B',
      parentId: 'file-root',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerConnectionId: 'onedrive:user-a',
        providerType: 'onedrive',
        remoteFolderId: 'root-b',
        offlinePolicy: 'always-offline'
      }
    })
    await db.put('folder-items', {
      id: 'sibling-item',
      parentId: 'root-b',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'sibling.mp4',
      url: 'blob:sibling-video',
      size: 5,
      mimeType: 'video/mp4'
    })
    await putSyncTombstone({
      providerConnectionId: 'onedrive:user-a',
      remoteItemId: 'root-a',
      folderId: 'root-a',
      reason: 'unlink'
    })

    await enqueueVideoPosterJob({ sourceBlobId: 'sibling-video', itemId: 'sibling-item' })

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('completed'))
    expect(generate).toHaveBeenCalledOnce()
  })

  it('keeps a legacy persisted HHC poster blocked when a generic retry has no live session', async () => {
    const generate = vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' }))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    const now = Date.now()
    await putMediaJob({
      id: 'persisted-guarded-job',
      type: 'video-poster',
      sourceBlobId: 'persisted-video',
      itemId: 'persisted-item',
      dedupeKey: 'video-poster:persisted-video',
      priority: 0,
      status: 'blocked',
      blockedReason: 'authentication',
      progress: 0,
      attempt: 0,
      createdAt: now,
      updatedAt: now
    } as MediaJobRecord)
    await putSyncEntry({
      providerConnectionId: 'hhc-line:user-a',
      remoteItemId: 'remote-video',
      parentRemoteItemId: 'collection-a',
      kind: 'file',
      name: 'video.mp4',
      itemId: 'persisted-item',
      mimeType: 'video/mp4',
      status: 'available-offline'
    })

    await mediaJobQueue.retry('persisted-guarded-job')

    await vi.waitFor(async () => {
      expect((await getJob())?.status).toBe('blocked')
      expect((await getJob())?.attempt).toBe(1)
    })
    expect(generate).not.toHaveBeenCalled()
    await expect(getDerivedAsset('persisted-video', 'cover-thumbnail')).resolves.toBeUndefined()
  })

  it('blocks stale HHC recovery when the live session has no active root', async () => {
    const generate = vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' }))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    currentSession = {
      userId: 'user-a',
      displayName: 'User A',
      roles: ['media_sync_user']
    }
    const now = Date.now()
    await putMediaJob({
      id: 'stale-hhc-job',
      type: 'video-poster',
      sourceBlobId: 'stale-video',
      itemId: 'stale-item',
      dedupeKey: 'video-poster:stale-video',
      priority: 0,
      status: 'running',
      progress: 0,
      attempt: 1,
      createdAt: now - 1,
      updatedAt: now - 1
    })
    await putSyncEntry({
      providerConnectionId: 'hhc-line:user-a',
      remoteItemId: 'remote-video',
      parentRemoteItemId: 'missing-root',
      kind: 'file',
      name: 'video.mp4',
      itemId: 'stale-item',
      mimeType: 'video/mp4',
      status: 'available-offline'
    })

    await mediaJobQueue.recoverStaleJobs(now, 0)

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('blocked'))
    expect(generate).not.toHaveBeenCalled()
  })

  it('tracks the live session owner when retrying a persisted HHC poster', async () => {
    const generate = vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' }))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    const now = Date.now()
    await putMediaJob({
      id: 'authorized-persisted-job',
      type: 'video-poster',
      sourceBlobId: 'authorized-video',
      itemId: 'authorized-item',
      dedupeKey: 'video-poster:authorized-video',
      priority: 0,
      status: 'blocked',
      blockedReason: 'authentication',
      progress: 0,
      attempt: 1,
      createdAt: now,
      updatedAt: now
    } as MediaJobRecord)

    await putSyncEntry({
      providerConnectionId: 'hhc-line:user-a',
      remoteItemId: 'remote-video',
      parentRemoteItemId: 'collection-a',
      kind: 'file',
      name: 'video.mp4',
      itemId: 'authorized-item',
      mimeType: 'video/mp4',
      status: 'available-offline'
    })
    currentSession = authorizeHhcPoster()
    currentSession = null
    await mediaJobQueue.retry('authorized-persisted-job')

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('blocked'))
    expect(generate).not.toHaveBeenCalled()

    currentSession = authorizeHhcPoster()
    await mediaJobQueue.retry('authorized-persisted-job')

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('completed'))
    expect(generate).toHaveBeenCalledOnce()
    await expect(getDerivedAsset('authorized-video', 'cover-thumbnail')).resolves.toBeDefined()
  })

  it('blocks an ambiguous legacy poster whose item ownership disappeared', async () => {
    const generate = vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' }))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    const now = Date.now()
    await putMediaJob({
      id: 'ambiguous-legacy-job',
      type: 'video-poster',
      sourceBlobId: 'ambiguous-video',
      itemId: 'missing-item',
      dedupeKey: 'video-poster:ambiguous-video',
      priority: 0,
      status: 'blocked',
      blockedReason: 'authentication',
      progress: 0,
      attempt: 0,
      createdAt: now,
      updatedAt: now
    })

    await mediaJobQueue.retry('ambiguous-legacy-job')

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('blocked'))
    expect(generate).not.toHaveBeenCalled()
  })

  it('allows an unguarded local poster with explicit local ownership', async () => {
    const generate = vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' }))
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        videoPoster: {
          getInfo: vi.fn(async () => ({ status: 'ready' })),
          generate
        }
      }
    })
    await (
      await openFileExplorerDB()
    ).put('folder-items', {
      id: 'local-item',
      parentId: 'file-root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'local.mp4',
      url: 'blob:local-video',
      size: 5,
      mimeType: 'video/mp4'
    })

    await enqueueVideoPosterJob({ sourceBlobId: 'local-video', itemId: 'local-item' })

    await vi.waitFor(async () => expect((await getJob())?.status).toBe('completed'))
    expect(generate).toHaveBeenCalledOnce()
  })

  it('does not enqueue late OneDrive poster work after root unlink starts', async () => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { videoPoster: { getInfo: vi.fn(), generate: vi.fn() } }
    })
    const db = await openFileExplorerDB()
    await db.put('folder-records', {
      id: 'onedrive-root',
      name: 'OneDrive',
      parentId: 'file-root',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerConnectionId: 'onedrive:user-a',
        providerType: 'onedrive',
        remoteFolderId: 'root-a',
        offlinePolicy: 'always-offline'
      }
    })
    await db.put('folder-items', {
      id: 'late-item',
      parentId: 'onedrive-root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'late.mp4',
      url: 'blob:late-video',
      size: 5,
      mimeType: 'video/mp4'
    })
    const releaseFence = fenceVideoPosterScope('onedrive:user-a', 'root-a')

    await enqueueVideoPosterJob({ sourceBlobId: 'late-video', itemId: 'late-item' })

    await expect(listMediaJobs()).resolves.toEqual([])
    releaseFence()
  })

  it('does not enqueue nested poster work after its top-level root unlink starts', async () => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { videoPoster: { getInfo: vi.fn(), generate: vi.fn() } }
    })
    const db = await openFileExplorerDB()
    await db.put('folder-records', {
      id: 'onedrive-root',
      name: 'OneDrive',
      parentId: 'file-root',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerConnectionId: 'onedrive:user-a',
        providerType: 'onedrive',
        remoteFolderId: 'root-a',
        offlinePolicy: 'always-offline'
      }
    })
    await db.put('folder-records', {
      id: 'onedrive-child',
      name: 'Child',
      parentId: 'onedrive-root',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerConnectionId: 'onedrive:user-a',
        providerType: 'onedrive',
        remoteFolderId: 'child-folder',
        offlinePolicy: 'always-offline'
      }
    })
    await db.put('folder-items', {
      id: 'nested-late-item',
      parentId: 'onedrive-child',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'nested-late.mp4',
      url: 'blob:nested-late-video',
      size: 5,
      mimeType: 'video/mp4'
    })
    const releaseFence = fenceVideoPosterScope('onedrive:user-a', 'root-a')

    await enqueueVideoPosterJob({
      sourceBlobId: 'nested-late-video',
      itemId: 'nested-late-item'
    })

    await expect(listMediaJobs()).resolves.toEqual([])
    releaseFence()
  })

  it('does not trust a nested OneDrive entry after its local item is cleaned', async () => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { videoPoster: { getInfo: vi.fn(), generate: vi.fn() } }
    })
    await putSyncEntry({
      providerConnectionId: 'onedrive:user-a',
      remoteItemId: 'late-video',
      parentRemoteItemId: 'child-folder',
      kind: 'file',
      name: 'late.mp4',
      itemId: 'cleaned-item',
      mimeType: 'video/mp4',
      status: 'available-offline'
    })
    const releaseFence = fenceVideoPosterScope('onedrive:user-a', 'root-a')

    await enqueueVideoPosterJob({ sourceBlobId: 'late-video', itemId: 'cleaned-item' })

    await expect(listMediaJobs()).resolves.toEqual([])
    releaseFence()
  })

  it('does not enqueue late local poster work after connection unlink starts', async () => {
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { videoPoster: { getInfo: vi.fn(), generate: vi.fn() } }
    })
    const db = await openFileExplorerDB()
    await db.put('folder-records', {
      id: 'local-root',
      name: 'Local',
      parentId: 'file-root',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerConnectionId: 'local:folder-a',
        providerType: 'local-fs',
        remoteFolderId: '.',
        offlinePolicy: 'always-offline'
      }
    })
    await db.put('folder-items', {
      id: 'late-local-item',
      parentId: 'local-root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'late.mp4',
      url: 'blob:late-local-video',
      size: 5,
      mimeType: 'video/mp4'
    })
    const releaseFence = fenceVideoPosterScope('local:folder-a')

    await enqueueVideoPosterJob({
      sourceBlobId: 'late-local-video',
      itemId: 'late-local-item'
    })

    await expect(listMediaJobs()).resolves.toEqual([])
    releaseFence()
  })

  it.each(['completed', 'cancelled'] as const)(
    'creates a new unguarded poster job after %s history',
    async (status) => {
      Object.defineProperty(window, 'api', {
        configurable: true,
        value: {
          videoPoster: {
            getInfo: vi.fn(async () => ({ status: 'ready' })),
            generate: vi.fn(async () => ({ dataUrl: 'data:image/jpeg;base64,cG9zdGVy' }))
          }
        }
      })
      const now = Date.now()
      await putMediaJob({
        id: `${status}-poster`,
        type: 'video-poster',
        sourceBlobId: `${status}-video`,
        itemId: `${status}-item`,
        dedupeKey: `video-poster:${status}-video`,
        priority: 0,
        status,
        progress: status === 'completed' ? 100 : 0,
        attempt: 1,
        createdAt: now,
        updatedAt: now
      })
      await (
        await openFileExplorerDB()
      ).put('folder-items', {
        id: `${status}-item`,
        parentId: 'file-root',
        type: 'file',
        sortIndex: 0,
        createdAt: 1,
        expiresAt: null,
        name: `${status}.mp4`,
        url: `blob:${status}-video`,
        size: 5,
        mimeType: 'video/mp4'
      })

      await enqueueVideoPosterJob({
        sourceBlobId: `${status}-video`,
        itemId: `${status}-item`
      })

      await vi.waitFor(async () => expect(await listMediaJobs()).toHaveLength(2))
    }
  )
})
