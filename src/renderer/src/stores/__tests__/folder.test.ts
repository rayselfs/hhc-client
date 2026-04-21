import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockLoadAllFolders = vi.fn()
const mockLoadItemsByParent = vi.fn()
const mockSaveFolder = vi.fn()
const mockSaveFolders = vi.fn()
const mockDeleteFolders = vi.fn()
const mockSaveItem = vi.fn()
const mockSaveItems = vi.fn()
const mockDeleteItem = vi.fn()
const mockDeleteItems = vi.fn()
const mockDeleteItemsByParent = vi.fn()
const mockDeleteExpiredFolders = vi.fn()
const mockDeleteExpiredItems = vi.fn()

vi.mock('@renderer/lib/folder-db', () => ({
  createFolderDB: () => ({
    loadAllFolders: (...args: unknown[]) => mockLoadAllFolders(...args),
    loadItemsByParent: (...args: unknown[]) => mockLoadItemsByParent(...args),
    saveFolder: (...args: unknown[]) => mockSaveFolder(...args),
    saveFolders: (...args: unknown[]) => mockSaveFolders(...args),
    deleteFolders: (...args: unknown[]) => mockDeleteFolders(...args),
    saveItem: (...args: unknown[]) => mockSaveItem(...args),
    saveItems: (...args: unknown[]) => mockSaveItems(...args),
    deleteItem: (...args: unknown[]) => mockDeleteItem(...args),
    deleteItems: (...args: unknown[]) => mockDeleteItems(...args),
    deleteItemsByParent: (...args: unknown[]) => mockDeleteItemsByParent(...args),
    deleteExpiredFolders: (...args: unknown[]) => mockDeleteExpiredFolders(...args),
    deleteExpiredItems: (...args: unknown[]) => mockDeleteExpiredItems(...args)
  })
}))

vi.mock('@renderer/lib/bible-db', () => ({
  openBibleDB: vi.fn()
}))

import { useBibleFolderStore } from '@renderer/stores/folder'
import type { FolderRecord, VerseItemRecord } from '@shared/types/folder'

const ROOT_ID = 'bible-root'

const rootFolder: FolderRecord = {
  id: ROOT_ID,
  name: 'Bible Library',
  parentId: null,
  sortIndex: 0,
  createdAt: Date.now(),
  expiresAt: null
}

const makeVerse = (id: string): Omit<VerseItemRecord, 'id' | 'sortIndex' | 'createdAt'> => ({
  type: 'verse',
  parentId: ROOT_ID,
  versionId: 1,
  bookNumber: 1,
  chapter: 1,
  verse: 1,
  text: `Verse ${id}`,
  expiresAt: null
})

beforeEach(() => {
  useBibleFolderStore.setState({
    folders: { [ROOT_ID]: rootFolder },
    items: {},
    loadedParents: new Set([ROOT_ID]),
    currentFolderId: ROOT_ID,
    isLoading: false
  })
  vi.clearAllMocks()
  mockSaveFolder.mockResolvedValue(undefined)
  mockSaveFolders.mockResolvedValue(undefined)
  mockDeleteFolders.mockResolvedValue(undefined)
  mockSaveItem.mockResolvedValue(undefined)
  mockSaveItems.mockResolvedValue(undefined)
  mockDeleteItem.mockResolvedValue(undefined)
  mockDeleteItems.mockResolvedValue(undefined)
  mockLoadAllFolders.mockResolvedValue([rootFolder])
  mockLoadItemsByParent.mockResolvedValue([])
})

describe('initialize()', () => {
  it('loads stored folders when available', async () => {
    const childFolder: FolderRecord = {
      id: 'f1',
      name: 'Folder One',
      parentId: ROOT_ID,
      sortIndex: 0,
      createdAt: Date.now(),
      expiresAt: null
    }
    mockLoadAllFolders.mockResolvedValue([rootFolder, childFolder])
    await useBibleFolderStore.getState().initialize()
    const { folders } = useBibleFolderStore.getState()
    expect(folders['f1']).toBeDefined()
    expect(folders['f1'].name).toBe('Folder One')
  })

  it('creates fresh root and persists when no stored folders', async () => {
    mockLoadAllFolders.mockResolvedValue([])
    await useBibleFolderStore.getState().initialize()
    expect(useBibleFolderStore.getState().folders[ROOT_ID]).toBeDefined()
    expect(mockSaveFolder).toHaveBeenCalled()
  })

  it('loads root items on initialize', async () => {
    mockLoadAllFolders.mockResolvedValue([rootFolder])
    mockLoadItemsByParent.mockResolvedValue([])
    await useBibleFolderStore.getState().initialize()
    expect(mockLoadItemsByParent).toHaveBeenCalledWith(ROOT_ID)
  })

  it('sets isLoading false after completion', async () => {
    await useBibleFolderStore.getState().initialize()
    expect(useBibleFolderStore.getState().isLoading).toBe(false)
  })
})

