import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReadOnlySyncProvider, SyncDownloadResult } from '../sync-provider'
import {
  enqueueSyncDownload,
  resetSyncDownloadQueueForTests,
  SYNC_DOWNLOAD_CONCURRENCY
} from '../sync-download-queue'
import { getSyncEntryByRemoteItem, resetSyncDBForTests } from '../sync-db'

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function makeEntry(
  remoteItemId: string,
  itemId = remoteItemId
): {
  providerConnectionId: string
  remoteItemId: string
  parentRemoteItemId: string
  kind: 'file'
  name: string
  itemId: string
  mimeType: string
  size: number
} {
  return {
    providerConnectionId: 'connection-1',
    remoteItemId,
    parentRemoteItemId: 'folder-1',
    kind: 'file' as const,
    name: `${remoteItemId}.png`,
    itemId,
    mimeType: 'image/png',
    size: 100
  }
}

function makeProvider(
  downloadContent: ReadOnlySyncProvider['downloadContent'],
  classifyError: ReadOnlySyncProvider['classifyError'] = () => 'fatal'
): ReadOnlySyncProvider {
  return {
    providerType: 'onedrive',
    connect: vi.fn(),
    disconnect: vi.fn(),
    initialScan: vi.fn(),
    incrementalChanges: vi.fn(),
    getMetadata: vi.fn(),
    downloadContent,
    classifyError
  }
}

describe('sync download queue', () => {
  beforeEach(async () => {
    resetSyncDownloadQueueForTests()
    await resetSyncDBForTests()
    vi.clearAllMocks()
  })

  it('uses one concurrent download', () => {
    expect(SYNC_DOWNLOAD_CONCURRENCY).toBe(1)
  })

  it('runs presentation priority before background work that has not started', async () => {
    const first = deferred<SyncDownloadResult>()
    const second = deferred<SyncDownloadResult>()
    const third = deferred<SyncDownloadResult>()
    const started: string[] = []
    const pending = new Map([
      ['background-1', first],
      ['background-2', second],
      ['presentation-1', third]
    ])
    const provider = makeProvider(
      vi.fn(async (request) => {
        started.push(request.remoteItemId)
        return pending.get(request.remoteItemId)!.promise
      })
    )

    const firstDownload = enqueueSyncDownload({
      provider,
      request: {
        providerConnectionId: 'connection-1',
        remoteItemId: 'background-1',
        targetBlobId: 'background-1',
        offlinePolicy: 'always-offline'
      },
      entry: makeEntry('background-1'),
      priority: 'background'
    })

    await vi.waitFor(() => expect(started).toEqual(['background-1']))

    const background = enqueueSyncDownload({
      provider,
      request: {
        providerConnectionId: 'connection-1',
        remoteItemId: 'background-2',
        targetBlobId: 'background-2',
        offlinePolicy: 'always-offline'
      },
      entry: makeEntry('background-2'),
      priority: 'background'
    })
    const presentation = enqueueSyncDownload({
      provider,
      request: {
        providerConnectionId: 'connection-1',
        remoteItemId: 'presentation-1',
        targetBlobId: 'presentation-1',
        offlinePolicy: 'always-offline'
      },
      entry: makeEntry('presentation-1'),
      priority: 'presentation'
    })

    first.resolve({ blobId: 'background-1', size: 100, mimeType: 'image/png' })
    await firstDownload
    await vi.waitFor(() => expect(started).toEqual(['background-1', 'presentation-1']))

    third.resolve({ blobId: 'presentation-1', size: 100, mimeType: 'image/png' })
    await presentation
    await vi.waitFor(() =>
      expect(started).toEqual(['background-1', 'presentation-1', 'background-2'])
    )
    second.resolve({ blobId: 'background-2', size: 100, mimeType: 'image/png' })
    await background
  })

  it('coalesces duplicate downloads for the same provider remote item', async () => {
    const done = deferred<SyncDownloadResult>()
    const provider = makeProvider(vi.fn(async () => done.promise))

    const first = enqueueSyncDownload({
      provider,
      request: {
        providerConnectionId: 'connection-1',
        remoteItemId: 'remote-1',
        targetBlobId: 'item-1',
        offlinePolicy: 'always-offline'
      },
      entry: makeEntry('remote-1', 'item-1'),
      priority: 'background'
    })
    const second = enqueueSyncDownload({
      provider,
      request: {
        providerConnectionId: 'connection-1',
        remoteItemId: 'remote-1',
        targetBlobId: 'item-1',
        offlinePolicy: 'always-offline'
      },
      entry: makeEntry('remote-1', 'item-1'),
      priority: 'presentation'
    })

    done.resolve({ blobId: 'item-1', size: 100, mimeType: 'image/png' })

    await expect(Promise.all([first, second])).resolves.toEqual([
      { blobId: 'item-1', size: 100, mimeType: 'image/png' },
      { blobId: 'item-1', size: 100, mimeType: 'image/png' }
    ])
    expect(provider.downloadContent).toHaveBeenCalledTimes(1)
  })

  it('writes retry metadata when a download fails', async () => {
    const provider = makeProvider(
      vi.fn(async () => {
        throw new Error('network down')
      }),
      () => 'retryable'
    )

    await expect(
      enqueueSyncDownload({
        provider,
        request: {
          providerConnectionId: 'connection-1',
          remoteItemId: 'remote-1',
          targetBlobId: 'item-1',
          offlinePolicy: 'always-offline'
        },
        entry: makeEntry('remote-1', 'item-1'),
        priority: 'background'
      })
    ).resolves.toBeNull()

    const entry = await getSyncEntryByRemoteItem('connection-1', 'remote-1')
    expect(entry).toMatchObject({
      status: 'failed',
      errorKind: 'retryable',
      retryCount: 1,
      lastError: 'network down'
    })
    expect(entry?.nextRetryAt).toEqual(expect.any(Number))
  })
})
