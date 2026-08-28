import { renderHook, render, screen, act, fireEvent, createEvent } from '@testing-library/react'
import { FolderSync } from 'lucide-react'
import { SyncProviderIcon } from '@renderer/components/icons/SyncProviderIcon'
import { ContextMenuProvider, useContextMenu, type ContextMenuEntry } from '../ContextMenuContext'

function renderWithProvider(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<ContextMenuProvider>{ui}</ContextMenuProvider>)
}

function renderContextMenuHook(): ReturnType<
  typeof renderHook<ReturnType<typeof useContextMenu>, unknown>
> {
  return renderHook(() => useContextMenu(), { wrapper: ContextMenuProvider })
}

describe('ContextMenuContext', () => {
  it('useContextMenu throws outside ContextMenuProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderHook(() => useContextMenu())).toThrow(
      'useContextMenu must be used within a ContextMenuProvider'
    )
    spy.mockRestore()
  })

  it('does not render menu initially', () => {
    renderWithProvider(<div>content</div>)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it.each([[[] as ContextMenuEntry[]], [['separator'] as ContextMenuEntry[]]])(
    'prevents the browser menu but does not render an empty menu for %j',
    (items) => {
      function TestComponent(): React.JSX.Element {
        const { showMenu } = useContextMenu()
        return (
          <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
            target
          </div>
        )
      }

      renderWithProvider(<TestComponent />)
      const target = screen.getByTestId('target')
      const event = createEvent.contextMenu(target)

      fireEvent(target, event)

      expect(event.defaultPrevented).toBe(true)
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    }
  )

  it.each([[[] as ContextMenuEntry[]], [['separator'] as ContextMenuEntry[]]])(
    'closes an open menu and restores its trigger focus for %j',
    (emptyItems) => {
      const items: ContextMenuEntry[] = [{ id: 'action', label: 'Action', onAction: vi.fn() }]

      function TestComponent(): React.JSX.Element {
        const { showMenu } = useContextMenu()
        return (
          <>
            <button type="button" data-testid="trigger" onContextMenu={(e) => showMenu(items, e)}>
              target
            </button>
            <div data-testid="empty-target" onContextMenu={(e) => showMenu(emptyItems, e)}>
              empty target
            </div>
          </>
        )
      }

      renderWithProvider(<TestComponent />)
      const trigger = screen.getByTestId('trigger')
      trigger.focus()
      fireEvent.contextMenu(trigger)
      expect(screen.getByRole('menu')).toBeInTheDocument()
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Action' }))

      fireEvent.contextMenu(screen.getByTestId('empty-target'))

      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      expect(document.activeElement).toBe(trigger)
    }
  )

  it('shows menu on showMenu call', () => {
    const items: ContextMenuEntry[] = [{ id: 'copy', label: 'Copy', onAction: vi.fn() }]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          right-click me
        </div>
      )
    }

    renderWithProvider(<TestComponent />)

    fireEvent.contextMenu(screen.getByTestId('target'), {
      clientX: 100,
      clientY: 200
    })

    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Copy' })).toBeInTheDocument()
  })

  it('uses the same icon slot for LINE and normal menu items', () => {
    const items: ContextMenuEntry[] = [
      {
        id: 'line',
        label: 'Sync LINE group',
        icon: <SyncProviderIcon providerType="hhc-line" className="size-4" />,
        onAction: vi.fn()
      },
      {
        id: 'local',
        label: 'Sync local folder',
        icon: <FolderSync />,
        onAction: vi.fn()
      }
    ]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)
    fireEvent.contextMenu(screen.getByTestId('target'))

    const lineItem = screen.getByRole('menuitem', { name: 'Sync LINE group' })
    const lineIcon = lineItem.querySelector('[aria-label="LINE"]')
    const lineSlot = lineIcon?.parentElement
    expect(lineItem).toBeInTheDocument()
    expect(lineIcon).toHaveClass('size-4')
    expect(lineSlot).toHaveClass('h-4', 'w-4')
    expect(lineSlot).toHaveAttribute('aria-hidden', 'true')
    expect(
      screen.getByRole('menuitem', { name: 'Sync local folder' }).querySelector(':scope > span')
    ).toHaveClass('h-4', 'w-4')
  })

  it('calls onAction and closes menu on item click', () => {
    const onAction = vi.fn()
    const items: ContextMenuEntry[] = [{ id: 'paste', label: 'Paste', onAction }]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)

    fireEvent.contextMenu(screen.getByTestId('target'), {
      clientX: 50,
      clientY: 50
    })

    fireEvent.click(screen.getByRole('menuitem', { name: 'Paste' }))
    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes menu on Escape key', () => {
    const items: ContextMenuEntry[] = [{ id: 'action', label: 'Action', onAction: vi.fn() }]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)

    fireEvent.contextMenu(screen.getByTestId('target'), {
      clientX: 50,
      clientY: 50
    })

    expect(screen.getByRole('menu')).toBeInTheDocument()

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes menu on click outside', () => {
    const items: ContextMenuEntry[] = [{ id: 'action', label: 'Action', onAction: vi.fn() }]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div>
          <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
            target
          </div>
          <div data-testid="outside">outside</div>
        </div>
      )
    }

    renderWithProvider(<TestComponent />)

    fireEvent.contextMenu(screen.getByTestId('target'), {
      clientX: 50,
      clientY: 50
    })

    expect(screen.getByRole('menu')).toBeInTheDocument()

    act(() => {
      fireEvent.mouseDown(screen.getByTestId('outside'))
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders separator between items', () => {
    const items: ContextMenuEntry[] = [
      { id: 'a', label: 'A', onAction: vi.fn() },
      'separator',
      { id: 'b', label: 'B', onAction: vi.fn() }
    ]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)

    fireEvent.contextMenu(screen.getByTestId('target'), {
      clientX: 50,
      clientY: 50
    })

    expect(screen.getByRole('separator')).toBeInTheDocument()
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
  })

  it('renders danger variant with correct styling', () => {
    const items: ContextMenuEntry[] = [
      { id: 'delete', label: 'Delete', variant: 'danger', onAction: vi.fn() }
    ]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)

    fireEvent.contextMenu(screen.getByTestId('target'), {
      clientX: 50,
      clientY: 50
    })

    const item = screen.getByRole('menuitem', { name: 'Delete' })
    expect(item.className).toContain('text-danger')
  })

  it('suppresses browser default contextmenu', () => {
    renderWithProvider(<div data-testid="area">content</div>)

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true
    })
    const prevented = !document.dispatchEvent(event)
    expect(prevented).toBe(true)
  })

  it('returns showMenu from useContextMenu hook', () => {
    const { result } = renderContextMenuHook()
    expect(typeof result.current.showMenu).toBe('function')
  })

  it('first menuitem receives focus on menu open', () => {
    const items: ContextMenuEntry[] = [
      { id: 'a', label: 'Alpha', onAction: vi.fn() },
      { id: 'b', label: 'Beta', onAction: vi.fn() }
    ]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)
    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 50, clientY: 50 })

    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Alpha' }))
  })

  it('ArrowDown moves focus to next menuitem', () => {
    const items: ContextMenuEntry[] = [
      { id: 'a', label: 'Alpha', onAction: vi.fn() },
      { id: 'b', label: 'Beta', onAction: vi.fn() }
    ]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)
    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 50, clientY: 50 })

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })

    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Beta' }))
  })

  it('ArrowUp moves focus to previous menuitem and wraps', () => {
    const items: ContextMenuEntry[] = [
      { id: 'a', label: 'Alpha', onAction: vi.fn() },
      { id: 'b', label: 'Beta', onAction: vi.fn() }
    ]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)
    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 50, clientY: 50 })

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })

    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Beta' }))
  })

  it('Home/End jumps to first/last menuitem', () => {
    const items: ContextMenuEntry[] = [
      { id: 'a', label: 'Alpha', onAction: vi.fn() },
      { id: 'b', label: 'Beta', onAction: vi.fn() },
      { id: 'c', label: 'Gamma', onAction: vi.fn() }
    ]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)
    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 50, clientY: 50 })

    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'End' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Gamma' }))

    fireEvent.keyDown(menu, { key: 'Home' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Alpha' }))
  })

  it('Enter activates focused item and closes menu', () => {
    const onAction = vi.fn()
    const items: ContextMenuEntry[] = [{ id: 'a', label: 'Alpha', onAction }]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)
    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 50, clientY: 50 })

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Enter' })

    expect(onAction).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('Tab closes menu', () => {
    const items: ContextMenuEntry[] = [{ id: 'a', label: 'Alpha', onAction: vi.fn() }]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)
    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 50, clientY: 50 })

    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('focus returns to trigger element on close', () => {
    const items: ContextMenuEntry[] = [{ id: 'a', label: 'Alpha', onAction: vi.fn() }]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <button type="button" data-testid="trigger" onContextMenu={(e) => showMenu(items, e)}>
          trigger
        </button>
      )
    }

    renderWithProvider(<TestComponent />)
    const trigger = screen.getByTestId('trigger')
    const focus = vi.spyOn(trigger, 'focus')
    trigger.focus()

    fireEvent.contextMenu(trigger, { clientX: 50, clientY: 50 })
    expect(screen.getByRole('menu')).toBeInTheDocument()
    focus.mockClear()

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' })
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('closes menu on window resize', () => {
    const items: ContextMenuEntry[] = [{ id: 'a', label: 'Alpha', onAction: vi.fn() }]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)
    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 50, clientY: 50 })
    expect(screen.getByRole('menu')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('closes menu on window blur', () => {
    const items: ContextMenuEntry[] = [{ id: 'a', label: 'Alpha', onAction: vi.fn() }]

    function TestComponent(): React.JSX.Element {
      const { showMenu } = useContextMenu()
      return (
        <div data-testid="target" onContextMenu={(e) => showMenu(items, e)}>
          target
        </div>
      )
    }

    renderWithProvider(<TestComponent />)
    fireEvent.contextMenu(screen.getByTestId('target'), { clientX: 50, clientY: 50 })
    expect(screen.getByRole('menu')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
