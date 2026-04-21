import { renderHook, render, screen, act } from '@testing-library/react'
import { useState } from 'react'
import {
  ShortcutScopeProvider,
  ShortcutScope,
  useShortcutScope
} from '@renderer/contexts/ShortcutScopeContext'

function wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
  return <ShortcutScopeProvider>{children}</ShortcutScopeProvider>
}

describe('ShortcutScopeContext', () => {
  it('useShortcutScope throws outside ShortcutScopeProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderHook(() => useShortcutScope())).toThrow(
      'useShortcutScope must be used within a ShortcutScopeProvider'
    )
    spy.mockRestore()
  })

  it('returns page scope by default', () => {
    const { result } = renderHook(() => useShortcutScope(), { wrapper })
    expect(result.current).toEqual({ activeScope: 'page', isOverlayActive: false })
  })

  it('returns overlay scope when ShortcutScope is mounted', () => {
    const { result } = renderHook(() => useShortcutScope(), {
      wrapper: ({ children }) => (
        <ShortcutScopeProvider>
          <ShortcutScope name="overlay">{children}</ShortcutScope>
        </ShortcutScopeProvider>
      )
    })
    expect(result.current).toEqual({ activeScope: 'overlay', isOverlayActive: true })
  })

  it('returns to page scope when ShortcutScope unmounts', () => {
    function TestComponent(): React.ReactElement {
      const [show, setShow] = useState(true)
      const scope = useShortcutScope()
      return (
        <div>
          {show && (
            <ShortcutScope name="overlay">
              <span />
            </ShortcutScope>
          )}
          <button type="button" onClick={() => setShow(false)}>
            unmount
          </button>
          <span data-testid="scope">{scope.activeScope}</span>
          <span data-testid="overlay">{String(scope.isOverlayActive)}</span>
        </div>
      )
    }
    render(
      <ShortcutScopeProvider>
        <TestComponent />
      </ShortcutScopeProvider>
    )
    expect(screen.getByTestId('scope').textContent).toBe('overlay')
    expect(screen.getByTestId('overlay').textContent).toBe('true')
    act(() => screen.getByRole('button').click())
    expect(screen.getByTestId('scope').textContent).toBe('page')
    expect(screen.getByTestId('overlay').textContent).toBe('false')
  })

  it('stacks scopes — innermost wins', () => {
    function TestComponent(): React.ReactElement {
      const [showInner, setShowInner] = useState(true)
      const [showOuter, setShowOuter] = useState(true)
      const scope = useShortcutScope()
      return (
        <div>
          {showOuter && (
            <ShortcutScope name="overlay">
              {showInner && (
                <ShortcutScope name="overlay">
                  <span />
                </ShortcutScope>
              )}
            </ShortcutScope>
          )}
          <button type="button" data-testid="unmount-inner" onClick={() => setShowInner(false)}>
            inner
          </button>
          <button type="button" data-testid="unmount-outer" onClick={() => setShowOuter(false)}>
            outer
          </button>
          <span data-testid="overlay">{String(scope.isOverlayActive)}</span>
        </div>
      )
    }
    render(
      <ShortcutScopeProvider>
        <TestComponent />
      </ShortcutScopeProvider>
    )
    expect(screen.getByTestId('overlay').textContent).toBe('true')
    act(() => screen.getByTestId('unmount-inner').click())
    expect(screen.getByTestId('overlay').textContent).toBe('true')
    act(() => screen.getByTestId('unmount-outer').click())
    expect(screen.getByTestId('overlay').textContent).toBe('false')
  })

  it('renders children correctly', () => {
    render(
      <ShortcutScopeProvider>
        <ShortcutScope name="overlay">
          <div data-testid="child">hi</div>
        </ShortcutScope>
      </ShortcutScopeProvider>
    )
    expect(screen.getByTestId('child')).toBeVisible()
  })
})
