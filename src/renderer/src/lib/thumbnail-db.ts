const DB_NAME = 'hhc-thumbnails'
const STORE_NAME = 'thumbnails'
const DB_VERSION = 1

interface ThumbnailRecord {
  itemId: string
  dataUrl: string
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openThumbnailDB(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in window)) return Promise.resolve(null)

  dbPromise ??= new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
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

export async function saveThumbnail(itemId: string, dataUrl: string): Promise<void> {
  await withThumbnailStore<void>(
    'readwrite',
    (store) => {
      store.put({ itemId, dataUrl } satisfies ThumbnailRecord)
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

  return record?.dataUrl ?? null
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
