import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileItemRecord } from '@shared/types/folder'
import { putDerivedAsset, resetMediaWorkDBForTests } from '../media-work-db'
import {
  analyzePresentationReadiness,
  createPresentationSnapshot,
  getPresentationSnapshotResourceIds
} from '../presentation-readiness'
import { TRANSCODE_COMPATIBILITY_PROFILE } from '../media-transcode-lifecycle'
import { putProviderConnection, putSyncEntry, resetSyncDBForTests } from '../sync-db'

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

beforeEach(async () => {
  vi.unstubAllGlobals()
  await resetMediaWorkDBForTests()
  await resetSyncDBForTests()
})

describe('analyzePresentationReadiness', () => {
  it('uses live transcode as the electron fallback while a derivative is not ready', async () => {
    vi.stubGlobal('window', {
      api: {
        videoTranscode: {
          getFfmpegConfig: vi.fn().mockResolvedValue({ status: 'ready' })
        }
      }
    })

    const report = await analyzePresentationReadiness(
      [file('source-video', 'source.mkv', 'video/x-matroska')],
      'electron'
    )

    expect(report.summary).toMatchObject({ ready: 1, preparing: 0 })
    expect(report.items[0]).toMatchObject({
      status: 'ready',
      reason: 'ready-live-transcode',
      support: 'transcode-required',
      playbackMode: 'live-transcode',
      seekable: false
    })
  })

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

  it('marks remote-only sync items as preparing', async () => {
    await putProviderConnection({
      id: 'connection-1',
      providerType: 'onedrive',
      displayName: 'OneDrive'
    })
    await putSyncEntry({
      providerConnectionId: 'connection-1',
      remoteItemId: 'remote-file',
      parentRemoteItemId: null,
      kind: 'file',
      name: 'remote.png',
      itemId: 'remote-item',
      blobId: 'remote-blob',
      status: 'remote-only'
    })

    const report = await analyzePresentationReadiness(
      [file('remote-item', 'remote.png', 'image/png', 'blob:remote-blob')],
      'web'
    )

    expect(report.summary).toMatchObject({ ready: 0, preparing: 1 })
    expect(report.items[0]).toMatchObject({
      status: 'preparing',
      reason: 'sync-remote-only'
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

  it('reports every resource identity protected by the snapshot', () => {
    const item = file('copy-id', 'Original.avi', 'video/x-msvideo', 'blob:source-blob')
    const snapshot = createPresentationSnapshot(
      [item],
      [
        {
          itemId: 'copy-id',
          blobId: 'source-blob',
          status: 'ready',
          reason: 'ready-transcoded-derivative',
          support: 'transcode-required',
          derivativeId: 'derived-video'
        }
      ]
    )

    expect(getPresentationSnapshotResourceIds(snapshot)).toEqual(['source-blob', 'derived-video'])
  })
})
