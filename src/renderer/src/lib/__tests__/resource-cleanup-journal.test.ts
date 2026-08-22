import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  envState,
  mockDeleteDerivedAssets,
  mockDeletePdfPageThumbs,
  mockDeleteThumbnail,
  mockDeleteNativeFile
} = vi.hoisted(() => ({
  envState: { isElectron: false },
  mockDeleteDerivedAssets: vi.fn(),
  mockDeletePdfPageThumbs: vi.fn(),
  mockDeleteThumbnail: vi.fn(),
  mockDeleteNativeFile: vi.fn()
}))

vi.mock('@renderer/lib/env', () => ({
  isElectron: () => envState.isElectron
}))

vi.mock('@renderer/lib/media-work-db', () => ({
  deleteDerivedAssetsForSource: mockDeleteDerivedAssets
}))

vi.mock('@renderer/lib/thumbnail-db', () => ({
  deletePdfPageThumbs: mockDeletePdfPageThumbs,
  deleteThumbnail: mockDeleteThumbnail
}))

import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import {
  createResourceCleanupRecord,
  getResourceCleanupRecord,
  listResourceCleanupRecords,
  putResourceCleanupRecord,
  retryPendingResourceCleanups,
  retryResourceCleanup
} from '../resource-cleanup-journal'

beforeAll(() => {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      nativeFs: {
        delete: mockDeleteNativeFile
      }
    }
  })
})

beforeEach(async () => {
  await resetFileExplorerDBForTests()
  vi.clearAllMocks()
  envState.isElectron = false
  mockDeleteDerivedAssets.mockResolvedValue(undefined)
  mockDeletePdfPageThumbs.mockResolvedValue(undefined)
  mockDeleteThumbnail.mockResolvedValue(undefined)
  mockDeleteNativeFile.mockResolvedValue(undefined)
})

describe('resource cleanup journal', () => {
  it('creates the cleanup journal store during database upgrade', async () => {
    const db = await openFileExplorerDB()

    expect(db.objectStoreNames.contains('resource-cleanup-journal')).toBe(true)
  })

  it('processes browser resources and removes a successful record', async () => {
    const record = createResourceCleanupRecord({
      blobId: 'blob-1',
      storage: 'indexed-db',
      deleteNativeFile: false,
      deleteDerivedAssets: true,
      deletePdfPageThumbs: true,
      itemThumbnailIds: ['item-1', 'item-2']
    })
    await putResourceCleanupRecord(record)

    await retryResourceCleanup(record.id)

    expect(mockDeleteNativeFile).not.toHaveBeenCalled()
    expect(mockDeleteDerivedAssets).toHaveBeenCalledWith('blob-1')
    expect(mockDeletePdfPageThumbs).toHaveBeenCalledWith('blob-1')
    expect(mockDeleteThumbnail.mock.calls).toEqual([['item-1'], ['item-2']])
    await expect(getResourceCleanupRecord(record.id)).resolves.toBeUndefined()
  })

  it('deletes native files in Electron mode', async () => {
    envState.isElectron = true
    const record = createResourceCleanupRecord({
      blobId: 'native-blob',
      storage: 'native-fs',
      deleteNativeFile: true,
      deleteDerivedAssets: false,
      deletePdfPageThumbs: false,
      itemThumbnailIds: []
    })
    await putResourceCleanupRecord(record)

    await retryResourceCleanup(record.id)

    expect(mockDeleteNativeFile).toHaveBeenCalledWith('native-blob')
    await expect(listResourceCleanupRecords()).resolves.toEqual([])
  })

  it('retains a failed cleanup so the exact work can be retried', async () => {
    mockDeleteDerivedAssets.mockRejectedValueOnce(new Error('quota exceeded'))
    const record = createResourceCleanupRecord({
      blobId: 'blob-2',
      storage: 'indexed-db',
      deleteNativeFile: false,
      deleteDerivedAssets: true,
      deletePdfPageThumbs: false,
      itemThumbnailIds: []
    })
    await putResourceCleanupRecord(record)

    await expect(retryResourceCleanup(record.id)).rejects.toThrow('quota exceeded')

    await expect(getResourceCleanupRecord(record.id)).resolves.toMatchObject({
      status: 'failed',
      attempt: 1,
      lastError: 'quota exceeded'
    })

    await retryResourceCleanup(record.id)
    await expect(getResourceCleanupRecord(record.id)).resolves.toBeUndefined()
  })

  it('retries every pending record without one failure blocking the others', async () => {
    mockDeleteDerivedAssets.mockRejectedValueOnce(new Error('first failed'))
    const first = createResourceCleanupRecord({
      blobId: 'blob-first',
      storage: 'indexed-db',
      deleteNativeFile: false,
      deleteDerivedAssets: true,
      deletePdfPageThumbs: false,
      itemThumbnailIds: []
    })
    const second = createResourceCleanupRecord({
      blobId: 'blob-second',
      storage: 'indexed-db',
      deleteNativeFile: false,
      deleteDerivedAssets: true,
      deletePdfPageThumbs: false,
      itemThumbnailIds: []
    })
    await putResourceCleanupRecord(first)
    await putResourceCleanupRecord(second)

    const result = await retryPendingResourceCleanups()

    expect(result).toEqual({ attempted: 2, failed: 1 })
    const remaining = await listResourceCleanupRecords()
    expect(remaining).toEqual([expect.objectContaining({ status: 'failed', attempt: 1 })])
    expect([first.id, second.id]).toContain(remaining[0].id)
  })
})
