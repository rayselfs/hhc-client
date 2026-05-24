import { describe, it, expect, vi } from 'vitest'
import { createFolderDB } from '@renderer/lib/folder-db'
import type { AnyItemRecord } from '@shared/types/folder'

const ROOT_ID = 'test-root'

function makeItem(overrides: Partial<AnyItemRecord> = {}): AnyItemRecord {
  return {
    id: crypto.randomUUID(),
    type: 'verse',
    parentId: ROOT_ID,
    sortIndex: 0,
    createdAt: Date.now(),
    expiresAt: null,
    versionId: 1,
    bookNumber: 1,
    chapter: 1,
    verse: 1,
    text: 'test verse',
    ...overrides
  } as AnyItemRecord
}

describe('deleteExpiredItems() — uses getAllFromIndex instead of getAll', () => {
  it('calls getAllFromIndex with by-parent index and rootId', async () => {
    const getAllFromIndex = vi.fn().mockResolvedValue([])
    const getAll = vi.fn()
    const mockDB = { getAllFromIndex, getAll, put: vi.fn(), delete: vi.fn(), transaction: vi.fn() }
    const getDB = vi.fn().mockResolvedValue(mockDB)

    const ops = createFolderDB(getDB, ROOT_ID)
    await ops.deleteExpiredItems(Date.now())

    expect(getAllFromIndex).toHaveBeenCalledWith('folder-items', 'by-parent', ROOT_ID)
    expect(getAll).not.toHaveBeenCalledWith('folder-items')
  })

  it('returns ids of expired items only', async () => {
    const now = Date.now()
    const expiredItem = makeItem({ id: 'expired-1', expiresAt: now - 1000 })
    const validItem = makeItem({ id: 'valid-1', expiresAt: now + 10000 })
    const noExpiryItem = makeItem({ id: 'no-expiry', expiresAt: null })

    const getAllFromIndex = vi.fn().mockResolvedValue([expiredItem, validItem, noExpiryItem])
    const mockTx = { store: { delete: vi.fn() }, done: Promise.resolve() }
    const mockDB = {
      getAllFromIndex,
      transaction: vi.fn().mockReturnValue(mockTx)
    }
    const getDB = vi.fn().mockResolvedValue(mockDB)

    const ops = createFolderDB(getDB, ROOT_ID)
    const result = await ops.deleteExpiredItems(now)

    expect(result).toEqual(['expired-1'])
    expect(result).not.toContain('valid-1')
    expect(result).not.toContain('no-expiry')
  })

  it('returns empty array when no items are expired', async () => {
    const now = Date.now()
    const validItem = makeItem({ id: 'valid-1', expiresAt: now + 10000 })

    const getAllFromIndex = vi.fn().mockResolvedValue([validItem])
    const mockDB = { getAllFromIndex }
    const getDB = vi.fn().mockResolvedValue(mockDB)

    const ops = createFolderDB(getDB, ROOT_ID)
    const result = await ops.deleteExpiredItems(now)

    expect(result).toEqual([])
  })
})
