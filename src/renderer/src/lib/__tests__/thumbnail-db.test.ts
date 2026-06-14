import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DB_NAME = 'hhc-thumbnails'
const STORE_NAME = 'thumbnails'

interface StoredThumbnailRecord {
  itemId: string
  dataUrl?: string
  blob?: Blob
  format?: 'dataUrl' | 'blob'
}

interface FakeDatabaseState {
  version: number
  stores: Map<string, Map<string, StoredThumbnailRecord>>
}

type MutableRequest<T> = Omit<IDBRequest<T>, 'error' | 'result'> & {
  error: DOMException | null
  result: T
}

type MutableOpenRequest = Omit<IDBOpenDBRequest, 'error' | 'result'> & {
  error: DOMException | null
  result: IDBDatabase
}

const fakeDatabases = new Map<string, FakeDatabaseState>()

function createRequest<T>(): MutableRequest<T> {
  return {
    error: null,
    result: undefined as T,
    readyState: 'pending',
    source: null,
    transaction: null,
    onsuccess: null,
    onerror: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true)
  } as unknown as MutableRequest<T>
}

function createObjectStoreNames(state: FakeDatabaseState): DOMStringList {
  return {
    contains: (name: string) => state.stores.has(name),
    item: (index: number) => Array.from(state.stores.keys())[index] ?? null,
    length: state.stores.size
  } as unknown as DOMStringList
}

function createTransaction(store: Map<string, StoredThumbnailRecord>): IDBTransaction {
  const transaction = {
    error: null,
    mode: 'readonly',
    durability: 'default',
    db: null,
    objectStoreNames: createObjectStoreNames({ version: 1, stores: new Map([[STORE_NAME, store]]) }),
    onabort: null,
    oncomplete: null,
    onerror: null,
    abort: vi.fn(),
    commit: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    objectStore: () => ({
      get: (key: IDBValidKey) => {
        const request = createRequest<StoredThumbnailRecord | undefined>()
        setTimeout(() => {
          request.result = store.get(String(key))
          request.onsuccess?.call(request, new Event('success'))
        })
        return request
      },
      put: (value: StoredThumbnailRecord) => {
        const request = createRequest<IDBValidKey>()
        setTimeout(() => {
          store.set(value.itemId, value)
          request.result = value.itemId
          request.onsuccess?.call(request, new Event('success'))
          transaction.oncomplete?.call(transaction, new Event('complete'))
        })
        return request
      },
      delete: (key: IDBValidKey) => {
        const request = createRequest<undefined>()
        setTimeout(() => {
          store.delete(String(key))
          request.result = undefined
          request.onsuccess?.call(request, new Event('success'))
          transaction.oncomplete?.call(transaction, new Event('complete'))
        })
        return request
      }
    })
  } as unknown as IDBTransaction

  return transaction
}

function createDatabase(name: string, state: FakeDatabaseState): IDBDatabase {
  const refreshObjectStoreNames = (db: IDBDatabase): void => {
    Object.defineProperty(db, 'objectStoreNames', {
      configurable: true,
      value: createObjectStoreNames(state)
    })
  }

  const db = {
    name,
    version: state.version,
    objectStoreNames: createObjectStoreNames(state),
    close: vi.fn(),
    createObjectStore: (storeName: string) => {
      const store = new Map<string, StoredThumbnailRecord>()
      state.stores.set(storeName, store)
      refreshObjectStoreNames(db)
      return store
    },
    deleteObjectStore: (storeName: string) => {
      state.stores.delete(storeName)
      refreshObjectStoreNames(db)
    },
    transaction: (storeName: string) => {
      const store = state.stores.get(storeName)
      if (!store) throw new Error(`Missing object store ${storeName}`)
      return createTransaction(store)
    },
    onabort: null,
    onclose: null,
    onerror: null,
    onversionchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true)
  } as unknown as IDBDatabase

  return db
}

