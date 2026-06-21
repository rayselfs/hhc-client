import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../env', () => ({
  isElectron: vi.fn(() => false)
}))

vi.mock('../local-sync-import', () => ({
  refreshLocalSyncConnection: vi.fn()
}))

vi.mock('../onedrive-connect', () => ({
  refreshAllOneDriveFolders: vi.fn(async () => [])
}))

import { startSyncRuntime } from '../sync-runtime'
import { refreshAllOneDriveFolders } from '../onedrive-connect'

describe('startSyncRuntime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
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
})
