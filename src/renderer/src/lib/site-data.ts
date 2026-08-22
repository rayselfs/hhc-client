import { resetBibleDB } from './bible-db'
import { resetFileExplorerDB } from './file-explorer-db'
import { resetMediaWorkDB } from './media-work-db'
import { resetSyncDB } from './sync-db'
import { resetThumbnailDB } from './thumbnail-db'
import { resetWebOneDriveCredentialDB } from './onedrive-web-credentials'

const KNOWN_INDEXED_DBS = [
  'hhc-bible',
  'hhc-file-explorer',
  'hhc-media-work',
  'hhc-sync',
  'hhc-thumbnails',
  'libre-presenter-onedrive-web-credentials'
]

async function deleteIndexedDB(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error(`IndexedDB deletion blocked: ${name}`))
  })
}

function isBlockedIndexedDBDeletion(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes('deletion blocked')
}

async function runCleanupTasks(tasks: Promise<void>[]): Promise<void> {
  const results = await Promise.allSettled(tasks)
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  )
  for (const failure of failures) {
    if (isBlockedIndexedDBDeletion(failure.reason)) {
      console.warn('[site-data] IndexedDB deletion blocked by an open connection:', failure.reason)
    }
  }
  const failure = failures.find((result) => !isBlockedIndexedDBDeletion(result.reason))
  if (failure) throw failure.reason
}

function clearLocalStorage(): void {
  try {
    localStorage.clear()
  } catch (e) {
    console.warn('[site-data] Failed to clear localStorage:', e)
  }
}

function clearSessionStorage(): void {
  try {
    sessionStorage.clear()
  } catch (e) {
    console.warn('[site-data] Failed to clear sessionStorage:', e)
  }
}

async function clearIndexedDB(): Promise<void> {
  if (typeof indexedDB === 'undefined') return

  await runCleanupTasks([
    resetBibleDB(),
    resetFileExplorerDB(),
    resetMediaWorkDB(),
    resetSyncDB(),
    resetThumbnailDB(),
    resetWebOneDriveCredentialDB()
  ])

  let dbNames = KNOWN_INDEXED_DBS
  if (indexedDB.databases) {
    try {
      const discoveredNames = (await indexedDB.databases())
        .map((db) => db.name)
        .filter((name): name is string => Boolean(name))
      dbNames = Array.from(new Set([...KNOWN_INDEXED_DBS, ...discoveredNames]))
    } catch (e) {
      console.warn('[site-data] indexedDB.databases() failed, using fallback:', e)
    }
  }

  await runCleanupTasks(dbNames.map((name) => deleteIndexedDB(name)))
}

async function clearCacheAPI(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const names = await caches.keys()
    await runCleanupTasks(names.map((name) => caches.delete(name).then(() => undefined)))
  } catch (e) {
    console.warn('[site-data] Failed to clear Cache API:', e)
  }
}

function clearCookies(): void {
  try {
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim()
      if (name) {
        document.cookie = `${name}=;expires=${new Date(0).toUTCString()};path=/`
      }
    })
  } catch (e) {
    console.warn('[site-data] Failed to clear cookies:', e)
  }
}

export async function clearAllSiteData(): Promise<void> {
  clearLocalStorage()
  clearSessionStorage()
  await clearIndexedDB()
  await clearCacheAPI()
  clearCookies()
}
