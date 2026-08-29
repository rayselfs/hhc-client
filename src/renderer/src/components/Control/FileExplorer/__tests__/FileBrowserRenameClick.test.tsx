import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import FileBrowser from '../FileBrowser'
import type { FileItemRecord, FolderRecord } from '@shared/types/folder'

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn()
  },
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key
  })
}))

vi.mock('@heroui/react/toast', () => ({
  toast: { danger: vi.fn(), warning: vi.fn() }
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 120,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        key: index,
        index,
        size: 120,
        start: index * 120
      }))
  })
}))

vi.mock('@dnd-kit/core', async () => {
  return {
    DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    MouseSensor: vi.fn(),
    TouchSensor: vi.fn(),
    closestCenter: vi.fn(),
    pointerWithin: vi.fn(() => []),
    useDroppable: () => ({
      setNodeRef: vi.fn(),
      isOver: false
    }),
    useSensor: vi.fn(),
    useSensors: vi.fn()
  }
})

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  arrayMove: vi.fn(),
  useSortable: () => ({
    setNodeRef: vi.fn(),
    attributes: {},
    listeners: {},
    transform: null,
    transition: undefined,
    isDragging: false
  })
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } }
}))

vi.mock('@renderer/hooks/useOsFileDrop', () => ({
  useOsFileDrop: () => ({
    isOsDragOver: false,
    osDragTargetFolderId: null,
    handlers: {
      onDragEnter: vi.fn(),
      onDragOver: vi.fn(),
      onDragLeave: vi.fn(),
      onDrop: vi.fn()
    }
  })
}))

vi.mock('@renderer/hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn()
}))

vi.mock('@renderer/hooks/useThumbnails', () => ({
  canHaveThumbnail: () => false,
  useThumbnails: () => ({})
}))

vi.mock('@renderer/contexts/ConfirmDialogContext', () => ({
  useConfirm: () => vi.fn()
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({ ensureProjectionOpen: vi.fn(() => Promise.resolve()) })
}))

const mockStartPresentation = vi.fn()
const mockStartPresentationWithReadiness = vi.fn().mockResolvedValue({
  summary: { ready: 1, preparing: 0, unsupported: 0, missing: 0, failed: 0 },
  items: [
    {
      itemId: 'file-1',
      blobId: 'file-1',
      status: 'ready',
      reason: 'ready',
      support: 'native'
    }
  ]
})

vi.mock('@renderer/stores/media-projection', () => ({
  useMediaProjectionStore: Object.assign(
    vi.fn(() => false),
    {
      getState: () => ({
        startPresentation: mockStartPresentation,
        startPresentationWithReadiness: mockStartPresentationWithReadiness
      })
    }
  )
}))

let viewMode = 'medium-icon'
const updateItem = vi.fn()
const updateFolder = vi.fn()

const fileItem: FileItemRecord = {
  id: 'file-1',
  parentId: 'file-root',
  type: 'file',
  name: 'slides.pdf',
  url: 'blob:file-1',
  mimeType: 'application/pdf',
  size: 100,
  sortIndex: 0,
  createdAt: 1,
  expiresAt: null
}

const folderItem: FolderRecord = {
  id: 'folder-1',
  parentId: 'file-root',
  name: 'Drama Audio',
  sortIndex: 0,
  createdAt: 1,
  expiresAt: null
}

