import { render, renderHook, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createFolderContextMenu } from '../createFolderContextMenu'

const showMenu = vi.hoisted(() => vi.fn())

vi.mock('@renderer/contexts/ContextMenuContext', () => ({
  useContextMenu: () => ({ showMenu })
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

describe('createFolderContextMenu HHC LINE action', () => {
  it('adds the authorized HHC LINE collection callback without affecting other sources', () => {
    const onAddHhcLine = vi.fn()
    const { result } = renderHook(() => createFolderContextMenu()())

    result.current.showEmptyAreaMenu({
      event: {} as React.MouseEvent,
      clipboard: null,
      onPaste: vi.fn(),
      onNewFolder: vi.fn(),
      onAddHhcLine
    })

    const entries = showMenu.mock.calls[0][0]
    const action = entries.find((entry: { id?: string }) => entry?.id === 'add-hhc-line')
    expect(action.label).toBe('folder.contextMenu.addHhcLine')
    expect(action).not.toHaveProperty('iconSlotClassName')
    render(action.icon)
    expect(screen.getByRole('img', { name: 'LINE' })).toHaveClass('size-4')
    expect(document.querySelector('svg.lucide-cloud')).not.toBeInTheDocument()
    action.onAction()
    expect(onAddHhcLine).toHaveBeenCalledTimes(1)
  })

  it('keeps the plain HHC LINE action label while unavailable', () => {
    showMenu.mockClear()
    const { result } = renderHook(() => createFolderContextMenu()())

    result.current.showEmptyAreaMenu({
      event: {} as React.MouseEvent,
      clipboard: null,
      onPaste: vi.fn(),
      onNewFolder: vi.fn(),
      onAddHhcLine: vi.fn(),
      isAddHhcLineDisabled: true
    })

    const entries = showMenu.mock.calls[0][0]
    const action = entries.find((entry: { id?: string }) => entry?.id === 'add-hhc-line')
    expect(action).toMatchObject({
      label: 'folder.contextMenu.addHhcLine',
      disabled: true
    })
  })
})
