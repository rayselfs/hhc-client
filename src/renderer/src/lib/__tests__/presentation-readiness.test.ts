import { beforeEach, describe, expect, it } from 'vitest'
import type { FileItemRecord } from '@shared/types/folder'
import { putDerivedAsset } from '../media-work-db'
import { analyzePresentationReadiness, createPresentationSnapshot } from '../presentation-readiness'
import { TRANSCODE_COMPATIBILITY_PROFILE } from '../media-transcode-lifecycle'

function file(id: string, name: string, mimeType: string, url = `blob:${id}`): FileItemRecord {
  return {
    id,
    parentId: 'root',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name,
    mimeType,
    url,
    size: 1024
  }
}

beforeEach(() => {
  indexedDB.deleteDatabase('hhc-media-work')
})

describe('analyzePresentationReadiness', () => {
  it('summarizes ready, unsupported, missing, preparing, and failed items', async () => {
    await putDerivedAsset({
      sourceBlobId: 'failed-video',
      kind: 'transcoded-video',
      variant: TRANSCODE_COMPATIBILITY_PROFILE.variant,
      storage: 'native-fs',
      mimeType: TRANSCODE_COMPATIBILITY_PROFILE.mimeType,
      status: 'failed'
    })

    const report = await analyzePresentationReadiness(
      [
        file('ready-image', 'ready.png', 'image/png'),
        file('unsupported-video', 'movie.mpeg', 'video/mpeg'),
        file('missing-source', 'missing.png', 'image/png', ''),
        file('pending-video', 'pending.avi', 'video/x-msvideo'),
        file('failed-video', 'failed.avi', 'video/x-msvideo')
      ],
      'electron'
    )

    expect(report.summary).toEqual({
      ready: 1,
      preparing: 1,
      unsupported: 1,
      missing: 1,
      failed: 1
    })
    expect(report.items.map((item) => item.reason)).toEqual([
      'ready-native',
      'unsupported-platform',
      'missing-source',
      'transcode-required',
      'transcode-failed'
    ])
  })

  it('marks transcode-required video ready when the derivative exists', async () => {
    const asset = await putDerivedAsset({
      sourceBlobId: 'source-video',
      kind: 'transcoded-video',
      variant: TRANSCODE_COMPATIBILITY_PROFILE.variant,
      storage: 'native-fs',
      mimeType: TRANSCODE_COMPATIBILITY_PROFILE.mimeType,
      status: 'ready',
      nativeFileId: 'native-output'
    })

    const report = await analyzePresentationReadiness(
      [file('source-video', 'source.avi', 'video/x-msvideo')],
      'electron'
    )

    expect(report.summary.ready).toBe(1)
    expect(report.items[0]).toMatchObject({
      status: 'ready',
      reason: 'ready-transcoded-derivative',
      derivativeId: asset.id
    })
  })
})

describe('createPresentationSnapshot', () => {
  it('captures immutable item and blob identities', () => {
    const item = file('copy-id', 'Original.png', 'image/png', 'blob:source-blob')
    const snapshot = createPresentationSnapshot([item])

    item.name = 'Renamed.png'
    item.url = 'blob:other-blob'

    expect(snapshot.entries[0]).toMatchObject({
      index: 0,
      itemId: 'copy-id',
      blobId: 'source-blob',
      name: 'Original.png',
      sourceUrl: 'blob:source-blob'
    })
  })
})
