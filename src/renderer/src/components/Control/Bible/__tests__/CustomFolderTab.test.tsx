import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Folder, VerseItem } from '@shared/types/folder'
import { CustomFolderTab } from '../CustomFolderTab'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'

const mockNavigateTo = vi.fn()
const mockAddFolder = vi.fn()
const mockDeleteFolder = vi.fn()
const mockRemoveItem = vi.fn()
const mockNavigateToFolder = vi.fn()
const mockNavigateToRoot = vi.fn()
const mockMoveItem = vi.fn()
const mockReorderItems = vi.fn()
const mockAddItem = vi.fn()

const mockFolderA: Folder<VerseItem> = {
  id: 'folder-a',
  name: 'Sunday Worship',
  parentId: 'bible-root',
  items: [],
  folders: [],
  createdAt: Date.now()
}

const mockVerseItem: VerseItem = {
  id: 'verse-1',
  type: 'verse',
  folderId: 'bible-root',
  bookCode: 'GEN',
  bookName: '創世記',
  bookNumber: 1,
  chapter: 1,
  verseStart: 1,
  verseEnd: 1,
  text: 'In the beginning God created.',
  versionCode: 'CUV',
  versionName: '和合本',
  createdAt: Date.now()
}

const mockRoot: Folder<VerseItem> = {
  id: 'bible-root',
  name: 'Bible Library',
  parentId: null,
  items: [mockVerseItem],
  folders: [mockFolderA],
  createdAt: Date.now()
}

const folderSingleton = {
  root: mockRoot,
  currentFolderId: 'bible-root',
  isLoading: false,
  getCurrentFolder: (): Folder<VerseItem> => mockRoot,
  addFolder: mockAddFolder,
  deleteFolder: mockDeleteFolder,
  removeItem: mockRemoveItem,
  navigateToFolder: mockNavigateToFolder,
  navigateToRoot: mockNavigateToRoot,
  moveItem: mockMoveItem,
  reorderItems: mockReorderItems,
  addItem: mockAddItem,
  renameFolder: vi.fn(),
  moveFolder: vi.fn(),
  navigateUp: vi.fn(),
  initialize: vi.fn()
}

const bibleSingleton = {
  navigateTo: mockNavigateTo
}

vi.mock('@renderer/stores/folder', () => ({
  useBibleFolderStore: Object.assign(
    (selector?: (state: typeof folderSingleton) => unknown) =>
      typeof selector === 'function' ? selector(folderSingleton) : folderSingleton,
    {
      getState: () => folderSingleton
    }
  )
}))

vi.mock('@renderer/stores/bible', () => ({
  useBibleStore: Object.assign(vi.fn(), {
    getState: () => bibleSingleton
  })
}))

vi.mock('@renderer/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn()
}))

vi.mock('@renderer/config/shortcuts', () => ({
  SHORTCUTS: {
    EDIT: {
      SELECT_ALL: { code: 'KeyA', metaOrCtrl: true },
      COPY: { code: 'KeyC', metaOrCtrl: true },
      CUT: { code: 'KeyX', metaOrCtrl: true },
      PASTE: { code: 'KeyV', metaOrCtrl: true },
      DELETE: { code: 'Backspace' },
      DELETE_ALT: { code: 'Delete' }
    }
  }
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({
    isProjectionOpen: false,
    isProjectionBlanked: false,
    projectionReadyCount: 0,
    activeOwner: 'timer',
    claimProjection: vi.fn(),
    releaseOwnership: vi.fn(),
    project: vi.fn(),
    openProjection: vi.fn(),
    closeProjection: vi.fn(),
    blankProjection: vi.fn(),
    send: vi.fn(),
    on: vi.fn()
  })
}))

vi.mock('@renderer/contexts/ContextMenuContext', () => ({
  useContextMenu: () => ({
    contextMenu: null,
    showContextMenu: vi.fn()
  })
}))

const mockConfirm = vi.fn(() => Promise.resolve(true))
vi.mock('@renderer/contexts/ConfirmDialogContext', () => ({
  useConfirm: () => mockConfirm
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts: string | { defaultValue?: string } = {}) => {
      const bookMap: Record<string, string> = {
        'bible.books.gen.name': '創世記',
        'bible.books.joh.name': '約翰福音'
      }
      if (bookMap[key]) return bookMap[key]
      if (typeof opts === 'string') return opts
      return opts.defaultValue ?? key
    }
  })
}))

