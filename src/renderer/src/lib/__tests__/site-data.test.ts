import { describe, expect, it, vi, beforeEach } from 'vitest'

const resetMocks = vi.hoisted(() => ({
  resetBibleDB: vi.fn(),
  resetFileExplorerDB: vi.fn(),
  resetMediaWorkDB: vi.fn(),
  resetSyncDB: vi.fn(),
  resetThumbnailDB: vi.fn(),
  resetWebOneDriveCredentialDB: vi.fn()
}))

vi.mock('../bible-db', () => ({ resetBibleDB: resetMocks.resetBibleDB }))
vi.mock('../file-explorer-db', () => ({ resetFileExplorerDB: resetMocks.resetFileExplorerDB }))
vi.mock('../media-work-db', () => ({ resetMediaWorkDB: resetMocks.resetMediaWorkDB }))
vi.mock('../sync-db', () => ({ resetSyncDB: resetMocks.resetSyncDB }))
vi.mock('../thumbnail-db', () => ({ resetThumbnailDB: resetMocks.resetThumbnailDB }))
vi.mock('../onedrive-web-credentials', () => ({
  resetWebOneDriveCredentialDB: resetMocks.resetWebOneDriveCredentialDB
}))

import { clearAllSiteData } from '../site-data'

beforeEach(() => {
  vi.clearAllMocks()
  for (const reset of Object.values(resetMocks)) {
    reset.mockResolvedValue(undefined)
  }
})

describe('clearAllSiteData', () => {
  it('continues when an IndexedDB deletion is blocked by an open connection', async () => {
    resetMocks.resetBibleDB.mockRejectedValueOnce(new Error('Bible database deletion blocked'))

    await expect(clearAllSiteData()).resolves.toBeUndefined()
  })
})