describe('addFolder()', () => {
  it('creates a new folder at root level', () => {
    useBibleFolderStore.getState().addFolder('My Folder')
    const childFolders = useBibleFolderStore.getState().getChildFolders(ROOT_ID)
    expect(childFolders).toHaveLength(1)
    expect(childFolders[0].name).toBe('My Folder')
    expect(childFolders[0].parentId).toBe(ROOT_ID)
  })

  it('assigns unique id to new folder', () => {
    useBibleFolderStore.getState().addFolder('A')
    useBibleFolderStore.getState().addFolder('B')
    const childFolders = useBibleFolderStore.getState().getChildFolders(ROOT_ID)
    expect(childFolders[0].id).not.toBe(childFolders[1].id)
  })

  it('persists after adding folder', () => {
    useBibleFolderStore.getState().addFolder('Test')
    expect(mockSaveFolder).toHaveBeenCalled()
  })
})

describe('updateFolder()', () => {
  it('renames an existing folder', () => {
    useBibleFolderStore.getState().addFolder('Old Name')
    const folderId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    useBibleFolderStore.getState().updateFolder(folderId, { name: 'New Name' })
    expect(useBibleFolderStore.getState().folders[folderId].name).toBe('New Name')
  })

  it('does not rename root folder', () => {
    useBibleFolderStore.getState().updateFolder(ROOT_ID, { name: 'Hacked' })
    expect(useBibleFolderStore.getState().folders[ROOT_ID].name).toBe('Bible Library')
  })

  it('persists after rename', () => {
    useBibleFolderStore.getState().addFolder('X')
    mockSaveFolder.mockClear()
    const folderId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    useBibleFolderStore.getState().updateFolder(folderId, { name: 'Y' })
    expect(mockSaveFolder).toHaveBeenCalled()
  })
})

describe('deleteFolder()', () => {
  it('removes folder by id', () => {
    useBibleFolderStore.getState().addFolder('Delete Me')
    const folderId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    useBibleFolderStore.getState().deleteFolder(folderId)
    expect(useBibleFolderStore.getState().folders[folderId]).toBeUndefined()
  })

  it('does not delete root folder', () => {
    useBibleFolderStore.getState().deleteFolder(ROOT_ID)
    expect(useBibleFolderStore.getState().folders[ROOT_ID]).toBeDefined()
    expect(useBibleFolderStore.getState().folders[ROOT_ID].id).toBe(ROOT_ID)
  })

  it('resets currentFolderId to root when deleting current folder', async () => {
    useBibleFolderStore.getState().addFolder('Nav Folder')
    const folderId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    await useBibleFolderStore.getState().navigateToFolder(folderId)
    expect(useBibleFolderStore.getState().currentFolderId).toBe(folderId)
    useBibleFolderStore.getState().deleteFolder(folderId)
    expect(useBibleFolderStore.getState().currentFolderId).toBe(ROOT_ID)
  })
})

describe('addItem()', () => {
  it('adds item to root by default (via parentId)', () => {
    useBibleFolderStore.getState().addItem(makeVerse('v1'))
    const rootItems = useBibleFolderStore.getState().getItems(ROOT_ID)
    expect(rootItems).toHaveLength(1)
  })

  it('adds item to specified folder via parentId field', () => {
    useBibleFolderStore.getState().addFolder('Sub')
    const folderId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    useBibleFolderStore.getState().addItem({ ...makeVerse('v2'), parentId: folderId })
    expect(useBibleFolderStore.getState().getItems(folderId)).toHaveLength(1)
    expect(useBibleFolderStore.getState().getItems(ROOT_ID)).toHaveLength(0)
  })

  it('assigns sortIndex based on position', () => {
    useBibleFolderStore.getState().addItem(makeVerse('v1'))
    useBibleFolderStore.getState().addItem(makeVerse('v2'))
    const items = useBibleFolderStore.getState().getItems(ROOT_ID)
    expect(items[0].sortIndex).toBe(0)
    expect(items[1].sortIndex).toBe(1)
  })

  it('persists after adding item', () => {
    useBibleFolderStore.getState().addItem(makeVerse('v1'))
    expect(mockSaveItem).toHaveBeenCalled()
  })
})

describe('removeItem()', () => {
  it('removes item by id from root', () => {
    useBibleFolderStore.getState().addItem(makeVerse('v1'))
    useBibleFolderStore.getState().addItem(makeVerse('v2'))
    const rootItems = useBibleFolderStore.getState().getItems(ROOT_ID)
    const firstId = rootItems[0].id
    const secondId = rootItems[1].id
    useBibleFolderStore.getState().removeItem(firstId)
    const remaining = useBibleFolderStore.getState().getItems(ROOT_ID)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe(secondId)
  })

  it('removes item from nested folder', () => {
    useBibleFolderStore.getState().addFolder('Sub')
    const folderId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    useBibleFolderStore.getState().addItem({ ...makeVerse('nested'), parentId: folderId })
    const nestedId = useBibleFolderStore.getState().getItems(folderId)[0].id
    useBibleFolderStore.getState().removeItem(nestedId)
    expect(useBibleFolderStore.getState().getItems(folderId)).toHaveLength(0)
  })
})

