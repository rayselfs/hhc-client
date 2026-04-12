import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockSaveFolderTree = vi.fn()
const mockLoadFolderTree = vi.fn()

vi.mock('@renderer/lib/bible-db', () => ({
  saveFolderTree: (...args: unknown[]) => mockSaveFolderTree(...args),
  loadFolderTree: (...args: unknown[]) => mockLoadFolderTree(...args),
  loadBibleContent: vi.fn(),
  saveBibleContent: vi.fn(),
  loadBibleVersionMeta: vi.fn(),
  saveBibleVersionMeta: vi.fn()
}))

import { useBibleFolderStore } from '@renderer/stores/folder'
import type { VerseItem } from '@shared/types/folder'

const ROOT_ID = 'bible-root'

const makeVerse = (id: string, overrides: Partial<VerseItem> = {}): VerseItem => ({
  id,
  type: 'verse',
  folderId: ROOT_ID,
  bookCode: 'Gen',
  bookName: 'Genesis',
  bookNumber: 1,
  chapter: 1,
  verseStart: 1,
  verseEnd: 1,
  text: `Verse ${id}`,
  versionCode: 'KJV',
  versionName: 'King James',
  createdAt: Date.now(),
  ...overrides
})

beforeEach(() => {
  useBibleFolderStore.setState({
    root: {
      id: ROOT_ID,
      name: 'Bible Library',
      parentId: null,
      items: [],
      folders: [],
      createdAt: Date.now()
    },
    currentFolderId: ROOT_ID,
    isLoading: false
  })
  mockSaveFolderTree.mockReset()
  mockLoadFolderTree.mockReset()
  mockSaveFolderTree.mockResolvedValue(undefined)
  mockLoadFolderTree.mockResolvedValue(undefined)
})

describe('initialize()', () => {
  it('loads stored tree when available', async () => {
    const storedRoot = {
      id: ROOT_ID,
      name: 'Bible Library',
      parentId: null,
      items: [],
      folders: [
        {
          id: 'f1',
          name: 'Folder One',
          parentId: ROOT_ID,
          items: [],
          folders: [],
          createdAt: Date.now()
        }
      ],
      createdAt: Date.now()
    }
    mockLoadFolderTree.mockResolvedValue([storedRoot])
    await useBibleFolderStore.getState().initialize()
    expect(useBibleFolderStore.getState().root.folders).toHaveLength(1)
    expect(useBibleFolderStore.getState().root.folders[0].name).toBe('Folder One')
  })

  it('creates fresh root and persists when no stored tree', async () => {
    mockLoadFolderTree.mockResolvedValue(undefined)
    await useBibleFolderStore.getState().initialize()
    expect(useBibleFolderStore.getState().root.folders).toHaveLength(0)
    expect(mockSaveFolderTree).toHaveBeenCalled()
  })

  it('sets isLoading false after completion', async () => {
    mockLoadFolderTree.mockResolvedValue(undefined)
    await useBibleFolderStore.getState().initialize()
    expect(useBibleFolderStore.getState().isLoading).toBe(false)
  })
})

describe('addFolder()', () => {
  it('creates a new folder at root level', () => {
    useBibleFolderStore.getState().addFolder('My Folder')
    const folders = useBibleFolderStore.getState().root.folders
    expect(folders).toHaveLength(1)
    expect(folders[0].name).toBe('My Folder')
    expect(folders[0].parentId).toBe(ROOT_ID)
  })

  it('assigns unique id to new folder', () => {
    useBibleFolderStore.getState().addFolder('A')
    useBibleFolderStore.getState().addFolder('B')
    const ids = useBibleFolderStore.getState().root.folders.map((f) => f.id)
    expect(ids[0]).not.toBe(ids[1])
  })

  it('persists after adding folder', () => {
    useBibleFolderStore.getState().addFolder('Test')
    expect(mockSaveFolderTree).toHaveBeenCalled()
  })
})

