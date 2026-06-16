import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveWebOneDriveDownloadedContent } from '../sync-download-storage'
import { MAX_FILE_SIZE_WEB } from '../media-limits'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import { getSyncEntryByRemoteItem, resetSyncDBForTests } from '../sync-db'

vi.mock('../env', () => ({
  isElectron: vi.fn(() => false),
  isWeb: vi.fn(() => true)
}))

import { isElectron } from '../env'

const request = {
  providerConnectionId: 'connection-1',
  remoteItemId: 'remote-file-1',
  targetBlobId: 'blob-1',
  offlinePolicy: 'on-demand' as const
}

const metadata = {
  remoteItemId: 'remote-file-1',
  parentRemoteItemId: 'remote-folder-1',
  kind: 'file' as const,
  name: 'clip.mp4',
  mimeType: 'video/mp4',
  size: 10,
  etag: 'etag-1',
  contentHash: 'hash-1'
}

beforeEach(async () => {
  await resetFileExplorerDBForTests()
  await resetSyncDBForTests()
  vi.mocked(isElectron).mockReturnValue(false)
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: {
      estimate: vi.fn(async () => ({ quota: 1024 * 1024, usage: 0 }))
    }
  })
})

describe('saveWebOneDriveDownloadedContent', () => {
  it('stores downloaded content in IndexedDB and marks the sync entry available offline', async () => {
    const response = new Response(new Blob(['video-bytes'], { type: 'video/mp4' }), {
      headers: { 'Content-Length': '11' }
    })

    await expect(saveWebOneDriveDownloadedContent(request, response, metadata)).resolves.toEqual({
      blobId: 'blob-1',
      size: 13,
      mimeType: 'video/mp4'
    })

    const db = await openFileExplorerDB()
    await expect(db.get('file-blobs', 'blob-1')).resolves.toMatchObject({
      id: 'blob-1',
      storage: 'indexed-db',
      size: 13,
      refCount: 1
    })
    await expect(getSyncEntryByRemoteItem('connection-1', 'remote-file-1')).resolves.toMatchObject({
      blobId: 'blob-1',
      status: 'available-offline',
      etag: 'etag-1',
      contentHash: 'hash-1'
    })
  })

  it('rejects downloads above the Web 2GB product limit', async () => {
    const response = new Response('', {
      headers: { 'Content-Length': String(MAX_FILE_SIZE_WEB + 1) }
    })

    await expect(saveWebOneDriveDownloadedContent(request, response, metadata)).rejects.toThrow(
      'OneDrive file exceeds the Web 2GB limit'
    )
  })

  it('rejects downloads when browser quota is insufficient', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        estimate: vi.fn(async () => ({ quota: 10, usage: 9 }))
      }
    })
    const response = new Response(new Blob(['video-bytes'], { type: 'video/mp4' }), {
      headers: { 'Content-Length': '11' }
    })

    await expect(saveWebOneDriveDownloadedContent(request, response, metadata)).rejects.toThrow(
      'Insufficient browser storage for OneDrive file'
    )
  })

  it('does not allow Electron to use the Web Blob download path', async () => {
    vi.mocked(isElectron).mockReturnValue(true)

    await expect(
      saveWebOneDriveDownloadedContent(request, new Response(''), metadata)
    ).rejects.toThrow('Electron OneDrive downloads must use native streaming storage')
  })
})
