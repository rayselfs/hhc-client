import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteDerivedAssetsForSource,
  getCustomCoverOverride,
  getDerivedAsset,
  putCustomCoverOverride,
  putDerivedAsset,
  resetMediaWorkDBForTests
} from '../media-work-db'

describe('media-work-db', () => {
  beforeEach(async () => {
    await resetMediaWorkDBForTests()
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
    for (const kind of ['cover-thumbnail', 'pdf-page-thumbnails', 'transcoded-video'] as const) {
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
    await expect(getDerivedAsset('blob-1', 'transcoded-video')).resolves.toBeUndefined()
  })
})
