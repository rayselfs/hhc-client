import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FileBrowser from '../FileBrowser'
import type { FileItemRecord } from '@shared/types/folder'

vi.mock('react-i18next', () => ({
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

vi.mock('@renderer/stores/media-projection', () => ({
  useMediaProjectionStore: Object.assign(
    vi.fn(() => false),
    {
      getState: () => ({ startPresentation: vi.fn() })
    }
  )
}))

let viewMode = 'medium-icon'
const updateItem = vi.fn()

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

vi.mock('@renderer/stores/file-explorer', () => {
  const store = (selector?: (state: Record<string, unknown>) => unknown): unknown => {
    const state = {
      currentFolderId: 'file-root',
      _childFoldersByParent: { 'file-root': [] },
      _itemsByParent: { 'file-root': [fileItem] },
      navigateToFolder: vi.fn(),
      toggleFavorite: vi.fn(),
      moveItem: vi.fn(),
      moveFolder: vi.fn(),
      updateItem
    }
    return selector ? selector(state) : state
  }
  store.getState = () => ({
    updateItem,
    getItems: () => [fileItem]
  })
  return {
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

describe('FileBrowser slow-click inline rename', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    updateItem.mockClear()
    viewMode = 'medium-icon'
  })

  it('only starts rename from the file name region', () => {
    render(<FileBrowser />)

    const fileName = screen.getByText('slides.pdf')
    const item = fileName.closest('[data-file-item]')
    expect(item).not.toBeNull()

    click(item!, 1000)
    click(item!, 2000)

    expect(screen.queryByLabelText('Rename file')).toBeNull()

    click(fileName, 2500)

    expect(screen.getByLabelText('Rename file')).toHaveValue('slides')
  })

  it('allows rename after the item has been selected for longer than the minimum delay', () => {
    render(<FileBrowser />)

    const fileName = screen.getByText('slides.pdf')
    click(fileName, 1000)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    click(fileName, 6000)

    expect(screen.getByLabelText('Rename file')).toHaveValue('slides')
  })
})
