export interface HhcAssetCollection {
  id: string
  namespace: string
  name: string
  revision: number
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface HhcAssetCollectionPage {
  collections: HhcAssetCollection[]
  cursor?: string
  hasMore: boolean
}

export interface HhcAssetCollectionItem {
  id: string
  collectionId: string
  remoteItemId: string
  displayName: string
  sourceRevision: string
  createdRevision: number
  deletedRevision?: number
  mimeType?: string
  sizeBytes?: number
  etag?: string
  createdAt: string
  deletedAt?: string
}

export interface HhcAssetCollectionTombstone {
  id: string
  remoteItemId: string
  deletedRevision: number
  deletedAt: string
}

export interface HhcAssetCollectionChangePage {
  collection: HhcAssetCollection
  items: HhcAssetCollectionItem[]
  tombstones: HhcAssetCollectionTombstone[]
  cursor: string
  hasMore: boolean
  reset: boolean
}

export interface HhcAssetContentTicket {
  contentUrl: string
  expiresAt: number
  etag: string
}

export interface HhcAssetContentRequest {
  collectionId: string
  itemId: string
  rootRemoteFolderId: string
  range?: string
  targetFileId?: string
}

export interface HhcAssetCollectionRequest {
  collectionId: string
  cursor?: string
}

export interface HhcAssetItemRequest {
  collectionId: string
  itemId: string
}

export interface HhcAssetNativeDownloadRequest extends HhcAssetItemRequest {
  rootRemoteFolderId: string
  targetFileId: string
}

export interface HhcAssetNativeDownloadResult {
  fileId: string
  size: number
  mimeType: string
}

export interface HhcAssetNativeLease {
  kind: 'native-lease'
  url: string
  leaseId: string
  etag: string
}

const MAX_PAGE_ITEMS = 500

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid HHC Asset response')
  }
  return value as Record<string, unknown>
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Invalid HHC Asset response')
  }
  return value
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error('Invalid HHC Asset response')
  return value
}

function nonNegativeInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error('Invalid HHC Asset response')
  }
  return value as number
}

function optionalNonNegativeInteger(value: unknown): number | undefined {
  return value === undefined ? undefined : nonNegativeInteger(value)
}

function pageArray(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length > MAX_PAGE_ITEMS) {
    throw new Error('Invalid HHC Asset response')
  }
  return value
}

export function projectHhcAssetCollection(value: unknown): HhcAssetCollection {
  const input = record(value)
  const deletedAt = optionalString(input.deletedAt)
  return {
    id: requiredString(input.id),
    namespace: requiredString(input.namespace),
    name: requiredString(input.name),
    revision: nonNegativeInteger(input.revision),
    createdAt: requiredString(input.createdAt),
    updatedAt: requiredString(input.updatedAt),
    ...(deletedAt === undefined ? {} : { deletedAt })
  }
}

export function projectHhcAssetItem(value: unknown): HhcAssetCollectionItem {
  const input = record(value)
  const deletedRevision = optionalNonNegativeInteger(input.deletedRevision)
  const mimeType = optionalString(input.mimeType)
  const sizeBytes = optionalNonNegativeInteger(input.sizeBytes)
  const etag = optionalString(input.etag)
  const deletedAt = optionalString(input.deletedAt)
  return {
    id: requiredString(input.id),
    collectionId: requiredString(input.collectionId),
    remoteItemId: requiredString(input.remoteItemId),
    displayName: requiredString(input.displayName),
    sourceRevision: requiredString(input.sourceRevision),
    createdRevision: nonNegativeInteger(input.createdRevision),
    createdAt: requiredString(input.createdAt),
    ...(deletedRevision === undefined ? {} : { deletedRevision }),
    ...(mimeType === undefined ? {} : { mimeType }),
    ...(sizeBytes === undefined ? {} : { sizeBytes }),
    ...(etag === undefined ? {} : { etag }),
    ...(deletedAt === undefined ? {} : { deletedAt })
  }
}

function projectHhcAssetTombstone(value: unknown): HhcAssetCollectionTombstone {
  const input = record(value)
  return {
    id: requiredString(input.id),
    remoteItemId: requiredString(input.remoteItemId),
    deletedRevision: nonNegativeInteger(input.deletedRevision),
    deletedAt: requiredString(input.deletedAt)
  }
}

export function projectHhcAssetCollectionPage(value: unknown): HhcAssetCollectionPage {
  const input = record(value)
  if (typeof input.hasMore !== 'boolean') throw new Error('Invalid HHC Asset response')
  const cursor = optionalString(input.cursor)
  return {
    collections: pageArray(input.collections).map(projectHhcAssetCollection),
    ...(cursor === undefined ? {} : { cursor }),
    hasMore: input.hasMore
  }
}

export function projectHhcAssetChangePage(value: unknown): HhcAssetCollectionChangePage {
  const input = record(value)
  if (typeof input.hasMore !== 'boolean' || typeof input.reset !== 'boolean') {
    throw new Error('Invalid HHC Asset response')
  }
  return {
    collection: projectHhcAssetCollection(input.collection),
    items: pageArray(input.items).map(projectHhcAssetItem),
    tombstones: pageArray(input.tombstones).map(projectHhcAssetTombstone),
    cursor: requiredString(input.cursor),
    hasMore: input.hasMore,
    reset: input.reset
  }
}
