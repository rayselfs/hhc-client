import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteDerivedAssetsByKind,
  deleteDerivedAssetsForSource,
  getCustomCoverOverride,
  getDerivedAsset,
  putCustomCoverOverride,
  putDerivedAsset,
  putMediaJob,
  subscribeMediaJobs,
  resetMediaWorkDBForTests
} from '../media-work-db'

describe('media-work-db', () => {
  beforeEach(async () => {
    await resetMediaWorkDBForTests()
  })

  it('notifies subscribers with the updated media job', async () => {
    const listener = vi.fn()
    const unsubscribe = subscribeMediaJobs(listener)
    const job = {
      id: 'job-1',
      type: 'pdf-pages' as const,
      sourceBlobId: 'blob-1',
      itemId: 'item-1',
      priority: 0,
      status: 'completed' as const,
      attempt: 1,
      createdAt: 1,
      updatedAt: 2
    }

    await putMediaJob(job)

    expect(listener).toHaveBeenCalledWith(job)
    unsubscribe()
  })

  it('upserts a unique derived asset for each source, kind, and variant', async () => {
    const first = await putDerivedAsset({
      sourceBlobId: 'blob-1',
      kind: 'video-poster',
      variant: 'default',
      storage: 'indexed-db',
      mimeType: 'image/jpeg',
      status: 'building'
    })
    const second = await putDerivedAsset({
      sourceBlobId: 'blob-1',
      kind: 'video-poster',
      variant: 'default',
      storage: 'indexed-db',
      mimeType: 'image/jpeg',
      status: 'ready',
      blob: new Blob(['poster'])
    })

    expect(second.id).toBe(first.id)
    await expect(getDerivedAsset('blob-1', 'video-poster')).resolves.toMatchObject({
      id: first.id,
      status: 'ready'
    })
  })

  it('keeps one record when the same derived asset is written concurrently', async () => {
    const [first, second] = await Promise.all([
      putDerivedAsset({
        sourceBlobId: 'blob-1',
        kind: 'cover-thumbnail',
        variant: 'default',
        storage: 'indexed-db',
        mimeType: 'image/jpeg',
        status: 'building'
      }),
      putDerivedAsset({
        sourceBlobId: 'blob-1',
        kind: 'cover-thumbnail',
        variant: 'default',
        storage: 'indexed-db',
        mimeType: 'image/jpeg',
        status: 'ready'
      })
    ])

    expect(second.id).toBe(first.id)
  })

  it('keeps custom cover overrides item-specific', async () => {
    await putCustomCoverOverride('item-1', new Blob(['custom']))

    await expect(getCustomCoverOverride('item-1')).resolves.toMatchObject({ itemId: 'item-1' })
    await expect(getCustomCoverOverride('item-2')).resolves.toBeUndefined()
  })

  it('deletes every derived asset owned by a final source blob', async () => {
    for (const kind of ['cover-thumbnail', 'pdf-page-thumbnails', 'video-poster'] as const) {
      await putDerivedAsset({
        sourceBlobId: 'blob-1',
        kind,
        variant: 'default',
        storage: 'indexed-db',
        mimeType: 'application/octet-stream',
        status: 'ready'
      })
    }

    await deleteDerivedAssetsForSource('blob-1')

    await expect(getDerivedAsset('blob-1', 'cover-thumbnail')).resolves.toBeUndefined()
    await expect(getDerivedAsset('blob-1', 'pdf-page-thumbnails')).resolves.toBeUndefined()
    await expect(getDerivedAsset('blob-1', 'video-poster')).resolves.toBeUndefined()
  })

  it('removes legacy editable mirrors without deleting other derived assets', async () => {
    await putDerivedAsset({
      sourceBlobId: 'blob-1',
      kind: 'editable-presentation-document',
      variant: 'document:deck-1',
      storage: 'indexed-db',
      mimeType: 'application/json',
      status: 'ready'
    })
    await putDerivedAsset({
      sourceBlobId: 'blob-1',
      kind: 'cover-thumbnail',
      variant: 'default',
      storage: 'indexed-db',
      mimeType: 'image/svg+xml',
      status: 'ready'
    })

    await expect(deleteDerivedAssetsByKind('editable-presentation-document')).resolves.toBe(1)
    await expect(
      getDerivedAsset('blob-1', 'editable-presentation-document', 'document:deck-1')
    ).resolves.toBeUndefined()
    await expect(getDerivedAsset('blob-1', 'cover-thumbnail')).resolves.toBeDefined()
  })
})
