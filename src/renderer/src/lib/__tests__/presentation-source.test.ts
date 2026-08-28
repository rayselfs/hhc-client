import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getBlobId } from '../blob-identity'
import { PPTX_MIME_TYPE } from '../presentation-media'
import { readPresentationArrayBuffer } from '../presentation-source'

const mocks = vi.hoisted(() => ({
  openDb: vi.fn(),
  getFileSource: vi.fn()
}))

vi.mock('../file-explorer-db', () => ({
  openFileExplorerDB: mocks.openDb,
  getFileSource: mocks.getFileSource
}))

describe('presentation source', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    'https://www.alive.org.tw/api/assets/content?ticket=browser-secret',
    'hhc-media://lease/123e4567-e89b-12d3-a456-426614174000?type=application%2Fvnd.openxmlformats-officedocument.presentationml.presentation'
  ])('reads an explicit trusted ephemeral PPTX source without IndexedDB', async (url) => {
    const bytes = new Uint8Array([1, 2, 3]).buffer
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(bytes, { status: 200 }))

    await expect(
      readPresentationArrayBuffer({
        id: 'deck-id',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        url
      })
    ).resolves.toEqual(bytes)

    expect(fetcher).toHaveBeenCalledWith(url, {
      cache: 'no-store',
      referrerPolicy: 'no-referrer'
    })
    expect(mocks.openDb).not.toHaveBeenCalled()
    expect(mocks.getFileSource).not.toHaveBeenCalled()
  })

  it('uses native availability verification for copied local presentations by default', async () => {
    const source = {
      id: 'copied-item',
      url: 'blob:source-blob',
      mimeType: PPTX_MIME_TYPE
    }
    const bytes = new Uint8Array([1, 2, 3]).buffer
    const db = {}
    mocks.openDb.mockResolvedValue(db)
    mocks.getFileSource.mockResolvedValue({ url: 'blob:resolved-source', revoke: vi.fn() })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bytes, { status: 200 }))

    await expect(readPresentationArrayBuffer(source)).resolves.toEqual(bytes)

    expect(mocks.getFileSource).toHaveBeenCalledWith(db, getBlobId(source), source.mimeType, {})
  })

  it('skips native availability verification for an already authorized copied projection source', async () => {
    const source = {
      id: 'copied-item',
      url: 'blob:source-blob',
      mimeType: PPTX_MIME_TYPE
    }
    const bytes = new Uint8Array([1, 2, 3]).buffer
    const db = {}
    mocks.openDb.mockResolvedValue(db)
    mocks.getFileSource.mockResolvedValue({ url: 'blob:resolved-source', revoke: vi.fn() })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(bytes, { status: 200 }))

    await expect(readPresentationArrayBuffer(source, { verifyNativeFile: false })).resolves.toEqual(
      bytes
    )

    expect(mocks.getFileSource).toHaveBeenCalledWith(db, getBlobId(source), source.mimeType, {
      verifyNativeFile: false
    })
  })
})
