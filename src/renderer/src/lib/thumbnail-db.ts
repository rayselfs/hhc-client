const DB_NAME = 'hhc-thumbnails'
const STORE_NAME = 'thumbnails'
export const DB_VERSION = 3

interface ThumbnailRecord {
  itemId: string
  dataUrl?: string
  blob?: Blob
  format?: 'dataUrl' | 'blob'
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

async function withThumbnailStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
  fallback: T
): Promise<T> {
  try {
    const db = await openThumbnailDB()
    if (!db) return fallback

    return await new Promise<T>((resolve) => {
      const transaction = db.transaction(STORE_NAME, mode)
      const store = transaction.objectStore(STORE_NAME)
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

export async function saveThumbnail(itemId: string, dataUrl: string): Promise<void> {
  const blob = dataUrlToBlob(dataUrl)

  await withThumbnailStore<void>(
    'readwrite',
    (store) => {
      store.put({ itemId, blob, format: 'blob' } satisfies ThumbnailRecord)
    },
    undefined
  )
}

export async function getThumbnail(itemId: string): Promise<string | null> {
  const record = await withThumbnailStore<ThumbnailRecord | undefined>(
    'readonly',
    (store) => store.get(itemId),
    undefined
  )

  if (!record) return null
  if (record.format === 'blob' && record.blob) {
    return URL.createObjectURL(record.blob)
  }

  return record.dataUrl ?? null
}

export async function deleteThumbnail(itemId: string): Promise<void> {
  await withThumbnailStore<void>(
    'readwrite',
    (store) => {
      store.delete(itemId)
    },
    undefined
  )
}

export async function copyThumbnail(fromId: string, toId: string): Promise<boolean> {
  const record = await withThumbnailStore<ThumbnailRecord | undefined>(
    'readonly',
    (store) => store.get(fromId),
    undefined
  )

  if (!record) return false

  await withThumbnailStore<void>(
    'readwrite',
    (store) => {
      store.put({ ...record, itemId: toId })
    },
    undefined
  )

  return true
}
