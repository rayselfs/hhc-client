import { renderHook, act, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import {
  useKeyboardShortcuts,
  type ShortcutHandler,
  type ShortcutConfig
} from '../useKeyboardShortcuts'

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
})
