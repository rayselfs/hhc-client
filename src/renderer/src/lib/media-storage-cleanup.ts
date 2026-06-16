import { listFileBlobRecords } from './file-explorer-db'
import {
  deleteDerivedAsset,
  listDerivedAssets,
  type DerivedAssetKind,
  type DerivedAssetRecord
} from './media-work-db'

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
