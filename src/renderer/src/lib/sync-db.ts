import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { SyncOfflinePolicy, SyncProviderType } from '@shared/types/folder'

export type SyncEntryKind = 'folder' | 'file'
export type SyncEntryStatus =
  | 'remote-only'
  | 'queued'
  | 'downloading'
  | 'available-offline'
  | 'outdated'
  | 'failed'
  | 'insufficient-storage'
  | 'deleted-pending-release'

export interface ProviderConnectionRecord {
  id: string
  providerType: SyncProviderType
  displayName: string
  accountLabel?: string
  createdAt: number
  updatedAt: number
}

export interface SyncCursorRecord {
  id: string
  providerConnectionId: string
  remoteFolderId: string
  cursor: string
  updatedAt: number
}

export interface SyncEntryRecord {
  id: string
  providerConnectionId: string
  remoteItemId: string
  parentRemoteItemId: string | null
  kind: SyncEntryKind
  name: string
  itemId?: string
  folderId?: string
  blobId?: string
  mimeType?: string
  size?: number
  etag?: string
  contentHash?: string
  status: SyncEntryStatus
  createdAt: number
  updatedAt: number
}

export interface SyncEntryPreferenceRecord {
  id: string
  providerConnectionId: string
  remoteItemId: string
  offlinePolicyOverride?: SyncOfflinePolicy
  updatedAt: number
}

export interface SyncTombstoneRecord {
  id: string
  providerConnectionId: string
  remoteItemId: string
  itemId?: string
  folderId?: string
  blobId?: string
  reason: 'remote-delete' | 'unlink' | 'cache-eviction'
  createdAt: number
}

interface SyncDBSchema extends DBSchema {
  'provider-connections': {
    key: string
    value: ProviderConnectionRecord
    indexes: {
      'by-provider-type': SyncProviderType
    }
  }
  'sync-cursors': {
    key: string
    value: SyncCursorRecord
    indexes: {
      'by-provider-connection': string
    }
  }
  'sync-entries': {
    key: string
    value: SyncEntryRecord
    indexes: {
      'by-provider-connection': string
      'by-remote-item': string
      'by-status': SyncEntryStatus
      'by-local-item': string
      'by-local-folder': string
    }
  }
  'sync-entry-preferences': {
    key: string
    value: SyncEntryPreferenceRecord
    indexes: {
      'by-provider-connection': string
      'by-remote-item': string
    }
  }
  'sync-tombstones': {
    key: string
    value: SyncTombstoneRecord
    indexes: {
      'by-provider-connection': string
      'by-remote-item': string
      'by-blob': string
    }
  }
}

const DB_NAME = 'hhc-sync'
export const SYNC_DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<SyncDBSchema>> | null = null

function createRemoteKey(providerConnectionId: string, remoteItemId: string): string {
  return `${providerConnectionId}:${remoteItemId}`
}

function getSyncDB(): Promise<IDBPDatabase<SyncDBSchema>> {
  dbPromise ??= openDB<SyncDBSchema>(DB_NAME, SYNC_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('provider-connections')) {
        const store = db.createObjectStore('provider-connections', { keyPath: 'id' })
        store.createIndex('by-provider-type', 'providerType')
      }
      if (!db.objectStoreNames.contains('sync-cursors')) {
        const store = db.createObjectStore('sync-cursors', { keyPath: 'id' })
        store.createIndex('by-provider-connection', 'providerConnectionId')
      }
      if (!db.objectStoreNames.contains('sync-entries')) {
        const store = db.createObjectStore('sync-entries', { keyPath: 'id' })
        store.createIndex('by-provider-connection', 'providerConnectionId')
        store.createIndex('by-remote-item', 'remoteLookupKey', { unique: true })
        store.createIndex('by-status', 'status')
        store.createIndex('by-local-item', 'itemId')
        store.createIndex('by-local-folder', 'folderId')
      }
      if (!db.objectStoreNames.contains('sync-entry-preferences')) {
        const store = db.createObjectStore('sync-entry-preferences', { keyPath: 'id' })
        store.createIndex('by-provider-connection', 'providerConnectionId')
        store.createIndex('by-remote-item', 'remoteLookupKey', { unique: true })
      }
      if (!db.objectStoreNames.contains('sync-tombstones')) {
        const store = db.createObjectStore('sync-tombstones', { keyPath: 'id' })
        store.createIndex('by-provider-connection', 'providerConnectionId')
        store.createIndex('by-remote-item', 'remoteLookupKey')
        store.createIndex('by-blob', 'blobId')
      }
    }
  })
  return dbPromise
}

export async function openSyncDB(): Promise<IDBPDatabase<SyncDBSchema>> {
  return getSyncDB()
}

export async function putProviderConnection(
  record: Omit<ProviderConnectionRecord, 'createdAt' | 'updatedAt'> & {
    createdAt?: number
    updatedAt?: number
  }
): Promise<ProviderConnectionRecord> {
  const db = await getSyncDB()
  const existing = await db.get('provider-connections', record.id)
  const now = Date.now()
  const value: ProviderConnectionRecord = {
    ...record,
    createdAt: existing?.createdAt ?? record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now
  }
  await db.put('provider-connections', value)
  return value
}

export async function getProviderConnection(
  id: string
): Promise<ProviderConnectionRecord | undefined> {
  return (await getSyncDB()).get('provider-connections', id)
}

export async function deleteProviderConnection(id: string): Promise<void> {
  await (await getSyncDB()).delete('provider-connections', id)
}

