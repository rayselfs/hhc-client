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
