import {
  deleteCustomCoverOverride,
  deleteDerivedAsset,
  getCustomCoverOverride,
  getDerivedAsset,
  putCustomCoverOverride,
  putDerivedAsset
} from './media-work-db'

const DB_NAME = 'hhc-thumbnails'
const STORE_NAME = 'thumbnails'
const PDF_PAGE_STORE_NAME = 'pdf-page-thumbs'
export const DB_VERSION = 4

interface ThumbnailRecord {
  itemId: string
  dataUrl?: string
  blob?: Blob
  format?: 'dataUrl' | 'blob'
}

interface PdfPageRecord {
  itemId: string
  blobs: Blob[]
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openThumbnailDB(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in window)) return Promise.resolve(null)

  dbPromise ??= new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = request.result
      if (event.oldVersion < 3 && db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME)
      }
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'itemId' })
      }
      if (!db.objectStoreNames.contains(PDF_PAGE_STORE_NAME)) {
        db.createObjectStore(PDF_PAGE_STORE_NAME, { keyPath: 'itemId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      console.error('Failed to open thumbnail database', request.error)
      resolve(null)
    }
    request.onblocked = () => {
      console.error('Thumbnail database open blocked')
      resolve(null)
    }
  })

  return dbPromise
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
  fallback: T
): Promise<T> {
  try {
    const db = await openThumbnailDB()
    if (!db) return fallback

    return await new Promise<T>((resolve) => {
      const transaction = db.transaction(storeName, mode)
      const store = transaction.objectStore(storeName)
      const request = callback(store)
      let settled = false

      if (request) {
        request.onsuccess = () => {
          settled = true
          resolve(request.result)
        }
        request.onerror = () => {
          settled = true
          console.error('Thumbnail database request failed', request.error)
          resolve(fallback)
        }
      }

      transaction.oncomplete = () => {
        if (!settled) resolve(fallback)
      }
      transaction.onerror = () => {
        console.error('Thumbnail database transaction failed', transaction.error)
        resolve(fallback)
      }
      transaction.onabort = () => {
        console.error('Thumbnail database transaction aborted', transaction.error)
        resolve(fallback)
      }
    })
  } catch (error) {
    console.error('Thumbnail database operation failed', error)
    return fallback
  }
}

async function withThumbnailStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
  fallback: T
): Promise<T> {
  return withStore(STORE_NAME, mode, callback, fallback)
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

function thumbnailRecordToBlob(record: ThumbnailRecord): Blob | null {
  if (record.format === 'blob' && record.blob) return record.blob
  if (record.dataUrl) return dataUrlToBlob(record.dataUrl)
  return null
}

async function getLegacyThumbnail(itemId: string): Promise<ThumbnailRecord | undefined> {
  return withThumbnailStore<ThumbnailRecord | undefined>(
    'readonly',
    (store) => store.get(itemId),
    undefined
  )
}

export async function saveThumbnail(sourceBlobId: string, dataUrl: string): Promise<void> {
  const blob = dataUrlToBlob(dataUrl)
  await putDerivedAsset({
    sourceBlobId,
    kind: 'cover-thumbnail',
    variant: 'default',
    storage: 'indexed-db',
    mimeType: blob.type || 'image/jpeg',
    size: blob.size,
    status: 'ready',
    blob
  })
}

export async function saveCustomThumbnail(itemId: string, dataUrl: string): Promise<void> {
  await putCustomCoverOverride(itemId, dataUrlToBlob(dataUrl))
}

export async function getThumbnail(itemId: string, sourceBlobId = itemId): Promise<string | null> {
  const customCover = await getCustomCoverOverride(itemId)
  if (customCover) return URL.createObjectURL(customCover.blob)

  const generatedCover = await getDerivedAsset(sourceBlobId, 'cover-thumbnail')
  if (generatedCover?.status === 'ready' && generatedCover.blob) {
    return URL.createObjectURL(generatedCover.blob)
  }

  const itemRecord = await getLegacyThumbnail(itemId)
  if (itemRecord && itemId !== sourceBlobId) {
    const blob = thumbnailRecordToBlob(itemRecord)
    if (blob) await putCustomCoverOverride(itemId, blob)
    return itemRecord.dataUrl ?? (blob ? URL.createObjectURL(blob) : null)
  }

  const sourceRecord = itemRecord ?? (await getLegacyThumbnail(sourceBlobId))
  const blob = sourceRecord ? thumbnailRecordToBlob(sourceRecord) : null
  if (!sourceRecord || !blob) return null

  await putDerivedAsset({
    sourceBlobId,
    kind: 'cover-thumbnail',
    variant: 'default',
    storage: 'indexed-db',
    mimeType: blob.type || 'image/jpeg',
    size: blob.size,
    status: 'ready',
    blob
  })
  return sourceRecord.dataUrl ?? URL.createObjectURL(blob)
}

export async function deleteThumbnail(itemId: string): Promise<void> {
  await deleteCustomCoverOverride(itemId)
  await withThumbnailStore<void>(
    'readwrite',
    (store) => {
      store.delete(itemId)
    },
    undefined
  )
}

export async function savePdfPageThumbs(blobId: string, dataUrls: string[]): Promise<void> {
  const blobs = dataUrls.map(dataUrlToBlob)
  await savePdfPageThumbBlobs(blobId, blobs)
}

export async function savePdfPageThumbBlobs(blobId: string, blobs: Blob[]): Promise<void> {
  await putDerivedAsset({
    sourceBlobId: blobId,
    kind: 'pdf-page-thumbnails',
    variant: 'default',
    storage: 'indexed-db',
    mimeType: 'image/jpeg',
    size: blobs.reduce((total, blob) => total + blob.size, 0),
    status: 'ready',
    blobs
  })
}

export async function getPdfPageThumbs(blobId: string): Promise<string[]> {
  const asset = await getDerivedAsset(blobId, 'pdf-page-thumbnails')
  if (asset?.status === 'ready' && asset.blobs) {
    return asset.blobs.map((blob) => URL.createObjectURL(blob))
  }

  const record = await withStore<PdfPageRecord | undefined>(
    PDF_PAGE_STORE_NAME,
    'readonly',
    (store) => store.get(blobId),
    undefined
  )
  if (!record) return []

  await putDerivedAsset({
    sourceBlobId: blobId,
    kind: 'pdf-page-thumbnails',
    variant: 'default',
    storage: 'indexed-db',
    mimeType: record.blobs[0]?.type || 'image/jpeg',
    size: record.blobs.reduce((total, blob) => total + blob.size, 0),
    status: 'ready',
    blobs: record.blobs
  })
  return record.blobs.map((blob) => URL.createObjectURL(blob))
}

export async function deletePdfPageThumbs(blobId: string): Promise<void> {
  await deleteDerivedAsset(blobId, 'pdf-page-thumbnails')
  await withStore<void>(
    PDF_PAGE_STORE_NAME,
    'readwrite',
    (store) => {
      store.delete(blobId)
    },
    undefined
  )
}

export async function resetThumbnailDB(): Promise<void> {
  const db = await dbPromise
  db?.close()
  dbPromise = null
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Thumbnail database deletion blocked'))
  })
}

export const resetThumbnailDBForTests = resetThumbnailDB