export async function putSyncCursor(
  record: Omit<SyncCursorRecord, 'id'> & { id?: string }
): Promise<SyncCursorRecord> {
  const value = {
    ...record,
    id: record.id ?? createRemoteKey(record.providerConnectionId, record.remoteFolderId)
  }
  await (await getSyncDB()).put('sync-cursors', value)
  return value
}

export async function getSyncCursor(
  providerConnectionId: string,
  remoteFolderId: string
): Promise<SyncCursorRecord | undefined> {
  return (await getSyncDB()).get(
    'sync-cursors',
    createRemoteKey(providerConnectionId, remoteFolderId)
  )
}

export async function putSyncEntry(
  record: Omit<SyncEntryRecord, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string
    createdAt?: number
    updatedAt?: number
  }
): Promise<SyncEntryRecord> {
  const db = await getSyncDB()
  const tx = db.transaction('sync-entries', 'readwrite')
  const remoteLookupKey = createRemoteKey(record.providerConnectionId, record.remoteItemId)
  const existing = await tx.store.index('by-remote-item').get(remoteLookupKey)
  const now = Date.now()
  const value = {
    ...record,
    id: existing?.id ?? record.id ?? crypto.randomUUID(),
    remoteLookupKey,
    createdAt: existing?.createdAt ?? record.createdAt ?? now,
    updatedAt: record.updatedAt ?? now
  } as SyncEntryRecord & { remoteLookupKey: string }
  await tx.store.put(value)
  await tx.done
  return value
}

export async function getSyncEntryByRemoteItem(
  providerConnectionId: string,
  remoteItemId: string
): Promise<SyncEntryRecord | undefined> {
  return (await getSyncDB()).getFromIndex(
    'sync-entries',
    'by-remote-item',
    createRemoteKey(providerConnectionId, remoteItemId)
  )
}

export async function getSyncEntryByLocalItem(
  itemId: string
): Promise<SyncEntryRecord | undefined> {
  return (await getSyncDB()).getFromIndex('sync-entries', 'by-local-item', itemId)
}

export async function listSyncEntries(): Promise<SyncEntryRecord[]> {
  return (await getSyncDB()).getAll('sync-entries')
}

export async function listSyncEntriesByProviderConnection(
  providerConnectionId: string
): Promise<SyncEntryRecord[]> {
  return (await getSyncDB()).getAllFromIndex(
    'sync-entries',
    'by-provider-connection',
    providerConnectionId
  )
}

export async function deleteSyncEntriesByProviderConnection(
  providerConnectionId: string
): Promise<void> {
  const db = await getSyncDB()
  const entries = await listSyncEntriesByProviderConnection(providerConnectionId)
  const tx = db.transaction('sync-entries', 'readwrite')
  await Promise.all(entries.map((entry) => tx.store.delete(entry.id)))
  await tx.done
}

export async function putSyncEntryPreference(
  record: Omit<SyncEntryPreferenceRecord, 'id' | 'updatedAt'> & {
    updatedAt?: number
  }
): Promise<SyncEntryPreferenceRecord> {
  const db = await getSyncDB()
  const remoteLookupKey = createRemoteKey(record.providerConnectionId, record.remoteItemId)
  const value = {
    ...record,
    id: remoteLookupKey,
    remoteLookupKey,
    updatedAt: record.updatedAt ?? Date.now()
  } as SyncEntryPreferenceRecord & { remoteLookupKey: string }
  await db.put('sync-entry-preferences', value)
  return value
}

export async function getSyncEntryPreference(
  providerConnectionId: string,
  remoteItemId: string
): Promise<SyncEntryPreferenceRecord | undefined> {
  return (await getSyncDB()).getFromIndex(
    'sync-entry-preferences',
    'by-remote-item',
    createRemoteKey(providerConnectionId, remoteItemId)
  )
}

export async function deleteSyncEntryPreferencesByProviderConnection(
  providerConnectionId: string
): Promise<void> {
  const db = await getSyncDB()
  const preferences = await db.getAllFromIndex(
    'sync-entry-preferences',
    'by-provider-connection',
    providerConnectionId
  )
  const tx = db.transaction('sync-entry-preferences', 'readwrite')
  await Promise.all(preferences.map((preference) => tx.store.delete(preference.id)))
  await tx.done
}

export async function putSyncTombstone(
  record: Omit<SyncTombstoneRecord, 'id' | 'createdAt'> & {
    id?: string
    createdAt?: number
  }
): Promise<SyncTombstoneRecord> {
  const value = {
    ...record,
    id: record.id ?? crypto.randomUUID(),
    remoteLookupKey: createRemoteKey(record.providerConnectionId, record.remoteItemId),
    createdAt: record.createdAt ?? Date.now()
  } as SyncTombstoneRecord & { remoteLookupKey: string }
  await (await getSyncDB()).put('sync-tombstones', value)
  return value
}

export async function listSyncTombstones(): Promise<SyncTombstoneRecord[]> {
  return (await getSyncDB()).getAll('sync-tombstones')
}

export async function deleteSyncTombstones(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await getSyncDB()
  const tx = db.transaction('sync-tombstones', 'readwrite')
  await Promise.all(ids.map((id) => tx.store.delete(id)))
  await tx.done
}

export async function deleteSyncCursorsByProviderConnection(
  providerConnectionId: string
): Promise<void> {
  const db = await getSyncDB()
  const cursors = await db.getAllFromIndex(
    'sync-cursors',
    'by-provider-connection',
    providerConnectionId
  )
  const tx = db.transaction('sync-cursors', 'readwrite')
  await Promise.all(cursors.map((cursor) => tx.store.delete(cursor.id)))
  await tx.done
}

export async function resetSyncDBForTests(): Promise<void> {
  const db = await dbPromise
  db?.close()
  dbPromise = null
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Sync database deletion blocked'))
  })
}
