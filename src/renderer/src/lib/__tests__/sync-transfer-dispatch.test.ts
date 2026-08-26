import type { FileItemRecord } from '@shared/types/folder'
import { dispatchPlannedSyncDownloads } from '../sync-transfer-dispatch'
import { enqueueSyncDownload } from '../sync-download-queue'
import type { ReadOnlySyncProvider, RemoteSyncItem } from '../sync-provider'
import type { SyncEntryRecord } from '../sync-db'

vi.mock('../sync-download-queue', () => ({
  enqueueSyncDownload: vi.fn()
}))

const fileItem = (id: string, name: string, mimeType: string): FileItemRecord => ({
  id,
  parentId: 'local-root',
  type: 'file',
  sortIndex: 0,
  createdAt: 1,
  expiresAt: null,
  name,
  url: `blob:${id}`,
  size: 10,
  mimeType
})

const remoteItem = (
  remoteItemId: string,
  name: string,
  mimeType: string,
  etag: string
): RemoteSyncItem => ({
  remoteItemId,
  parentRemoteItemId: 'remote-root',
  kind: 'file',
  name,
  mimeType,
  size: 10,
  etag,
  contentHash: `hash-${remoteItemId}`
})

const syncEntry = (
  remoteItemId: string,
  itemId: string,
  status: SyncEntryRecord['status']
): SyncEntryRecord => ({
  id: `connection-1:${remoteItemId}`,
  providerConnectionId: 'connection-1',
  remoteItemId,
  parentRemoteItemId: 'remote-root',
  kind: 'file',
  name: `${remoteItemId}.jpg`,
  itemId,
  status,
  createdAt: 1,
  updatedAt: 1
})

describe('dispatchPlannedSyncDownloads', () => {
  it('queues only planned transfers with metadata, guards, and matching local items', async () => {
    const jpg = fileItem('local-jpg', 'photo.jpg', 'image/jpeg')
    const pptx = fileItem(
      'local-pptx',
      'slides.pptx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    )
    const unchanged = fileItem('local-unchanged', 'ready.jpg', 'image/jpeg')
    const jpgRemote = remoteItem('remote-jpg', jpg.name, jpg.mimeType, 'etag-jpg')
    const pptxRemote = remoteItem('remote-pptx', pptx.name, pptx.mimeType, 'etag-pptx')
    const unchangedRemote = remoteItem(
      'remote-unchanged',
      unchanged.name,
      unchanged.mimeType,
      'etag-unchanged'
    )
    const previousJpg = syncEntry('remote-jpg', jpg.id, 'outdated')
    const previousPptx = syncEntry('remote-pptx', pptx.id, 'failed')
    const provider = {
      providerType: 'onedrive'
    } as ReadOnlySyncProvider
    const canCommit = vi.fn(async () => true)
    const onFailed = vi.fn(async () => undefined)
    const onDownloaded = vi.fn(async () => undefined)

    dispatchPlannedSyncDownloads({
      provider,
      providerConnectionId: 'connection-1',
      rootRemoteFolderId: 'remote-root',
      offlinePolicy: 'always-offline',
      plan: {
        fileTransfers: [
          { itemId: jpg.id, remoteItemId: jpgRemote.remoteItemId, mimeType: jpg.mimeType },
          { itemId: pptx.id, remoteItemId: pptxRemote.remoteItemId, mimeType: pptx.mimeType }
        ],
        items: [jpg, pptx, unchanged]
      },
      remoteItems: [jpgRemote, pptxRemote, unchangedRemote],
      existingEntries: [
        previousJpg,
        previousPptx,
        syncEntry('remote-unchanged', unchanged.id, 'available-offline')
      ],
      canCommit,
      onFailed,
      onDownloaded
    })

    expect(enqueueSyncDownload).toHaveBeenCalledTimes(2)
    expect(enqueueSyncDownload).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        provider,
        request: {
          providerConnectionId: 'connection-1',
          rootRemoteFolderId: 'remote-root',
          remoteItemId: 'remote-jpg',
          targetBlobId: 'local-jpg',
          offlinePolicy: 'always-offline'
        },
        entry: {
          providerConnectionId: 'connection-1',
          remoteItemId: 'remote-jpg',
          parentRemoteItemId: 'remote-root',
          kind: 'file',
          name: 'photo.jpg',
          itemId: 'local-jpg',
          mimeType: 'image/jpeg',
          size: 10,
          etag: 'etag-jpg',
          contentHash: 'hash-remote-jpg'
        },
        previousEntry: previousJpg,
        priority: 'background',
        canCommit: expect.any(Function),
        onFailed: expect.any(Function),
        onDownloaded: expect.any(Function)
      })
    )
    expect(enqueueSyncDownload).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        request: expect.objectContaining({
          remoteItemId: 'remote-pptx',
          targetBlobId: 'local-pptx'
        }),
        entry: expect.objectContaining({
          name: 'slides.pptx',
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          etag: 'etag-pptx',
          contentHash: 'hash-remote-pptx'
        }),
        previousEntry: previousPptx
      })
    )

    const queuedJpg = vi.mocked(enqueueSyncDownload).mock.calls[0]![0]
    await expect(queuedJpg.canCommit?.()).resolves.toBe(true)
    expect(canCommit).toHaveBeenCalledWith({
      itemId: 'local-jpg',
      remoteItemId: 'remote-jpg',
      mimeType: 'image/jpeg'
    })
    const failure = new Error('download failed')
    await queuedJpg.onFailed?.(failure)
    expect(onFailed).toHaveBeenCalledWith(failure, {
      itemId: 'local-jpg',
      remoteItemId: 'remote-jpg',
      mimeType: 'image/jpeg'
    })
    const jpgCommitGuard = vi.fn(async () => true)
    await queuedJpg.onDownloaded?.(
      { blobId: 'local-jpg', size: 10, mimeType: 'image/jpeg' },
      jpgCommitGuard
    )
    const queuedPptx = vi.mocked(enqueueSyncDownload).mock.calls[1]![0]
    const pptxCommitGuard = vi.fn(async () => true)
    await queuedPptx.onDownloaded?.(
      { blobId: 'local-pptx', size: 10, mimeType: pptx.mimeType },
      pptxCommitGuard
    )
    expect(onDownloaded).toHaveBeenNthCalledWith(1, jpg, jpgCommitGuard)
    expect(onDownloaded).toHaveBeenNthCalledWith(2, pptx, pptxCommitGuard)
  })
})
