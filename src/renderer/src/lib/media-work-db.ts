import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

export type MediaJobType =
  | 'import'
  | 'cover-thumbnail'
  | 'pdf-pages'
  | 'video-poster'
  | 'sync-download'
export type MediaJobStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'blocked'
  | 'failed'
  | 'completed'
  | 'cancelled'
export type MediaJobBlockedReason = 'configuration' | 'authentication' | 'storage' | 'offline'

export interface MediaJobRecord {
  id: string
  type: MediaJobType
  sourceBlobId?: string
  itemId?: string
  dedupeKey?: string
  priority: number
  status: MediaJobStatus
  progress?: number
  attempt: number
  blockedReason?: MediaJobBlockedReason
  errorCode?: string
  createdAt: number
  updatedAt: number
}

export type DerivedAssetKind =
  | 'cover-thumbnail'
  | 'pdf-page-thumbnails'
  | 'video-poster'
  | 'media-metadata'
  | 'presentation-page-document'

export interface DerivedAssetMetadata {
  kind?: 'image' | 'video' | 'pdf'
  container?: string
  videoCodec?: string
  audioCodec?: string
  width?: number
  height?: number
  durationMs?: number
  pageCount?: number
  firstPageWidth?: number
  firstPageHeight?: number
  pixelFormat?: string
  fastStart?: boolean
  profile?: string
  frameRate?: number
  browserPlayback?: 'playable' | 'unplayable'
  presentationDocumentJson?: string
}

export interface DerivedAssetRecord {
  id: string
  lookupKey: string
  sourceBlobId: string
  kind: DerivedAssetKind
  variant: string
  storage: 'indexed-db' | 'native-fs'
  mimeType: string
  size?: number
  status: 'building' | 'ready' | 'failed'
  blob?: Blob
  blobs?: Blob[]
  nativeFileId?: string
  metadata?: DerivedAssetMetadata
  createdAt: number
  updatedAt: number
}

export interface CustomCoverOverrideRecord {
  itemId: string
  blob: Blob
  mimeType: string
  createdAt: number
  updatedAt: number
}

interface MediaWorkDBSchema extends DBSchema {
  jobs: {
    key: string
    value: MediaJobRecord
    indexes: {
      'by-status': MediaJobStatus
      'by-type': MediaJobType
      'by-dedupe-key': string
      'by-updated-at': number
    }
  }
  'derived-assets': {
    key: string
    value: DerivedAssetRecord
    indexes: {
      'by-lookup-key': string
      'by-source-blob': string
    }
  }
  'custom-cover-overrides': {
    key: string
    value: CustomCoverOverrideRecord
  }
}

const DB_NAME = 'hhc-media-work'
export const MEDIA_WORK_DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<MediaWorkDBSchema>> | null = null

function getMediaWorkDB(): Promise<IDBPDatabase<MediaWorkDBSchema>> {
  dbPromise ??= openDB<MediaWorkDBSchema>(DB_NAME, MEDIA_WORK_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('jobs')) {
        const store = db.createObjectStore('jobs', { keyPath: 'id' })
        store.createIndex('by-status', 'status')
        store.createIndex('by-type', 'type')
        store.createIndex('by-dedupe-key', 'dedupeKey')
        store.createIndex('by-updated-at', 'updatedAt')
      }
      if (!db.objectStoreNames.contains('derived-assets')) {
        const store = db.createObjectStore('derived-assets', { keyPath: 'id' })
        store.createIndex('by-lookup-key', 'lookupKey', { unique: true })
        store.createIndex('by-source-blob', 'sourceBlobId')
      }
      if (!db.objectStoreNames.contains('custom-cover-overrides')) {
        db.createObjectStore('custom-cover-overrides', { keyPath: 'itemId' })
      }
    }
  })
  return dbPromise
}

export function createDerivedAssetLookupKey(
  sourceBlobId: string,
  kind: DerivedAssetKind,
  variant = 'default'
): string {
  return `${sourceBlobId}:${kind}:${variant}`
}

export async function getMediaJob(id: string): Promise<MediaJobRecord | undefined> {
  return (await getMediaWorkDB()).get('jobs', id)
}

export async function listMediaJobs(): Promise<MediaJobRecord[]> {
  return (await getMediaWorkDB()).getAll('jobs')
}

