import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../env', () => ({
  isElectron: vi.fn(() => false)
}))

vi.mock('../local-sync-import', () => ({
  refreshLocalSyncConnection: vi.fn()
}))

const { refreshAllOneDriveFoldersMock } = vi.hoisted(() => ({
  refreshAllOneDriveFoldersMock: vi.fn<
    () => Promise<import('../onedrive-connect').OneDriveRefreshSummary[]>
  >(async () => [])
}))

vi.mock('../onedrive-connect', () => ({
  refreshAllOneDriveFolders: refreshAllOneDriveFoldersMock
}))

import { startSyncRuntime } from '../sync-runtime'
import { refreshAllOneDriveFolders } from '../onedrive-connect'

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('startSyncRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    refreshAllOneDriveFoldersMock.mockReset()
    refreshAllOneDriveFoldersMock.mockResolvedValue([])
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps OneDrive refresh active in Web mode without local sync', async () => {
    const stop = startSyncRuntime()
    await vi.runOnlyPendingTimersAsync()

    expect(refreshAllOneDriveFolders).toHaveBeenCalled()

    stop()
  })

  it('uses the idle delay when OneDrive has no work', async () => {
    const stop = startSyncRuntime()

    await flushMicrotasks()
    expect(refreshAllOneDriveFolders).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5 * 60_000 - 1)
    expect(refreshAllOneDriveFolders).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(refreshAllOneDriveFolders).toHaveBeenCalledTimes(2)

    stop()
  })

  it('switches to the active delay when refresh reports pending work', async () => {
    refreshAllOneDriveFoldersMock
      .mockResolvedValueOnce([
        {
          connectionId: 'connection-1',
          rootFolderId: 'root-1',
          updatedItemCount: 1,
          removedItemCount: 0,
          removedFolderCount: 0,
          downloadedCount: 0,
          failedFileCount: 0,
          disabledFileCount: 0,
          changedCount: 1,
          pendingFileCount: 1,
          retryableFileCount: 0,
          usedCursor: true,
          fullScanFallback: false
        }
      ])
      .mockResolvedValue([])

    const stop = startSyncRuntime()

    await flushMicrotasks()
    expect(refreshAllOneDriveFolders).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(15_000 - 1)
    expect(refreshAllOneDriveFolders).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(refreshAllOneDriveFolders).toHaveBeenCalledTimes(2)

    stop()
  })
})