function createIndexedDB(): IDBFactory {
  return {
    open: (name: string, version?: number) => {
      const request = createRequest<IDBDatabase>() as unknown as MutableOpenRequest
      setTimeout(() => {
        let state = fakeDatabases.get(name)
        const oldVersion = state?.version ?? 0
        const nextVersion = version ?? state?.version ?? 1
        if (!state) {
          state = { version: nextVersion, stores: new Map() }
          fakeDatabases.set(name, state)
        } else if (nextVersion > state.version) {
          state.version = nextVersion
        }
        const db = createDatabase(name, state)
        request.result = db
        if (oldVersion < nextVersion) {
          request.onupgradeneeded?.call(request, { oldVersion } as IDBVersionChangeEvent)
        }
        request.onsuccess?.call(request, new Event('success'))
      })
      return request
    },
    deleteDatabase: (name: string) => {
      const request = createRequest<undefined>() as unknown as IDBOpenDBRequest
      setTimeout(() => {
        fakeDatabases.delete(name)
        request.onsuccess?.call(request, new Event('success'))
      })
      return request
    },
    cmp: (first: IDBValidKey, second: IDBValidKey) => (first === second ? 0 : first < second ? -1 : 1),
    databases: async () => []
  } as unknown as IDBFactory
}

async function loadModule(): Promise<typeof import('../thumbnail-db')> {
  return await import('../thumbnail-db')
}

async function deleteDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`Deleting ${name} was blocked`))
  })
}

async function openDatabase(version: number): Promise<IDBDatabase> {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'itemId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`Opening ${DB_NAME} was blocked`))
  })
}

async function readRecord(itemId: string, version: number): Promise<StoredThumbnailRecord | undefined> {
  const db = await openDatabase(version)
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const request = transaction.objectStore(STORE_NAME).get(itemId)
      request.onsuccess = () => resolve(request.result as StoredThumbnailRecord | undefined)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function writeLegacyRecord(itemId: string, dataUrl: string, version: number): Promise<void> {
  const db = await openDatabase(version)
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put({ itemId, dataUrl })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally {
    db.close()
  }
}

describe('thumbnail-db', () => {
  const createObjectUrl = vi.fn((blob: Blob) => `blob:test-${blob.size}`)

  beforeEach(async () => {
    vi.resetModules()
    fakeDatabases.clear()
    vi.stubGlobal('indexedDB', createIndexedDB())
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: indexedDB
    })
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn()
    })
    await deleteDatabase(DB_NAME)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    createObjectUrl.mockClear()
    fakeDatabases.clear()
  })

  it("saveThumbnail stores as Blob with format='blob'", async () => {
    const { DB_VERSION, saveThumbnail } = await loadModule()

    await saveThumbnail('item-1', 'data:text/plain;base64,aGVsbG8=')

    const record = await readRecord('item-1', DB_VERSION)

    expect(record).toMatchObject({ itemId: 'item-1', format: 'blob' })
    expect(record?.blob).toBeInstanceOf(Blob)
    await expect(record?.blob?.text()).resolves.toBe('hello')
  })

  it("getThumbnail for blob format returns a 'blob:' object URL", async () => {
    const { getThumbnail, saveThumbnail } = await loadModule()

    await saveThumbnail('item-2', 'data:text/plain;base64,aGVsbG8=')

    const thumbnail = await getThumbnail('item-2')

    expect(thumbnail).toBe('blob:test-5')
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob))
  })

  it('returns a raw dataUrl string for legacy records without a format field', async () => {
    const { DB_VERSION, getThumbnail } = await loadModule()
    const dataUrl = 'data:image/png;base64,legacy'
    await writeLegacyRecord('legacy-item', dataUrl, DB_VERSION)

    await expect(getThumbnail('legacy-item')).resolves.toBe(dataUrl)
    expect(createObjectUrl).not.toHaveBeenCalled()
  })

  it('opens the thumbnail database at the current version after migration', async () => {
    const { DB_VERSION, saveThumbnail } = await loadModule()

    await saveThumbnail('item-3', 'data:text/plain;base64,aGk=')
    const db = await openDatabase(DB_VERSION)

    try {
      expect(DB_VERSION).toBe(4)
      expect(db.version).toBe(DB_VERSION)
    } finally {
      db.close()
    }
  })
})
