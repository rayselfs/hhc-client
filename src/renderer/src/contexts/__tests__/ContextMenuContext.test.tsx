import { renderHook, render, screen, act, fireEvent } from '@testing-library/react'
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
})
