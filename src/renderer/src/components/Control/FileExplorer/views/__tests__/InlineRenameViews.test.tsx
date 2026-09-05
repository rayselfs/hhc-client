import '@renderer/i18n'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GridView } from '../GridView'
import { ListView } from '../ListView'
import type { GridViewItem } from '../GridView'

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

const items: GridViewItem[] = [
  {
    id: 'file-1',
    name: 'slides.pdf',
    isFolder: false,
    mimeType: 'application/pdf',
    size: 100,
    createdAt: 1,
    isSelected: true
  }
]

describe('inline rename in file views', () => {
  it('shows the complete local creation timestamp', () => {
    render(
      <ListView
        items={[{ ...items[0], createdAt: new Date(2026, 8, 4, 22, 3, 5).getTime() }]}
        sortField="name"
        sortDir="asc"
        onSortChange={vi.fn()}
        colWidths={{ created: 160, size: 80, kind: 120 }}
        onColWidthChange={vi.fn()}
        onItemClick={vi.fn()}
        onItemDoubleClick={vi.fn()}
        onItemContextMenu={vi.fn()}
      />
    )

    expect(screen.getByText('2026/09/04 22:03:05')).toBeInTheDocument()
  })

  it('renders and submits inline rename in grid view', () => {
    const onRenameSubmit = vi.fn()
    render(
      <GridView
        items={items}
        viewMode="large-icon"
        onItemClick={vi.fn()}
        onItemDoubleClick={vi.fn()}
        onItemContextMenu={vi.fn()}
        renamingItemId="file-1"
        onRenameSubmit={onRenameSubmit}
      />
    )

    const input = screen.getByLabelText('Rename file')
    expect(input).toHaveValue('slides')
    fireEvent.change(input, { target: { value: 'sermon' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onRenameSubmit).toHaveBeenCalledWith('file-1', 'sermon')
  })

  it('renders and submits inline rename in list view', () => {
    const onRenameSubmit = vi.fn()
    render(
      <ListView
        items={items}
        sortField="name"
        sortDir="asc"
        onSortChange={vi.fn()}
        colWidths={{ created: 100, size: 80, kind: 120 }}
        onColWidthChange={vi.fn()}
        onItemClick={vi.fn()}
        onItemDoubleClick={vi.fn()}
        onItemContextMenu={vi.fn()}
        renamingItemId="file-1"
        onRenameSubmit={onRenameSubmit}
      />
    )

    const input = screen.getByLabelText('Rename file')
    expect(input).toHaveValue('slides')
    fireEvent.change(input, { target: { value: 'sermon' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onRenameSubmit).toHaveBeenCalledWith('file-1', 'sermon')
  })

  it('renders sync status in grid view', () => {
    render(
      <GridView
        items={[{ ...items[0], syncStatus: 'remote-only' }]}
        viewMode="large-icon"
        onItemClick={vi.fn()}
        onItemDoubleClick={vi.fn()}
        onItemContextMenu={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Remote only')).toBeInTheDocument()
  })

  it('renders download progress in grid view', () => {
    render(
      <GridView
        items={[
          {
            ...items[0],
            syncStatus: 'downloading',
            downloadedBytes: 50,
            downloadTotalBytes: 100
          }
        ]}
        viewMode="large-icon"
        onItemClick={vi.fn()}
        onItemDoubleClick={vi.fn()}
        onItemContextMenu={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Downloading 50%')).toBeInTheDocument()
  })

  it('renders folder sync health in grid view', () => {
    render(
      <GridView
        items={[
          {
            id: 'folder-1',
            name: 'OneDrive',
            isFolder: true,
            isSelected: false,
            syncProviderType: 'onedrive',
            syncFolderHealth: 'syncing',
            syncFolderHealthTooltip: 'Downloading: 1'
          }
        ]}
        viewMode="large-icon"
        onItemClick={vi.fn()}
        onItemDoubleClick={vi.fn()}
        onItemContextMenu={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Syncing')).toBeInTheDocument()
  })

  it('renders grid items in a single responsive grid', () => {
    const manyItems = Array.from({ length: 8 }, (_, index) => ({
      ...items[0],
      id: `file-${index}`,
      name: `file-${index}.pdf`
    }))
    const { container } = render(
      <GridView
        items={manyItems}
        viewMode="medium-icon"
        onItemClick={vi.fn()}
        onItemDoubleClick={vi.fn()}
        onItemContextMenu={vi.fn()}
      />
    )

    const grid = container.querySelector('.grid')
    expect(grid?.children).toHaveLength(8)
    expect(container.querySelector('[style*="position: absolute"]')).not.toBeInTheDocument()
  })

  it('renders sync status in list view', () => {
    render(
      <ListView
        items={[{ ...items[0], syncStatus: 'available-offline' }]}
        sortField="name"
        sortDir="asc"
        onSortChange={vi.fn()}
        colWidths={{ created: 100, size: 80, kind: 120 }}
        onColWidthChange={vi.fn()}
        onItemClick={vi.fn()}
        onItemDoubleClick={vi.fn()}
        onItemContextMenu={vi.fn()}
      />
    )

    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('renders provider and folder health in list view', () => {
    render(
      <ListView
        items={[
          {
            id: 'line-root',
            name: 'LINE group',
            isFolder: true,
            isSelected: false,
            syncProviderType: 'hhc-line',
            syncFolderHealth: 'syncing',
            syncFolderHealthTooltip: 'Downloading: 1'
          }
        ]}
        sortField="name"
        sortDir="asc"
        onSortChange={vi.fn()}
        colWidths={{ created: 100, size: 80, kind: 120 }}
        onColWidthChange={vi.fn()}
        onItemClick={vi.fn()}
        onItemDoubleClick={vi.fn()}
        onItemContextMenu={vi.fn()}
      />
    )

    expect(screen.getByLabelText('LINE')).toBeInTheDocument()
    expect(screen.getByLabelText('Syncing')).toBeInTheDocument()
  })

  it('renders ordinary media processing with the shared status view', () => {
    render(
      <GridView
        items={[{ ...items[0], processingStatus: 'running', processingProgress: 25 }]}
        viewMode="large-icon"
        onItemClick={vi.fn()}
        onItemDoubleClick={vi.fn()}
        onItemContextMenu={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Processing 25%')).toBeInTheDocument()
  })
})