vi.mock('@renderer/stores/file-explorer', () => {
  const store = (selector?: (state: Record<string, unknown>) => unknown): unknown => {
    const state = {
      currentFolderId: 'file-root',
      _childFoldersByParent: { 'file-root': [folderItem] },
      _itemsByParent: { 'file-root': [fileItem] },
      navigateToFolder: vi.fn(),
      toggleFavorite: vi.fn(),
      moveItem: vi.fn(),
      moveFolder: vi.fn(),
      updateItem,
      updateFolder
    }
    return selector ? selector(state) : state
  }
  store.getState = () => ({
    updateItem,
    updateFolder,
    getItems: () => [fileItem]
  })
  return {
    FILE_EXPLORER_ROOT_ID: 'file-root',
    deleteFolderFromStore: vi.fn(),
    removeFileItemFromStore: vi.fn(),
    useFileExplorerCustomOrder: (selector: (state: Record<string, unknown>) => unknown) =>
      selector({ orders: {}, setOrder: vi.fn() }),
    useFileExplorerSearch: (selector: (state: Record<string, unknown>) => unknown) =>
      selector({ searchQuery: '', setSearchQuery: vi.fn() }),
    useFileExplorerSettings: (selector: (state: Record<string, unknown>) => unknown) =>
      selector({
        viewMode,
        sortField: 'createdAt',
        sortDir: 'none',
        setSortDir: vi.fn(),
        setSortFieldAndDir: vi.fn(),
        colWidths: { created: 112, size: 80, kind: 96 },
        setColWidths: vi.fn()
      }),
    useFileExplorerStore: store
  }
})

function click(target: Element, now: number): void {
  vi.setSystemTime(now)
  fireEvent.pointerDown(target, { button: 0, clientX: 1, clientY: 1 })
  fireEvent.click(target, { button: 0, detail: 1 })
}

function flushRenameDelay(): void {
  act(() => {
    vi.advanceTimersByTime(320)
  })
}

function renderFileBrowser(): void {
  function LocationProbe(): React.JSX.Element {
    const location = useLocation()
    return <output data-testid="location">{location.pathname}</output>
  }

  render(
    <MemoryRouter>
      <FileBrowser />
      <LocationProbe />
    </MemoryRouter>
  )
}

describe('FileBrowser slow-click inline rename', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    updateItem.mockClear()
    updateFolder.mockClear()
    mockStartPresentation.mockClear()
    mockStartPresentationWithReadiness.mockClear()
    viewMode = 'medium-icon'
  })

  it('only starts rename from the file name region', () => {
    renderFileBrowser()

    const fileName = screen.getByText('slides.pdf')
    const item = fileName.closest('[data-file-item]')
    expect(item).not.toBeNull()

    click(item!, 1000)
    click(item!, 2000)

    expect(screen.queryByLabelText('Rename file')).toBeNull()

    click(fileName, 2500)
    flushRenameDelay()

    expect(screen.getByLabelText('Rename file')).toHaveValue('slides')
  })

  it('starts rename from a selected folder name region', () => {
    renderFileBrowser()

    const folderName = screen.getByText('Drama Audio')
    click(folderName, 1000)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    click(folderName, 6000)
    flushRenameDelay()

    expect(screen.getByLabelText('Rename folder')).toHaveValue('Drama Audio')
  })

  it('allows rename after the item has been selected for longer than the minimum delay', () => {
    renderFileBrowser()

    const fileName = screen.getByText('slides.pdf')
    click(fileName, 1000)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    click(fileName, 6000)
    flushRenameDelay()

    expect(screen.getByLabelText('Rename file')).toHaveValue('slides')
  })

  it('projects instead of renaming when the selected file name is double-clicked', () => {
    renderFileBrowser()

    const fileName = screen.getByText('slides.pdf')
    click(fileName, 1000)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    vi.setSystemTime(2200)
    fireEvent.pointerDown(fileName, { button: 0, clientX: 1, clientY: 1 })
    fireEvent.click(fileName, { button: 0, detail: 1 })
    fireEvent.click(fileName, { button: 0, detail: 2 })
    fireEvent.doubleClick(fileName, { button: 0, detail: 2 })
    flushRenameDelay()

    expect(screen.queryByLabelText('Rename file')).toBeNull()
    expect(mockStartPresentationWithReadiness).toHaveBeenCalledOnce()
  })

  it('does not start rename after pointer movement', () => {
    renderFileBrowser()

    const fileName = screen.getByText('slides.pdf')
    click(fileName, 1000)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    vi.setSystemTime(2500)
    fireEvent.pointerDown(fileName, { button: 0, clientX: 1, clientY: 1 })
    fireEvent.pointerMove(fileName, { button: 0, clientX: 12, clientY: 1 })
    fireEvent.click(fileName, { button: 0, detail: 1 })
    flushRenameDelay()

    expect(screen.queryByLabelText('Rename file')).toBeNull()
  })
})
