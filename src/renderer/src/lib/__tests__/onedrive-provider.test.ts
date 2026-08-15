import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assertProviderDoesNotExposeWriteOperations } from '../sync-provider'
import { OneDriveReadonlyProvider } from '../onedrive-provider'
import { getProviderConnection, resetSyncDBForTests } from '../sync-db'

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('OneDriveReadonlyProvider', () => {
  const getAccessToken = vi.fn(async () => 'access-token')
  const fetchImpl = vi.fn()
  const saveDownloadedContent = vi.fn()

  beforeEach(async () => {
    vi.clearAllMocks()
    await resetSyncDBForTests()
    saveDownloadedContent.mockResolvedValue({
      blobId: 'target-blob',
      size: 1024,
      mimeType: 'video/mp4'
    })
  })

  function createProvider(): OneDriveReadonlyProvider {
    return new OneDriveReadonlyProvider({
      getAccessToken,
      fetchImpl,
      saveDownloadedContent
    })
  }

  it('connects by storing only provider metadata', async () => {
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({
        id: 'account-1',
        displayName: 'Alice',
        userPrincipalName: 'alice@example.com'
      })
    )

    const connection = await createProvider().connect()

    expect(connection).toMatchObject({
      id: 'onedrive:account-1',
      providerType: 'onedrive',
      displayName: 'OneDrive - Alice',
      accountLabel: 'alice@example.com'
    })
    await expect(getProviderConnection('onedrive:account-1')).resolves.not.toHaveProperty(
      'accessToken'
    )
    await expect(getProviderConnection('onedrive:account-1')).resolves.not.toHaveProperty(
      'refreshToken'
    )
  })

  it('maps root delta pages into sync changes', async () => {
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({
        value: [
          {
            id: 'folder-1',
            name: 'Media',
            folder: {},
            parentReference: { id: 'root' },
            eTag: 'folder-etag'
          },
          {
            id: 'file-1',
            name: 'clip.mp4',
            file: {
              mimeType: 'video/mp4',
              hashes: { quickXorHash: 'hash-1' }
            },
            parentReference: { id: 'folder-1' },
            size: 1024,
            eTag: 'file-etag'
          }
        ],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/drive/root/delta?token=next'
      })
    )

    const page = await createProvider().initialScan('connection-1', 'root')

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me/drive/root/delta',
      expect.objectContaining({
        headers: expect.any(Headers)
      })
    )
    expect(page).toEqual({
      items: [
        {
          remoteItemId: 'folder-1',
          parentRemoteItemId: 'root',
          kind: 'folder',
          name: 'Media',
          mimeType: undefined,
          size: undefined,
          etag: 'folder-etag',
          contentHash: undefined,
          deleted: false
        },
        {
          remoteItemId: 'file-1',
          parentRemoteItemId: 'folder-1',
          kind: 'file',
          name: 'clip.mp4',
          mimeType: 'video/mp4',
          size: 1024,
          etag: 'file-etag',
          contentHash: 'hash-1',
          deleted: false
        }
      ],
      nextCursor: 'https://graph.microsoft.com/v1.0/me/drive/root/delta?token=next',
      hasMore: true
    })
  })

  it('lists OneDrive folders without files', async () => {
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({
        value: [
          {
            id: 'folder-1',
            name: 'Media',
            folder: {},
            parentReference: { id: 'root' }
          },
          {
            id: 'file-1',
            name: 'clip.mp4',
            file: { mimeType: 'video/mp4' },
            parentReference: { id: 'root' }
          }
        ],
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/drive/root/children?skip=2'
      })
    )
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({
        value: [
          {
            id: 'folder-2',
            name: 'Drama',
            folder: {},
            parentReference: { id: 'root' }
          }
        ]
      })
    )

    const folders = await createProvider().listFolders('root')

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://graph.microsoft.com/v1.0/me/drive/root/children',
      expect.any(Object)
    )
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'https://graph.microsoft.com/v1.0/me/drive/root/children?skip=2',
      expect.any(Object)
    )
    expect(folders).toEqual([
      {
        remoteItemId: 'folder-1',
        parentRemoteItemId: 'root',
        kind: 'folder',
        name: 'Media',
        mimeType: undefined,
        size: undefined,
        etag: undefined,
        contentHash: undefined,
        deleted: false
      },
      {
        remoteItemId: 'folder-2',
        parentRemoteItemId: 'root',
        kind: 'folder',
        name: 'Drama',
        mimeType: undefined,
        size: undefined,
        etag: undefined,
        contentHash: undefined,
        deleted: false
      }
    ])
  })

  it('uses opaque next or delta cursors for incremental changes', async () => {
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({
        value: [
          {
            id: 'file-1',
            name: 'clip.mp4',
            file: { mimeType: 'video/mp4' },
            deleted: {}
          }
        ],
        '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/drive/root/delta?token=delta'
      })
    )

    const page = await createProvider().incrementalChanges({
      providerConnectionId: 'connection-1',
      remoteFolderId: 'root',
      cursor: 'https://graph.microsoft.com/v1.0/me/drive/root/delta?token=next'
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me/drive/root/delta?token=next',
      expect.any(Object)
    )
    expect(page.hasMore).toBe(false)
    expect(page.nextCursor).toBe('https://graph.microsoft.com/v1.0/me/drive/root/delta?token=delta')
    expect(page.items[0]).toMatchObject({ remoteItemId: 'file-1', deleted: true })
  })

  it('downloads content through the injected storage callback', async () => {
    fetchImpl
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'file-1',
          name: 'clip.mp4',
          file: { mimeType: 'video/mp4' },
          parentReference: { id: 'root' },
          size: 1024
        })
      )
      .mockResolvedValueOnce(new Response('video-bytes'))

    const request = {
      providerConnectionId: 'connection-1',
      remoteItemId: 'file-1',
      targetBlobId: 'target-blob',
      offlinePolicy: 'on-demand' as const
    }
    await expect(
      createProvider().downloadContent(request, new AbortController().signal, () => true)
    ).resolves.toEqual({
      blobId: 'target-blob',
      size: 1024,
      mimeType: 'video/mp4'
    })
    expect(saveDownloadedContent).toHaveBeenCalledWith(
      request,
      expect.any(Response),
      expect.objectContaining({
        remoteItemId: 'file-1',
        mimeType: 'video/mp4'
      }),
      expect.any(Function)
    )
  })

  it('does not save downloaded content when the commit guard is cancelled', async () => {
    fetchImpl
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'file-1',
          name: 'clip.mp4',
          file: { mimeType: 'video/mp4' },
          parentReference: { id: 'root' },
          size: 1024
        })
      )
      .mockResolvedValueOnce(new Response('video-bytes'))
    const request = {
      providerConnectionId: 'connection-1',
      remoteItemId: 'file-1',
      targetBlobId: 'target-blob',
      offlinePolicy: 'on-demand' as const
    }

    await expect(
      createProvider().downloadContent(request, new AbortController().signal, () => false)
    ).rejects.toThrow('Sync download cancelled')
    expect(saveDownloadedContent).not.toHaveBeenCalled()
  })

  it('passes the commit guard into storage when cancellation happens during save', async () => {
    const saveStarted = deferred<void>()
    const releaseSave = deferred<void>()
    let canCommit = true
    saveDownloadedContent.mockImplementationOnce(async (_request, _response, _metadata, guard) => {
      saveStarted.resolve()
      await releaseSave.promise
      if (!(await guard())) throw new Error('storage commit cancelled')
      return { blobId: 'target-blob', size: 1024, mimeType: 'video/mp4' }
    })
    fetchImpl
      .mockResolvedValueOnce(
        jsonResponse({
          id: 'file-1',
          name: 'clip.mp4',
          file: { mimeType: 'video/mp4' },
          parentReference: { id: 'root' },
          size: 1024
        })
      )
      .mockResolvedValueOnce(new Response('video-bytes'))

    const downloading = createProvider().downloadContent(
      {
        providerConnectionId: 'connection-1',
        remoteItemId: 'file-1',
        targetBlobId: 'target-blob',
        offlinePolicy: 'on-demand'
      },
      new AbortController().signal,
      () => canCommit
    )
    await saveStarted.promise
    canCommit = false
    releaseSave.resolve()

    await expect(downloading).rejects.toThrow('storage commit cancelled')
  })

  it('can leave content downloading to the injected storage callback', async () => {
    fetchImpl.mockResolvedValueOnce(
      jsonResponse({
        id: 'file-1',
        name: 'image.png',
        file: { mimeType: 'image/png' },
        parentReference: { id: 'root' },
        size: 1024
      })
    )

    const provider = new OneDriveReadonlyProvider({
      getAccessToken,
      fetchImpl,
      fetchContentBeforeSave: false,
      saveDownloadedContent
    })
    const request = {
      providerConnectionId: 'connection-1',
      remoteItemId: 'file-1',
      targetBlobId: 'target-blob',
      offlinePolicy: 'always-offline' as const
    }

    await expect(
      provider.downloadContent(request, new AbortController().signal, () => true)
    ).resolves.toEqual({
      blobId: 'target-blob',
      size: 1024,
      mimeType: 'video/mp4'
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://graph.microsoft.com/v1.0/me/drive/items/file-1',
      expect.any(Object)
    )
    expect(saveDownloadedContent).toHaveBeenCalledWith(
      request,
      expect.objectContaining({ status: 204 }),
      expect.objectContaining({ remoteItemId: 'file-1', mimeType: 'image/png' }),
      expect.any(Function)
    )
  })

  it('classifies auth, retryable, offline, and fatal errors', () => {
    const provider = createProvider()

    expect(provider.classifyError({ status: 401 })).toBe('auth-required')
    expect(provider.classifyError({ status: 429 })).toBe('retryable')
    expect(provider.classifyError(new TypeError('Failed to fetch'))).toBe('offline')
    expect(provider.classifyError(new Error('bad input'))).toBe('fatal')
  })

  it('does not expose OneDrive write operations', () => {
    expect(() => assertProviderDoesNotExposeWriteOperations(createProvider())).not.toThrow()
  })
})
