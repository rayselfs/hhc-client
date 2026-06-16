import { beforeEach, describe, expect, it } from 'vitest'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import { lockMediaResources, resetMediaResourceLocksForTests } from '../media-resource-locks'
import { getDerivedAsset, putDerivedAsset, resetMediaWorkDBForTests } from '../media-work-db'
import {
  clearRegenerableDerivedAssets,
  evictRegenerableDerivedAssetsToBudget,
  removeUnusedDerivedAssets
} from '../media-storage-cleanup'

beforeEach(async () => {
  await resetFileExplorerDBForTests()
  await resetMediaWorkDBForTests()
  resetMediaResourceLocksForTests()
})

describe('media storage cleanup', () => {
  it('removes derived assets whose source blob no longer exists', async () => {
    const db = await openFileExplorerDB()
    await db.put('file-blobs', {
      id: 'kept-source',
      storage: 'native-fs',
      size: 10,
      refCount: 1
    })
    const kept = await putDerivedAsset({
      sourceBlobId: 'kept-source',
      kind: 'cover-thumbnail',
      variant: 'default',
      storage: 'indexed-db',
      mimeType: 'image/jpeg',
      status: 'ready',
      size: 1
    })
    const orphan = await putDerivedAsset({
      sourceBlobId: 'missing-source',
      kind: 'cover-thumbnail',
      variant: 'default',
      storage: 'indexed-db',
      mimeType: 'image/jpeg',
      status: 'ready',
      size: 1
    })

    const result = await removeUnusedDerivedAssets()

    expect(result.deletedAssetIds).toEqual([orphan.id])
    await expect(getDerivedAsset('kept-source', 'cover-thumbnail')).resolves.toMatchObject({
      id: kept.id
    })
    await expect(getDerivedAsset('missing-source', 'cover-thumbnail')).resolves.toBeUndefined()
    await expect(db.get('file-blobs', 'kept-source')).resolves.toBeDefined()
  })

  it('clears regenerable thumbnails and posters but preserves transcoded derivatives', async () => {
    const cover = await putDerivedAsset({
      sourceBlobId: 'source',
      kind: 'cover-thumbnail',
      variant: 'default',
      storage: 'indexed-db',
      mimeType: 'image/jpeg',
      status: 'ready',
      size: 1
    })
    const pdf = await putDerivedAsset({
      sourceBlobId: 'source',
      kind: 'pdf-page-thumbnails',
      variant: 'default',
      storage: 'indexed-db',
      mimeType: 'image/jpeg',
      status: 'ready',
      size: 1
    })
    const transcoded = await putDerivedAsset({
      sourceBlobId: 'source',
      kind: 'transcoded-video',
      variant: 'mp4',
      storage: 'native-fs',
      mimeType: 'video/mp4',
      status: 'ready',
      size: 10
    })

    const result = await clearRegenerableDerivedAssets()

    expect(result.deletedAssetIds).toEqual(expect.arrayContaining([cover.id, pdf.id]))
    expect(result.deletedAssetIds).not.toContain(transcoded.id)
    await expect(getDerivedAsset('source', 'cover-thumbnail')).resolves.toBeUndefined()
    await expect(getDerivedAsset('source', 'pdf-page-thumbnails')).resolves.toBeUndefined()
    await expect(getDerivedAsset('source', 'transcoded-video', 'mp4')).resolves.toMatchObject({
      id: transcoded.id
    })
  })

  it('evicts oldest regenerable derived assets until the budget is met', async () => {
    const oldest = await putDerivedAsset({
      sourceBlobId: 'source-a',
      kind: 'cover-thumbnail',
      variant: 'default',
      storage: 'indexed-db',
      mimeType: 'image/jpeg',
      status: 'ready',
      size: 5,
      updatedAt: 1
    })
    const newest = await putDerivedAsset({
      sourceBlobId: 'source-b',
      kind: 'pdf-page-thumbnails',
      variant: 'default',
      storage: 'indexed-db',
      mimeType: 'image/jpeg',
      status: 'ready',
      size: 5,
      updatedAt: 2
    })

    const result = await evictRegenerableDerivedAssetsToBudget(5)

    expect(result.deletedAssetIds).toEqual([oldest.id])
    await expect(getDerivedAsset('source-a', 'cover-thumbnail')).resolves.toBeUndefined()
    await expect(getDerivedAsset('source-b', 'pdf-page-thumbnails')).resolves.toMatchObject({
      id: newest.id
    })
  })

  it('does not evict locked sources or transcoded derivatives for regenerable budgets', async () => {
    const release = lockMediaResources(['locked-source'])
    const locked = await putDerivedAsset({
      sourceBlobId: 'locked-source',
      kind: 'cover-thumbnail',
      variant: 'default',
      storage: 'indexed-db',
      mimeType: 'image/jpeg',
      status: 'ready',
      size: 5,
      updatedAt: 1
    })
    const transcoded = await putDerivedAsset({
      sourceBlobId: 'source',
      kind: 'transcoded-video',
      variant: 'mp4',
      storage: 'native-fs',
      mimeType: 'video/mp4',
      status: 'ready',
      size: 5,
      updatedAt: 2
    })

    const result = await evictRegenerableDerivedAssetsToBudget(0)

    expect(result.deletedAssetIds).toEqual([])
    await expect(getDerivedAsset('locked-source', 'cover-thumbnail')).resolves.toMatchObject({
      id: locked.id
    })
    await expect(getDerivedAsset('source', 'transcoded-video', 'mp4')).resolves.toMatchObject({
      id: transcoded.id
    })
    release()
  })
})
