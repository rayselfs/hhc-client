import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FileItemRecord } from '@shared/types/folder'
import type { PresentationReadinessReport } from '@renderer/lib/presentation-readiness'

const analyzePresentationReadiness = vi.fn()
const ensureOneDriveItemAvailableForPresentation = vi.fn()

vi.mock('@renderer/lib/presentation-readiness', () => ({
  analyzePresentationReadiness,
  createPresentationSnapshot: vi.fn((files: FileItemRecord[]) => ({
    id: 'snapshot',
    createdAt: 1,
    entries: files.map((file, index) => ({
      index,
      itemId: file.id,
      blobId: file.id,
      name: file.name,
      mimeType: file.mimeType,
      sourceUrl: file.url
    }))
  })),
  getPresentationSnapshotResourceIds: vi.fn(() => [])
}))

vi.mock('@renderer/lib/onedrive-connect', () => ({
  ensureOneDriveItemAvailableForPresentation
}))

vi.mock('@renderer/lib/media-resource-locks', () => ({
  lockMediaResources: vi.fn(() => vi.fn())
}))

function makeFile(id: string, name: string): FileItemRecord {
  return {
    id,
    name,
    mimeType: 'image/png',
    type: 'file',
    sortIndex: 0,
    parentId: 'root',
    size: 1024,
    url: `blob:${id}`,
    createdAt: 1,
    expiresAt: null
  }
}

function report(
  items: Array<{ itemId: string; status: 'ready' | 'preparing' }>
): PresentationReadinessReport {
  return {
    summary: {
      ready: items.filter((item) => item.status === 'ready').length,
      preparing: items.filter((item) => item.status === 'preparing').length,
      unsupported: 0,
      missing: 0,
      failed: 0
    },
    items: items.map((item) => ({
      itemId: item.itemId,
      blobId: item.itemId,
      status: item.status,
      reason: item.status === 'ready' ? 'ready-native' : 'sync-remote-only',
      support: item.status === 'ready' ? 'native' : null
    }))
  }
}

describe('startPresentationWithReadiness priority', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('downloads the requested sync item instead of falling back to the last ready item', async () => {
    const { useMediaProjectionStore } = await import('@renderer/stores/media-projection')
    const ready = makeFile('ready', 'ready.png')
    const requested = makeFile('requested', 'requested.png')
    analyzePresentationReadiness
      .mockResolvedValueOnce(
        report([
          { itemId: ready.id, status: 'ready' },
          { itemId: requested.id, status: 'preparing' }
        ])
      )
      .mockResolvedValueOnce(
        report([
          { itemId: ready.id, status: 'ready' },
          { itemId: requested.id, status: 'ready' }
        ])
      )
    ensureOneDriveItemAvailableForPresentation.mockResolvedValueOnce(true)

    await useMediaProjectionStore
      .getState()
      .startPresentationWithReadiness([ready, requested], 1, { prioritizeStartItem: true })

    expect(ensureOneDriveItemAvailableForPresentation).toHaveBeenCalledWith(requested)
    expect(useMediaProjectionStore.getState().playlist.map((item) => item.id)).toEqual([
      ready.id,
      requested.id
    ])
    expect(useMediaProjectionStore.getState().currentIndex).toBe(1)
  })
})