describe('moveItem()', () => {
  it('moves item from root to a subfolder', () => {
    useBibleFolderStore.getState().addItem(makeVerse('v1'))
    useBibleFolderStore.getState().addFolder('Target')
    const targetId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    const itemId = useBibleFolderStore.getState().getItems(ROOT_ID)[0].id
    useBibleFolderStore.getState().moveItem(itemId, targetId)
    expect(useBibleFolderStore.getState().getItems(ROOT_ID)).toHaveLength(0)
    expect(useBibleFolderStore.getState().getItems(targetId)).toHaveLength(1)
    expect(useBibleFolderStore.getState().getItems(targetId)[0].id).toBe(itemId)
  })

  it('moves item from subfolder back to root', () => {
    useBibleFolderStore.getState().addFolder('Source')
    const sourceId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    useBibleFolderStore.getState().addItem({ ...makeVerse('v1'), parentId: sourceId })
    const itemId = useBibleFolderStore.getState().getItems(sourceId)[0].id
    useBibleFolderStore.getState().moveItem(itemId, ROOT_ID)
    expect(useBibleFolderStore.getState().getItems(sourceId)).toHaveLength(0)
    expect(useBibleFolderStore.getState().getItems(ROOT_ID)).toHaveLength(1)
  })

  it('is a no-op when itemId does not exist', () => {
    useBibleFolderStore.getState().addFolder('Target')
    const targetId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    mockSaveItem.mockClear()
    useBibleFolderStore.getState().moveItem('nonexistent', targetId)
    expect(mockSaveItem).not.toHaveBeenCalled()
  })
})

describe('reorderItems()', () => {
  it('reorders items in a folder via orderedIds', () => {
    useBibleFolderStore.getState().addItem(makeVerse('a'))
    useBibleFolderStore.getState().addItem(makeVerse('b'))
    useBibleFolderStore.getState().addItem(makeVerse('c'))
    const [idA, idB, idC] = useBibleFolderStore
      .getState()
      .getItems(ROOT_ID)
      .map((i) => i.id)
    useBibleFolderStore.getState().reorderItems(ROOT_ID, [idC, idA, idB])
    const items = useBibleFolderStore.getState().getItems(ROOT_ID)
    expect(items[0].id).toBe(idC)
    expect(items[0].sortIndex).toBe(0)
    expect(items[1].id).toBe(idA)
    expect(items[1].sortIndex).toBe(1)
    expect(items[2].id).toBe(idB)
    expect(items[2].sortIndex).toBe(2)
  })

  it('persists after reorder', () => {
    useBibleFolderStore.getState().addItem(makeVerse('a'))
    useBibleFolderStore.getState().addItem(makeVerse('b'))
    const [idA, idB] = useBibleFolderStore
      .getState()
      .getItems(ROOT_ID)
      .map((i) => i.id)
    mockSaveItems.mockClear()
    useBibleFolderStore.getState().reorderItems(ROOT_ID, [idB, idA])
    expect(mockSaveItems).toHaveBeenCalled()
  })
})

describe('navigateToFolder() / navigateUp() / navigateToRoot()', () => {
  it('navigateToFolder sets currentFolderId', async () => {
    useBibleFolderStore.getState().addFolder('Sub')
    const folderId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    await useBibleFolderStore.getState().navigateToFolder(folderId)
    expect(useBibleFolderStore.getState().currentFolderId).toBe(folderId)
  })

  it('navigateToFolder is a no-op for nonexistent folder', async () => {
    await useBibleFolderStore.getState().navigateToFolder('ghost-id')
    expect(useBibleFolderStore.getState().currentFolderId).toBe(ROOT_ID)
  })

  it('navigateToRoot returns to root', async () => {
    useBibleFolderStore.getState().addFolder('Sub')
    const folderId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    await useBibleFolderStore.getState().navigateToFolder(folderId)
    useBibleFolderStore.getState().navigateToRoot()
    expect(useBibleFolderStore.getState().currentFolderId).toBe(ROOT_ID)
  })

  it('navigateUp from subfolder goes to root (parent)', async () => {
    useBibleFolderStore.getState().addFolder('Sub')
    const folderId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    await useBibleFolderStore.getState().navigateToFolder(folderId)
    useBibleFolderStore.getState().navigateUp()
    expect(useBibleFolderStore.getState().currentFolderId).toBe(ROOT_ID)
  })

  it('navigateUp from root is a no-op', () => {
    useBibleFolderStore.getState().navigateUp()
    expect(useBibleFolderStore.getState().currentFolderId).toBe(ROOT_ID)
  })
})

describe('current folder via folders[currentFolderId]', () => {
  it('returns root when at root', () => {
    const { folders, currentFolderId } = useBibleFolderStore.getState()
    expect(folders[currentFolderId].id).toBe(ROOT_ID)
  })

  it('returns correct subfolder when navigated', async () => {
    useBibleFolderStore.getState().addFolder('Deep')
    const folderId = useBibleFolderStore.getState().getChildFolders(ROOT_ID)[0].id
    await useBibleFolderStore.getState().navigateToFolder(folderId)
    const { folders, currentFolderId } = useBibleFolderStore.getState()
    expect(folders[currentFolderId].id).toBe(folderId)
    expect(folders[currentFolderId].name).toBe('Deep')
  })
})