vi.mock('@heroui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@heroui/react')>()
  return {
    ...actual,
    ScrollShadow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Modal: Object.assign(
      ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
        isOpen ? <div role="dialog">{children}</div> : null,
      {
        Backdrop: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Header: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Heading: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
        Body: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
        Footer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
      }
    ),
    Breadcrumbs: Object.assign(
      ({ children }: { children: React.ReactNode }) => (
        <nav aria-label="breadcrumbs">{children}</nav>
      ),
      {
        Item: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
          <button type="button" onClick={onPress}>
            {children}
          </button>
        )
      }
    ),
    TextField: ({
      children,
      onChange
    }: {
      children: React.ReactNode
      value?: string
      onChange: (v: string) => void
    }) => <div onChange={(e) => onChange((e.target as HTMLInputElement).value)}>{children}</div>,
    Input: () => <input id="folder-name-input" aria-label="Folder Name" />,
    Label: ({ children }: { children: React.ReactNode }) => (
      <label htmlFor="folder-name-input">{children}</label>
    )
  }
})

describe('CustomFolderTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    folderSingleton.currentFolderId = 'bible-root'
    folderSingleton.getCurrentFolder = () => mockRoot
    folderSingleton.root = mockRoot
    bibleSingleton.navigateTo = mockNavigateTo
    folderSingleton.addFolder = mockAddFolder
    folderSingleton.deleteFolder = mockDeleteFolder
    folderSingleton.removeItem = mockRemoveItem
    folderSingleton.navigateToFolder = mockNavigateToFolder
    folderSingleton.navigateToRoot = mockNavigateToRoot
  })

  it('renders folders in root', () => {
    render(<CustomFolderTab />)
    expect(screen.getByText('Sunday Worship')).toBeInTheDocument()
  })

  it('renders verse items in root', () => {
    render(<CustomFolderTab />)
    expect(screen.getByText('創世記 1:1')).toBeInTheDocument()
  })

  it('opens create folder modal when isModalOpen is true', () => {
    render(
      <ShortcutScopeProvider>
        <CustomFolderTab isModalOpen={true} onModalOpenChange={vi.fn()} />
      </ShortcutScopeProvider>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Create New Folder')).toBeInTheDocument()
  })

  it('clicking folder navigates into it', () => {
    render(<CustomFolderTab />)
    const folderButton = screen.getByText('Sunday Worship').closest('[role="option"]')!
    fireEvent.doubleClick(folderButton)
    expect(mockNavigateToFolder).toHaveBeenCalledWith('folder-a')
  })

  it('clicking verse item navigates to bible passage', () => {
    render(<CustomFolderTab />)
    const verseButton = screen.getByText('創世記 1:1').closest('[role="option"]')!
    fireEvent.doubleClick(verseButton)
    expect(mockNavigateTo).toHaveBeenCalledWith({ bookNumber: 1, chapter: 1, verse: 1 })
  })

  it('create folder modal calls onModalOpenChange(false) on cancel', () => {
    const onModalOpenChange = vi.fn()
    render(
      <ShortcutScopeProvider>
        <CustomFolderTab isModalOpen={true} onModalOpenChange={onModalOpenChange} />
      </ShortcutScopeProvider>
    )
    fireEvent.click(screen.getByText('Cancel'))
    expect(onModalOpenChange).toHaveBeenCalledWith(false)
  })

  it('delete folder button triggers confirm and calls deleteFolder', async () => {
    mockConfirm.mockResolvedValue(true)
    render(<CustomFolderTab />)
    const deleteBtn = screen.getByRole('button', { name: 'Delete Sunday Worship' })
    fireEvent.click(deleteBtn)
    await vi.waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled()
    })
    await vi.waitFor(() => {
      expect(mockDeleteFolder).toHaveBeenCalledWith('folder-a')
    })
  })

  it('delete item button triggers confirm and calls removeItem', async () => {
    mockConfirm.mockResolvedValue(true)
    render(<CustomFolderTab />)
    const deleteBtn = screen.getByRole('button', { name: 'Delete 創世記 1:1' })
    fireEvent.click(deleteBtn)
    await vi.waitFor(() => {
      expect(mockRemoveItem).toHaveBeenCalledWith('verse-1')
    })
  })

  it('cancel confirm does not delete folder', async () => {
    mockConfirm.mockResolvedValue(false)
    render(<CustomFolderTab />)
    const deleteBtn = screen.getByRole('button', { name: 'Delete Sunday Worship' })
    fireEvent.click(deleteBtn)
    await vi.waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled()
    })
    expect(mockDeleteFolder).not.toHaveBeenCalled()
  })

  it('shows empty state when folder has no items', () => {
    const emptyRoot: Folder<VerseItem> = { ...mockRoot, items: [], folders: [] }
    folderSingleton.getCurrentFolder = () => emptyRoot
    render(<CustomFolderTab />)
    expect(screen.getByText('Folder is empty')).toBeInTheDocument()
  })
})