describe('renameFolder()', () => {
  it('renames an existing folder', () => {
    useBibleFolderStore.getState().addFolder('Old Name')
    const folderId = useBibleFolderStore.getState().root.folders[0].id
    useBibleFolderStore.getState().renameFolder(folderId, 'New Name')
    expect(useBibleFolderStore.getState().root.folders[0].name).toBe('New Name')
  })

  it('does not rename root folder', () => {
    useBibleFolderStore.getState().renameFolder(ROOT_ID, 'Hacked')
    expect(useBibleFolderStore.getState().root.name).toBe('Bible Library')
  })

  it('persists after rename', () => {
    useBibleFolderStore.getState().addFolder('X')
    mockSaveFolderTree.mockClear()
    const folderId = useBibleFolderStore.getState().root.folders[0].id
    useBibleFolderStore.getState().renameFolder(folderId, 'Y')
    expect(mockSaveFolderTree).toHaveBeenCalled()
  })
})

describe('deleteFolder()', () => {
  it('removes folder by id', () => {
    useBibleFolderStore.getState().addFolder('Delete Me')
    const folderId = useBibleFolderStore.getState().root.folders[0].id
    useBibleFolderStore.getState().deleteFolder(folderId)
    expect(useBibleFolderStore.getState().root.folders).toHaveLength(0)
  })

  it('does not delete root folder', () => {
    useBibleFolderStore.getState().deleteFolder(ROOT_ID)
    expect(useBibleFolderStore.getState().root.id).toBe(ROOT_ID)
  })

  it('resets currentFolderId to root when deleting current folder', () => {
    useBibleFolderStore.getState().addFolder('Nav Folder')
    const folderId = useBibleFolderStore.getState().root.folders[0].id
    useBibleFolderStore.getState().navigateToFolder(folderId)
    expect(useBibleFolderStore.getState().currentFolderId).toBe(folderId)
    useBibleFolderStore.getState().deleteFolder(folderId)
    expect(useBibleFolderStore.getState().currentFolderId).toBe(ROOT_ID)
  })
})

describe('addItem()', () => {
  it('adds item to current folder (root by default)', () => {
    const verse = makeVerse('v1')
    useBibleFolderStore.getState().addItem(verse)
    expect(useBibleFolderStore.getState().root.items).toHaveLength(1)
    expect(useBibleFolderStore.getState().root.items[0].id).toBe('v1')
  })

  it('adds item to specified folder', () => {
    useBibleFolderStore.getState().addFolder('Sub')
    const folderId = useBibleFolderStore.getState().root.folders[0].id
    const verse = makeVerse('v2')
    useBibleFolderStore.getState().addItem(verse, folderId)
    expect(useBibleFolderStore.getState().root.folders[0].items).toHaveLength(1)
    expect(useBibleFolderStore.getState().root.folders[0].items[0].id).toBe('v2')
  })

  it('assigns sortIndex based on position', () => {
    useBibleFolderStore.getState().addItem(makeVerse('v1'))
    useBibleFolderStore.getState().addItem(makeVerse('v2'))
    const items = useBibleFolderStore.getState().root.items
    expect(items[0].sortIndex).toBe(0)
    expect(items[1].sortIndex).toBe(1)
  })

  it('persists after adding item', () => {
    useBibleFolderStore.getState().addItem(makeVerse('v1'))
    expect(mockSaveFolderTree).toHaveBeenCalled()
  })
})

describe('removeItem()', () => {
  it('removes item by id from root', () => {
    useBibleFolderStore.getState().addItem(makeVerse('v1'))
    useBibleFolderStore.getState().addItem(makeVerse('v2'))
    useBibleFolderStore.getState().removeItem('v1')
    const items = useBibleFolderStore.getState().root.items
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('v2')
  })

  it('removes item from nested folder', () => {
    useBibleFolderStore.getState().addFolder('Sub')
    const folderId = useBibleFolderStore.getState().root.folders[0].id
    useBibleFolderStore.getState().addItem(makeVerse('nested'), folderId)
    useBibleFolderStore.getState().removeItem('nested')
    expect(useBibleFolderStore.getState().root.folders[0].items).toHaveLength(0)
  })
})

