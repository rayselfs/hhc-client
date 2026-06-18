import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileItemRecord } from '@shared/types/folder'
import { resetMediaWorkDBForTests } from '../media-work-db'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import {
  analyzePresentationReadiness,
  createPresentationSnapshot,
  getPresentationSnapshotResourceIds
} from '../presentation-readiness'
import { putProviderConnection, putSyncEntry, resetSyncDBForTests } from '../sync-db'
import { putSourceMediaMetadata } from '../media-metadata'

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
  await resetFileExplorerDBForTests()
})

describe('analyzePresentationReadiness', () => {
  it('uses embedded VLC for Electron native videos when available', async () => {
    vi.stubGlobal('window', {
      api: {
        projectionVlc: {
          getInfo: vi.fn().mockResolvedValue({ status: 'ready' }),
          probe: vi.fn().mockResolvedValue({ durationMs: 120000 })
        }
      }
    })
    await (
      await openFileExplorerDB()
    ).put('file-blobs', {
      id: 'source-video',
      storage: 'native-fs',
      refCount: 1
    })

    const report = await analyzePresentationReadiness(
      [file('source-video', 'source.mkv', 'video/x-matroska')],
      'electron'
    )

    expect(report.summary).toMatchObject({ ready: 1, preparing: 0 })
    expect(report.items[0]).toMatchObject({
      status: 'ready',
      reason: 'ready-vlc-embedded',
      support: 'desktop-engine',
      playbackMode: 'vlc-embedded',
      seekable: true,
      durationMs: 120000
    })
  })

  it('fails when VLC is unavailable for Electron desktop-engine videos', async () => {
    vi.stubGlobal('window', {
      api: {
        projectionVlc: {
          getInfo: vi.fn().mockResolvedValue({ status: 'missing' })
        }
      }
    })
    await (
      await openFileExplorerDB()
    ).put('file-blobs', {
      id: 'source-video',
      storage: 'native-fs',
      refCount: 1
    })

    const report = await analyzePresentationReadiness(
      [file('source-video', 'source.mkv', 'video/x-matroska')],
      'electron'
    )

    expect(report.summary).toMatchObject({ ready: 0, failed: 1 })
    expect(report.items[0]).toMatchObject({
      status: 'failed',
      reason: 'video-engine-unavailable',
      support: 'desktop-engine'
    })
  })

  it('fails desktop-engine videos when the source is not in native storage', async () => {
    vi.stubGlobal('window', {
      api: {
        projectionVlc: {
          getInfo: vi.fn().mockResolvedValue({ status: 'missing' })
        }
      }
    })

    const report = await analyzePresentationReadiness(
      [file('legacy-video', 'legacy.mkv', 'video/x-matroska')],
      'electron'
    )

    expect(report.summary).toMatchObject({ ready: 0, failed: 1 })
    expect(report.items[0]).toMatchObject({
      status: 'failed',
      reason: 'video-engine-unavailable'
    })
  })

  it('summarizes ready, unsupported, missing, and failed items', async () => {
    const report = await analyzePresentationReadiness(
      [
        file('ready-image', 'ready.png', 'image/png'),
        file('unsupported-video', 'movie.mpeg', 'video/mpeg'),
        file('missing-source', 'missing.png', 'image/png', ''),
        file('failed-video', 'failed.avi', 'video/x-msvideo')
      ],
      'electron'
    )

    expect(report.summary).toEqual({
      ready: 1,
      preparing: 0,
      unsupported: 1,
      missing: 1,
      failed: 1
    })
    expect(report.items.map((item) => item.reason)).toEqual([
      'ready-native',
      'unsupported-platform',
      'missing-source',
      'video-engine-unavailable'
    ])
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

  it('excludes browser-unplayable Web videos', async () => {
    await putSourceMediaMetadata('bad-video', {
      kind: 'video',
      browserPlayback: 'unplayable'
    })

    const report = await analyzePresentationReadiness(
      [file('bad-video', 'bad.mkv', 'video/x-matroska')],
      'web'
    )

    expect(report.summary).toMatchObject({ ready: 0, unsupported: 1 })
    expect(report.items[0]).toMatchObject({
      status: 'unsupported',
      reason: 'browser-video-unplayable'
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
          reason: 'ready-vlc-embedded',
          support: 'desktop-engine'
        }
      ]
    )

    expect(getPresentationSnapshotResourceIds(snapshot)).toEqual(['source-blob'])
  })
})
