import { describe, it, expect, vi } from 'vitest'
import { createFolderDB } from '@renderer/lib/folder-db'
import type { AnyItemRecord, FolderRecord } from '@shared/types/folder'

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

function makeFolder(overrides: Partial<FolderRecord> = {}): FolderRecord {
  return {
    id: crypto.randomUUID(),
    name: 'Test folder',
    parentId: ROOT_ID,
    sortIndex: 0,
    createdAt: Date.now(),
    expiresAt: null,
    ...overrides
  }
}

describe('persistence failure propagation', () => {
  const publicOperations: Array<{
    name: string
    run: (ops: ReturnType<typeof createFolderDB>) => Promise<unknown>
  }> = [
    { name: 'loadAllFolders', run: (ops) => ops.loadAllFolders() },
    { name: 'saveFolder', run: (ops) => ops.saveFolder(makeFolder()) },
    { name: 'saveFolders', run: (ops) => ops.saveFolders([makeFolder()]) },
    { name: 'deleteFolders', run: (ops) => ops.deleteFolders(['folder']) },
    { name: 'loadItemsByParent', run: (ops) => ops.loadItemsByParent(ROOT_ID) },
    { name: 'saveItem', run: (ops) => ops.saveItem(makeItem()) },
    { name: 'saveItems', run: (ops) => ops.saveItems([makeItem()]) },
    { name: 'deleteItem', run: (ops) => ops.deleteItem('item') },
    { name: 'deleteItems', run: (ops) => ops.deleteItems(['item']) },
    { name: 'deleteItemsByParent', run: (ops) => ops.deleteItemsByParent(ROOT_ID) },
    { name: 'deleteExpiredFolders', run: (ops) => ops.deleteExpiredFolders(Date.now()) },
    { name: 'deleteExpiredItems', run: (ops) => ops.deleteExpiredItems(Date.now()) },
    { name: 'purgeTrashOlderThan', run: (ops) => ops.purgeTrashOlderThan(Date.now(), 1_000) }
  ]

  it.each(publicOperations)('propagates $name database failures', async ({ run }) => {
    const failure = new Error('indexeddb unavailable')
    const ops = createFolderDB(vi.fn().mockRejectedValue(failure), ROOT_ID)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(run(ops)).rejects.toBe(failure)

    consoleError.mockRestore()
  })

  it('propagates an item write failure instead of reporting success', async () => {
    const failure = new Error('quota exceeded')
    const ops = createFolderDB(
      async () => ({ put: vi.fn().mockRejectedValue(failure) }),
      ROOT_ID
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(ops.saveItem(makeItem())).rejects.toBe(failure)

    consoleError.mockRestore()
  })

  it('keeps the missing deleted-at index compatibility fallback', async () => {
    const expired = makeItem({ id: 'expired', deletedAt: 1 })
    const getAllFromIndex = vi.fn().mockRejectedValue(new Error('missing index'))
    const getAll = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([expired])
    const deleteItem = vi.fn()
    const tx = { store: { delete: deleteItem }, done: Promise.resolve() }
    const ops = createFolderDB(
      async () => ({
        getAll,
        getAllFromIndex,
        transaction: vi.fn().mockReturnValue(tx)
      }),
      ROOT_ID
    )

    await expect(ops.purgeTrashOlderThan(10_000, 1_000)).resolves.toEqual({
      folderIds: [],
      itemIds: ['expired']
    })
    expect(getAll).toHaveBeenNthCalledWith(1, 'folder-records')
    expect(getAll).toHaveBeenNthCalledWith(2, 'folder-items')
    expect(deleteItem).toHaveBeenCalledWith('expired')
  })

  it('propagates the full-scan failure when the deleted-at index is unavailable', async () => {
    const failure = new Error('full scan failed')
    const getAll = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(failure)
    const ops = createFolderDB(
      async () => ({
        getAll,
        getAllFromIndex: vi.fn().mockRejectedValue(new Error('missing index'))
      }),
      ROOT_ID
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(ops.purgeTrashOlderThan(10_000, 1_000)).rejects.toBe(failure)

    consoleError.mockRestore()
  })
})

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