describe('moveItem()', () => {
  it('moves item from root to a subfolder', () => {
    useBibleFolderStore.getState().addItem(makeVerse('v1'))
    useBibleFolderStore.getState().addFolder('Target')
    const targetId = useBibleFolderStore.getState().root.folders[0].id
    useBibleFolderStore.getState().moveItem('v1', targetId)
    expect(useBibleFolderStore.getState().root.items).toHaveLength(0)
    expect(useBibleFolderStore.getState().root.folders[0].items).toHaveLength(1)
    expect(useBibleFolderStore.getState().root.folders[0].items[0].id).toBe('v1')
  })

  it('moves item from subfolder back to root', () => {
    useBibleFolderStore.getState().addFolder('Source')
    const sourceId = useBibleFolderStore.getState().root.folders[0].id
    useBibleFolderStore.getState().addItem(makeVerse('v1'), sourceId)
    useBibleFolderStore.getState().moveItem('v1', ROOT_ID)
    expect(useBibleFolderStore.getState().root.folders[0].items).toHaveLength(0)
    expect(useBibleFolderStore.getState().root.items).toHaveLength(1)
  })

  it('is a no-op when itemId does not exist', () => {
    useBibleFolderStore.getState().addFolder('Target')
    const targetId = useBibleFolderStore.getState().root.folders[0].id
    mockSaveFolderTree.mockClear()
    useBibleFolderStore.getState().moveItem('nonexistent', targetId)
    expect(mockSaveFolderTree).not.toHaveBeenCalled()
  })
})

describe('reorderItems()', () => {
  it('reorders items in a folder via orderedIds', () => {
    useBibleFolderStore.getState().addItem(makeVerse('a'))
    useBibleFolderStore.getState().addItem(makeVerse('b'))
    useBibleFolderStore.getState().addItem(makeVerse('c'))
    useBibleFolderStore.getState().reorderItems(ROOT_ID, ['c', 'a', 'b'])
    const items = useBibleFolderStore.getState().root.items
    expect(items[0].id).toBe('c')
    expect(items[0].sortIndex).toBe(0)
    expect(items[1].id).toBe('a')
    expect(items[1].sortIndex).toBe(1)
    expect(items[2].id).toBe('b')
    expect(items[2].sortIndex).toBe(2)
  })

  it('persists after reorder', () => {
    useBibleFolderStore.getState().addItem(makeVerse('a'))
    useBibleFolderStore.getState().addItem(makeVerse('b'))
    mockSaveFolderTree.mockClear()
    useBibleFolderStore.getState().reorderItems(ROOT_ID, ['b', 'a'])
    expect(mockSaveFolderTree).toHaveBeenCalled()
  })
})

describe('navigateToFolder() / navigateUp() / navigateToRoot()', () => {
  it('navigateToFolder sets currentFolderId', () => {
    useBibleFolderStore.getState().addFolder('Sub')
    const folderId = useBibleFolderStore.getState().root.folders[0].id
    useBibleFolderStore.getState().navigateToFolder(folderId)
    expect(useBibleFolderStore.getState().currentFolderId).toBe(folderId)
  })

  it('navigateToFolder is a no-op for nonexistent folder', () => {
    useBibleFolderStore.getState().navigateToFolder('ghost-id')
    expect(useBibleFolderStore.getState().currentFolderId).toBe(ROOT_ID)
  })

  it('navigateToRoot returns to root', () => {
    useBibleFolderStore.getState().addFolder('Sub')
    const folderId = useBibleFolderStore.getState().root.folders[0].id
    useBibleFolderStore.getState().navigateToFolder(folderId)
    useBibleFolderStore.getState().navigateToRoot()
    expect(useBibleFolderStore.getState().currentFolderId).toBe(ROOT_ID)
  })

  it('navigateUp from subfolder goes to root (parent)', () => {
    useBibleFolderStore.getState().addFolder('Sub')
    const folderId = useBibleFolderStore.getState().root.folders[0].id
    useBibleFolderStore.getState().navigateToFolder(folderId)
    useBibleFolderStore.getState().navigateUp()
    expect(useBibleFolderStore.getState().currentFolderId).toBe(ROOT_ID)
  })

  it('navigateUp from root is a no-op', () => {
    useBibleFolderStore.getState().navigateUp()
    expect(useBibleFolderStore.getState().currentFolderId).toBe(ROOT_ID)
  })
})

describe('getCurrentFolder()', () => {
  it('returns root when at root', () => {
    const current = useBibleFolderStore.getState().getCurrentFolder()
    expect(current.id).toBe(ROOT_ID)
  })

  it('returns correct subfolder when navigated', () => {
    useBibleFolderStore.getState().addFolder('Deep')
    const folderId = useBibleFolderStore.getState().root.folders[0].id
    useBibleFolderStore.getState().navigateToFolder(folderId)
    const current = useBibleFolderStore.getState().getCurrentFolder()
    expect(current.id).toBe(folderId)
    expect(current.name).toBe('Deep')
  })
})
