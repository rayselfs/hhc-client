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
})
