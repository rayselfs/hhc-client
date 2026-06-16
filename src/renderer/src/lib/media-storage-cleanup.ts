import { listFileBlobRecords } from './file-explorer-db'
import {
  deleteDerivedAsset,
  listDerivedAssets,
  type DerivedAssetKind,
  type DerivedAssetRecord
} from './media-work-db'
import { isMediaResourceLocked } from './media-resource-locks'

export interface MediaStorageCleanupResult {
  deletedAssetIds: string[]
}

const REGENERABLE_ASSET_KINDS: ReadonlySet<DerivedAssetKind> = new Set([
  'cover-thumbnail',
  'pdf-page-thumbnails',
  'video-poster'
])

export async function removeUnusedDerivedAssets(): Promise<MediaStorageCleanupResult> {
  const [fileBlobs, assets] = await Promise.all([listFileBlobRecords(), listDerivedAssets()])
  const sourceBlobIds = new Set(fileBlobs.map((record) => record.id))
  return deleteDerivedAssets(assets.filter((asset) => !sourceBlobIds.has(asset.sourceBlobId)))
}

export async function clearRegenerableDerivedAssets(): Promise<MediaStorageCleanupResult> {
  const assets = await listDerivedAssets()
  return deleteDerivedAssets(assets.filter((asset) => REGENERABLE_ASSET_KINDS.has(asset.kind)))
}

export async function evictRegenerableDerivedAssetsToBudget(
  maxBytes: number
): Promise<MediaStorageCleanupResult> {
  if (maxBytes < 0) throw new Error('Media storage budget must be non-negative')
  const assets = (await listDerivedAssets()).filter(
    (asset) =>
      asset.status === 'ready' &&
      REGENERABLE_ASSET_KINDS.has(asset.kind) &&
      !isMediaResourceLocked(asset.sourceBlobId)
  )
  const total = assets.reduce((sum, asset) => sum + getDerivedAssetSize(asset), 0)
  if (total <= maxBytes) return { deletedAssetIds: [] }

  let remaining = total
  const toDelete: DerivedAssetRecord[] = []
  for (const asset of [...assets].sort((a, b) => a.updatedAt - b.updatedAt)) {
    if (remaining <= maxBytes) break
    toDelete.push(asset)
    remaining -= getDerivedAssetSize(asset)
  }
  return deleteDerivedAssets(toDelete)
}

async function deleteDerivedAssets(
  assets: DerivedAssetRecord[]
): Promise<MediaStorageCleanupResult> {
  const deletedAssetIds: string[] = []
  for (const asset of assets) {
    await deleteDerivedAsset(asset.sourceBlobId, asset.kind, asset.variant)
    deletedAssetIds.push(asset.id)
  }
  return { deletedAssetIds }
}

function getDerivedAssetSize(asset: DerivedAssetRecord): number {
  return (
    asset.size ?? asset.blob?.size ?? asset.blobs?.reduce((sum, blob) => sum + blob.size, 0) ?? 0
  )
}
