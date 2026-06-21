import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { refreshFolderMock } = vi.hoisted(() => ({
  refreshFolderMock: vi.fn<() => Promise<void>>(async () => undefined)
}))

const folderState = {
  folders: {
    'sync-root': {
      id: 'sync-root',
      parentId: 'root',
      name: 'OneDrive',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      syncLink: {
        providerConnectionId: 'connection-1',
        providerType: 'onedrive',
        remoteFolderId: 'remote-folder-1',
        offlinePolicy: 'always-offline'
      }
    }
  }
}

vi.mock('@renderer/stores/file-explorer', () => ({
  useFileExplorerStore: {
    getState: () => folderState
  }
}))

vi.mock('../cloud-provider', () => ({
  getCloudProviderAdapter: () => ({
    refreshFolder: refreshFolderMock
  })
}))

vi.mock('../env', () => ({
  isElectron: () => false
}))

vi.mock('../local-sync-import', () => ({
  refreshLocalSyncConnection: vi.fn()
}))

import {
  NAVIGATION_REFRESH_COOLDOWN_MS,
  refreshSyncFolderOnNavigation,
  resetSyncFolderRefreshForTests
} from '../sync-folder-refresh'

describe('refreshSyncFolderOnNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    refreshFolderMock.mockClear()
    refreshFolderMock.mockResolvedValue(undefined)
    resetSyncFolderRefreshForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refreshes a cloud sync root on first navigation', async () => {
    await refreshSyncFolderOnNavigation('sync-root')

    expect(refreshFolderMock).toHaveBeenCalledWith('sync-root')
  })

  it('skips repeated navigation refreshes within the cooldown window', async () => {
    await refreshSyncFolderOnNavigation('sync-root')
    await refreshSyncFolderOnNavigation('sync-root')

    expect(refreshFolderMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(NAVIGATION_REFRESH_COOLDOWN_MS)
    await refreshSyncFolderOnNavigation('sync-root')

    expect(refreshFolderMock).toHaveBeenCalledTimes(2)
  })

  it('does not overlap refreshes for the same sync root', async () => {
    let resolve!: () => void
    refreshFolderMock.mockReturnValue(
      new Promise<void>((resolvePromise) => {
        resolve = resolvePromise
      })
    )

    const first = refreshSyncFolderOnNavigation('sync-root')
    await refreshSyncFolderOnNavigation('sync-root')

    expect(refreshFolderMock).toHaveBeenCalledTimes(1)

    resolve()
    await first
  })
})
