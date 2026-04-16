import { renderHook, act, fireEvent, screen } from '@testing-library/react'
import { vi } from 'vitest'
import React, { useState } from 'react'
import {
  useKeyboardShortcuts,
  type ShortcutHandler,
  type ShortcutConfig
} from '../useKeyboardShortcuts'
import { ShortcutScopeProvider, ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'

describe('useKeyboardShortcuts', () => {
  it('ignores keydown when event.isComposing is true', () => {
    const handler = vi.fn()
    const config: ShortcutConfig = { code: 'Space' }
    const shortcuts: ShortcutHandler[] = [{ config, handler }]

    renderHook(() => useKeyboardShortcuts(shortcuts))

    act(() => {
      fireEvent.keyDown(document, { code: 'Space', isComposing: true })
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('ignores keydown when event.keyCode is 229', () => {
    const handler = vi.fn()
    const config: ShortcutConfig = { code: 'Space' }
    const shortcuts: ShortcutHandler[] = [{ config, handler }]

    renderHook(() => useKeyboardShortcuts(shortcuts))

    act(() => {
      fireEvent.keyDown(document, { code: 'Space', keyCode: 229 })
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('fires handler for normal keydown events', () => {
    const handler = vi.fn()
    const config: ShortcutConfig = { code: 'Space' }
    const shortcuts: ShortcutHandler[] = [{ config, handler }]

    renderHook(() => useKeyboardShortcuts(shortcuts))

    act(() => {
      fireEvent.keyDown(document, { code: 'Space' })
    })

    expect(handler).toHaveBeenCalledOnce()
  })

  it('fires handler when isComposing is false', () => {
    const handler = vi.fn()
    const config: ShortcutConfig = { code: 'Space' }
    const shortcuts: ShortcutHandler[] = [{ config, handler }]

    renderHook(() => useKeyboardShortcuts(shortcuts))

    act(() => {
      fireEvent.keyDown(document, { code: 'Space', isComposing: false })
    })

    expect(handler).toHaveBeenCalledOnce()
  })

  it('skips editable targets', () => {
    const handler = vi.fn()
    const config: ShortcutConfig = { code: 'Space' }
    const shortcuts: ShortcutHandler[] = [{ config, handler }]

    renderHook(() => useKeyboardShortcuts(shortcuts))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    act(() => {
      fireEvent.keyDown(input, { code: 'Space' })
    })

    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('respects enabled option', () => {
    const handler = vi.fn()
    const config: ShortcutConfig = { code: 'Space' }
    const shortcuts: ShortcutHandler[] = [{ config, handler }]

    renderHook(() => useKeyboardShortcuts(shortcuts, { enabled: false }))

    act(() => {
      fireEvent.keyDown(document, { code: 'Space' })
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('suppresses shortcuts when overlay scope is active', () => {
    const handler = vi.fn()
    const config: ShortcutConfig = { code: 'Space' }
    const shortcuts: ShortcutHandler[] = [{ config, handler }]

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ShortcutScopeProvider>
        <ShortcutScope name="overlay">{children}</ShortcutScope>
      </ShortcutScopeProvider>
    )

    renderHook(() => useKeyboardShortcuts(shortcuts), { wrapper })

    act(() => {
      fireEvent.keyDown(document, { code: 'Space' })
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('fires shortcuts when no overlay scope is active', () => {
    const handler = vi.fn()
    const config: ShortcutConfig = { code: 'Space' }
    const shortcuts: ShortcutHandler[] = [{ config, handler }]

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ShortcutScopeProvider>{children}</ShortcutScopeProvider>
    )

    renderHook(() => useKeyboardShortcuts(shortcuts), { wrapper })

    act(() => {
      fireEvent.keyDown(document, { code: 'Space' })
    })

    expect(handler).toHaveBeenCalledOnce()
  })

  it('always fires Escape shortcuts regardless of scope', () => {
    const handler = vi.fn()
    const config: ShortcutConfig = { code: 'Escape' }
    const shortcuts: ShortcutHandler[] = [{ config, handler }]

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ShortcutScopeProvider>
        <ShortcutScope name="overlay">{children}</ShortcutScope>
      </ShortcutScopeProvider>
    )

    renderHook(() => useKeyboardShortcuts(shortcuts), { wrapper })

    act(() => {
      fireEvent.keyDown(document, { code: 'Escape' })
    })

    expect(handler).toHaveBeenCalledOnce()
  })

  it('backward compatible — works without ShortcutScopeProvider', () => {
    const handler = vi.fn()
    const config: ShortcutConfig = { code: 'Space' }
    const shortcuts: ShortcutHandler[] = [{ config, handler }]

    renderHook(() => useKeyboardShortcuts(shortcuts))

    act(() => {
      fireEvent.keyDown(document, { code: 'Space' })
    })

    expect(handler).toHaveBeenCalledOnce()
  })

  it('resumes shortcuts after overlay scope unmounts', () => {
    const handler = vi.fn()
    const config: ShortcutConfig = { code: 'Space' }
    const shortcuts: ShortcutHandler[] = [{ config, handler }]

    const ToggleWrapper = ({ children }: { children: React.ReactNode }) => {
      const [overlayActive, setOverlayActive] = useState(true)
      return (
        <ShortcutScopeProvider>
          {overlayActive ? (
            <ShortcutScope name="overlay">
              <button onClick={() => setOverlayActive(false)} data-testid="close-overlay" />
              {children}
            </ShortcutScope>
          ) : (
            <>{children}</>
          )}
        </ShortcutScopeProvider>
      )
    }

    renderHook(() => useKeyboardShortcuts(shortcuts), {
      wrapper: ToggleWrapper
    })

    act(() => {
      fireEvent.keyDown(document, { code: 'Space' })
    })
    expect(handler).not.toHaveBeenCalled()

    act(() => {
      fireEvent.click(screen.getByTestId('close-overlay'))
    })

    act(() => {
      fireEvent.keyDown(document, { code: 'Space' })
    })
    expect(handler).toHaveBeenCalledOnce()
  })
})
