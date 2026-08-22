import { Blob as NodeBlob } from 'node:buffer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDerivedAsset, getCustomCoverOverride, resetMediaWorkDBForTests } from '../media-work-db'
import {
  DB_VERSION,
  getPdfPageThumbs,
  getThumbnail,
  deleteThumbnail,
  resetThumbnailDBForTests,
  saveCustomThumbnail,
  savePdfPageThumbBlobs,
  saveThumbnail
} from '../thumbnail-db'

const DB_NAME = 'hhc-thumbnails'
const STORE_NAME = 'thumbnails'
const PDF_PAGE_STORE_NAME = 'pdf-page-thumbs'

async function writeLegacyRecord(
  storeName: string,
  record: { itemId: string; dataUrl?: string; blobs?: Blob[] }
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'itemId' })
      }
      if (!db.objectStoreNames.contains(PDF_PAGE_STORE_NAME)) {
        db.createObjectStore(PDF_PAGE_STORE_NAME, { keyPath: 'itemId' })
      }
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(storeName, 'readwrite')
      tx.objectStore(storeName).put(record)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    }
  })
}

describe('thumbnail-db', () => {
  const createObjectUrl = vi.fn((blob: Blob) => `blob:test-${blob.size}`)

  beforeEach(async () => {
    vi.stubGlobal('Blob', NodeBlob)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl
    })
    await resetThumbnailDBForTests()
    await resetMediaWorkDBForTests()
  })

  afterEach(() => {
    createObjectUrl.mockClear()
    vi.unstubAllGlobals()
  })

  it('stores generated covers by canonical blob identity', async () => {
    await saveThumbnail('source-blob', 'data:text/plain;base64,aGVsbG8=')

    const asset = await getDerivedAsset('source-blob', 'cover-thumbnail')
    expect(asset).toMatchObject({
      sourceBlobId: 'source-blob',
      kind: 'cover-thumbnail',
      status: 'ready',
      storage: 'indexed-db'
    })
    await expect(asset?.blob?.text()).resolves.toBe('hello')
  })

  it('shares a generated cover between copied items', async () => {
    await saveThumbnail('source-blob', 'data:text/plain;base64,aGVsbG8=')

    await expect(getThumbnail('original-item', 'source-blob')).resolves.toBe('blob:test-5')
    await expect(getThumbnail('copy-item', 'source-blob')).resolves.toBe('blob:test-5')
  })

  it('prefers item-specific custom covers over generated covers', async () => {
    await saveThumbnail('source-blob', 'data:text/plain;base64,Z2VuZXJhdGVk')
    await saveCustomThumbnail('copy-item', 'data:text/plain;base64,Y3VzdG9t')

    await expect(getThumbnail('copy-item', 'source-blob')).resolves.toBe('blob:test-6')
    await expect(getThumbnail('other-item', 'source-blob')).resolves.toBe('blob:test-9')
    await expect(getCustomCoverOverride('copy-item')).resolves.toBeDefined()
  })

  it('deletes an item override without deleting the shared generated cover', async () => {
    await saveThumbnail('source-blob', 'data:text/plain;base64,Z2VuZXJhdGVk')
    await saveCustomThumbnail('copy-item', 'data:text/plain;base64,Y3VzdG9t')

    await deleteThumbnail('copy-item')

    await expect(getCustomCoverOverride('copy-item')).resolves.toBeUndefined()
    await expect(getDerivedAsset('source-blob', 'cover-thumbnail')).resolves.toBeDefined()
  })

  it('lazily migrates a legacy generated cover without deleting it', async () => {
    const dataUrl = 'data:text/plain;base64,bGVnYWN5'
    await writeLegacyRecord(STORE_NAME, { itemId: 'source-blob', dataUrl })

    await expect(getThumbnail('copy-item', 'source-blob')).resolves.toBe(dataUrl)
    await expect(getDerivedAsset('source-blob', 'cover-thumbnail')).resolves.toMatchObject({
      status: 'ready'
    })
  })

  it('persists PDF page thumbnails by blob identity', async () => {
    await savePdfPageThumbBlobs('source-blob', [new Blob(['page-1']), new Blob(['page-2'])])

    await expect(getPdfPageThumbs('copy-item-id')).resolves.toEqual([])
    await expect(getPdfPageThumbs('source-blob')).resolves.toEqual(['blob:test-6', 'blob:test-6'])
  })

  it('lazily migrates legacy PDF page thumbnails', async () => {
    await writeLegacyRecord(PDF_PAGE_STORE_NAME, {
      itemId: 'source-blob',
      blobs: [new Blob(['page'])]
    })

    await expect(getPdfPageThumbs('source-blob')).resolves.toEqual(['blob:test-4'])
    await expect(getDerivedAsset('source-blob', 'pdf-page-thumbnails')).resolves.toMatchObject({
      status: 'ready'
    })
  })
})