export async function putMediaJob(job: MediaJobRecord): Promise<void> {
  await (await getMediaWorkDB()).put('jobs', job)
}

export async function findMediaJobByDedupeKey(
  dedupeKey: string
): Promise<MediaJobRecord | undefined> {
  const jobs = await (await getMediaWorkDB()).getAllFromIndex('jobs', 'by-dedupe-key', dedupeKey)
  return (
    jobs
      .sort((a, b) => b.createdAt - a.createdAt)
      .find((job) => !['completed', 'cancelled'].includes(job.status)) ?? jobs[0]
  )
}

export async function deleteMediaJob(id: string): Promise<void> {
  await (await getMediaWorkDB()).delete('jobs', id)
}

export async function getDerivedAsset(
  sourceBlobId: string,
  kind: DerivedAssetKind,
  variant = 'default'
): Promise<DerivedAssetRecord | undefined> {
  return (await getMediaWorkDB()).getFromIndex(
    'derived-assets',
    'by-lookup-key',
    createDerivedAssetLookupKey(sourceBlobId, kind, variant)
  )
}

export async function putDerivedAsset(
  asset: Omit<DerivedAssetRecord, 'id' | 'lookupKey' | 'createdAt' | 'updatedAt'> & {
    id?: string
    createdAt?: number
    updatedAt?: number
  }
): Promise<DerivedAssetRecord> {
  const db = await getMediaWorkDB()
  const tx = db.transaction('derived-assets', 'readwrite')
  const existing = await tx.store
    .index('by-lookup-key')
    .get(createDerivedAssetLookupKey(asset.sourceBlobId, asset.kind, asset.variant))
  const now = Date.now()
  const record: DerivedAssetRecord = {
    ...asset,
    id: existing?.id ?? asset.id ?? crypto.randomUUID(),
    lookupKey: createDerivedAssetLookupKey(asset.sourceBlobId, asset.kind, asset.variant),
    createdAt: existing?.createdAt ?? asset.createdAt ?? now,
    updatedAt: asset.updatedAt ?? now
  }
  await tx.store.put(record)
  await tx.done
  return record
}

export async function deleteDerivedAsset(
  sourceBlobId: string,
  kind: DerivedAssetKind,
  variant = 'default'
): Promise<void> {
  const db = await getMediaWorkDB()
  const asset = await getDerivedAsset(sourceBlobId, kind, variant)
  if (asset) await db.delete('derived-assets', asset.id)
}

export async function deleteDerivedAssetsForSource(sourceBlobId: string): Promise<void> {
  const db = await getMediaWorkDB()
  const assets = await db.getAllFromIndex('derived-assets', 'by-source-blob', sourceBlobId)
  const tx = db.transaction('derived-assets', 'readwrite')
  await Promise.all(assets.map((asset) => tx.store.delete(asset.id)))
  await tx.done
}

export async function listDerivedAssets(): Promise<DerivedAssetRecord[]> {
  return (await getMediaWorkDB()).getAll('derived-assets')
}

export async function listCustomCoverOverrides(): Promise<CustomCoverOverrideRecord[]> {
  return (await getMediaWorkDB()).getAll('custom-cover-overrides')
}

export async function getCustomCoverOverride(
  itemId: string
): Promise<CustomCoverOverrideRecord | undefined> {
  return (await getMediaWorkDB()).get('custom-cover-overrides', itemId)
}

export async function putCustomCoverOverride(
  itemId: string,
  blob: Blob,
  mimeType = blob.type || 'image/jpeg'
): Promise<void> {
  const db = await getMediaWorkDB()
  const existing = await db.get('custom-cover-overrides', itemId)
  const now = Date.now()
  await db.put('custom-cover-overrides', {
    itemId,
    blob,
    mimeType,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  })
}

export async function deleteCustomCoverOverride(itemId: string): Promise<void> {
  await (await getMediaWorkDB()).delete('custom-cover-overrides', itemId)
}

export async function resetMediaWorkDB(): Promise<void> {
  const db = await dbPromise
  db?.close()
  dbPromise = null
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Media work database deletion blocked'))
  })
}

export const resetMediaWorkDBForTests = resetMediaWorkDB
