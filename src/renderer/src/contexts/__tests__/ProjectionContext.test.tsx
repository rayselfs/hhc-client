import { renderHook, act } from '@testing-library/react'
import type { ProjectionAdapter } from '@renderer/lib/projection-adapter'

vi.mock('@renderer/lib/env', () => ({
  isElectron: vi.fn(() => false)
}))

const mockAdapter: ProjectionAdapter & { _trigger: (channel: string, data: unknown) => void } =
  (() => {
    const handlers = new Map<string, Set<(data: unknown) => void>>()
    return {
      send: vi.fn(),
      on: vi.fn((channel: string, handler: (data: unknown) => void) => {
        if (!handlers.has(channel)) handlers.set(channel, new Set())
        handlers.get(channel)!.add(handler)
        return () => {
          handlers.get(channel)?.delete(handler)
        }
      }),
      dispose: vi.fn(),
      _trigger(channel: string, data: unknown) {
        handlers.get(channel)?.forEach((h) => h(data))
      }
    }
  })()

vi.mock('@renderer/lib/projection-adapter', () => ({
  createProjectionAdapter: vi.fn(() => mockAdapter)
}))

import { isElectron } from '@renderer/lib/env'
import { ProjectionProvider, useProjection } from '../ProjectionContext'

const mockWindowOpen = vi.fn<(url?: string, target?: string) => Window | null>()
const originalOpen = window.open

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  window.open = mockWindowOpen as unknown as typeof window.open
  mockWindowOpen.mockReturnValue({ closed: false, close: vi.fn() } as unknown as Window)
})

afterEach(() => {
  vi.useRealTimers()
  window.open = originalOpen
})

function renderProjection(): ReturnType<
  typeof renderHook<ReturnType<typeof useProjection>, unknown>
> {
  return renderHook(() => useProjection(), { wrapper: ProjectionProvider })
}

describe('ProjectionContext — web mode', () => {
  beforeEach(() => {
    vi.mocked(isElectron).mockReturnValue(false)
  })

  it('useProjection throws outside ProjectionProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    expect(() => renderHook(() => useProjection())).toThrow(
      'useProjection must be used within a ProjectionProvider'
    )
    spy.mockRestore()
  })

  it('does NOT auto-open projection window on mount', () => {
    renderProjection()
    expect(mockWindowOpen).not.toHaveBeenCalled()
  })

  it('isProjectionBlanked is true initially', () => {
    const { result } = renderProjection()
    expect(result.current.isProjectionBlanked).toBe(true)
  })

  it('isProjectionOpen is false initially, becomes true on __system:pong', () => {
    const { result } = renderProjection()
    expect(result.current.isProjectionOpen).toBe(false)

    act(() => {
      mockAdapter._trigger('__system:pong', null)
    })
    expect(result.current.isProjectionOpen).toBe(true)
  })

  it('isProjectionOpen becomes false on __system:closed', () => {
    const { result } = renderProjection()

    act(() => {
      mockAdapter._trigger('__system:pong', null)
    })
    expect(result.current.isProjectionOpen).toBe(true)

    act(() => {
      mockAdapter._trigger('__system:closed', null)
    })
    expect(result.current.isProjectionOpen).toBe(false)
  })

  it('handles window.open returning null (popup blocked)', async () => {
    mockWindowOpen.mockReturnValue(null)
    const { result } = renderProjection()

    await act(async () => {
      await result.current.openProjection()
    })
    expect(result.current.isProjectionOpen).toBe(false)
  })

  it('openProjection opens a new window', async () => {
    const { result } = renderProjection()
    mockWindowOpen.mockClear()

    await act(async () => {
      await result.current.openProjection()
    })
    expect(mockWindowOpen).toHaveBeenCalledOnce()
  })

  it('openProjection does nothing if popup blocked', async () => {
    mockWindowOpen.mockReturnValue(null)
    const { result } = renderProjection()

    await act(async () => {
      await result.current.openProjection()
    })
    expect(result.current.isProjectionOpen).toBe(false)
  })

  it('closeProjection sends __system:close and sets isProjectionOpen false', async () => {
    const { result } = renderProjection()

    act(() => {
      mockAdapter._trigger('__system:pong', null)
    })
    expect(result.current.isProjectionOpen).toBe(true)

    await act(async () => {
      await result.current.closeProjection()
    })
    expect(mockAdapter.send).toHaveBeenCalledWith('__system:close', null)
    expect(result.current.isProjectionOpen).toBe(false)
  })

  it('send delegates to adapter', () => {
    const { result } = renderProjection()
    act(() => {
      result.current.send('timer:overtime-message', { message: 'test' })
    })
    expect(mockAdapter.send).toHaveBeenCalledWith('timer:overtime-message', { message: 'test' })
  })

  it('on delegates to adapter and returns unsubscribe', () => {
    const { result } = renderProjection()
    const handler = vi.fn()
    let unsub: () => void = () => {}

    act(() => {
      unsub = result.current.on('timer:overtime-message', handler)
    })
    expect(mockAdapter.on).toHaveBeenCalledWith('timer:overtime-message', handler)
    expect(typeof unsub).toBe('function')
  })

  it('__system:ready sets projection ready', () => {
    const { result } = renderProjection()

    act(() => {
      mockAdapter._trigger('__system:ready', null)
    })

    act(() => {
      mockAdapter._trigger('__system:pong', null)
    })
    expect(result.current.isProjectionOpen).toBe(true)
  })

  it('project() skips send when projection is not ready', async () => {
    const { result } = renderProjection()
    expect(result.current.isProjectionBlanked).toBe(true)

    await act(async () => {
      await result.current.project('timer:overtime-message', { message: 'hello' })
    })

    expect(mockAdapter.send).not.toHaveBeenCalledWith('timer:overtime-message', {
      message: 'hello'
    })
    expect(result.current.isProjectionBlanked).toBe(true)
  })

  it('project() skips ready wait when already ready', async () => {
    const { result } = renderProjection()

    act(() => {
      mockAdapter._trigger('__system:ready', null)
    })

    await act(async () => {
      await result.current.project('timer:overtime-message', { message: 'hello' })
    })

    expect(mockAdapter.send).toHaveBeenCalledWith('timer:overtime-message', { message: 'hello' })
    expect(result.current.isProjectionBlanked).toBe(true)
  })

  it('project() with autoShow unblanks projection', async () => {
    const { result } = renderProjection()

    act(() => {
      mockAdapter._trigger('__system:ready', null)
    })

    await act(async () => {
      await result.current.project(
        'timer:overtime-message',
        { message: 'hello' },
        { autoShow: true }
      )
    })

    expect(mockAdapter.send).toHaveBeenCalledWith('timer:overtime-message', { message: 'hello' })
    expect(mockAdapter.send).toHaveBeenCalledWith('__system:blank', { showDefault: false })
    expect(result.current.isProjectionBlanked).toBe(false)
  })

  it('project() without autoShow does not unblank projection', async () => {
    const { result } = renderProjection()

    act(() => {
      mockAdapter._trigger('__system:ready', null)
    })

    await act(async () => {
      await result.current.project('timer:overtime-message', { message: 'hello' })
    })

    expect(mockAdapter.send).toHaveBeenCalledWith('timer:overtime-message', { message: 'hello' })
    expect(mockAdapter.send).not.toHaveBeenCalledWith('__system:blank', { showDefault: false })
    expect(result.current.isProjectionBlanked).toBe(true)
  })

  it('blankProjection(true) sets isProjectionBlanked true and sends __system:blank', () => {
    const { result } = renderProjection()

    act(() => {
      result.current.blankProjection(false)
    })
    expect(result.current.isProjectionBlanked).toBe(false)
    expect(mockAdapter.send).toHaveBeenCalledWith('__system:blank', { showDefault: false })

    vi.mocked(mockAdapter.send).mockClear()
    act(() => {
      result.current.blankProjection(true)
    })
    expect(result.current.isProjectionBlanked).toBe(true)
    expect(mockAdapter.send).toHaveBeenCalledWith('__system:blank', { showDefault: true })
  })

  it('closeProjection resets isProjectionBlanked to true', async () => {
    const { result } = renderProjection()

    act(() => {
      result.current.blankProjection(false)
    })
    expect(result.current.isProjectionBlanked).toBe(false)

    await act(async () => {
      await result.current.closeProjection()
    })
    expect(result.current.isProjectionBlanked).toBe(true)
  })

  it('__system:closed resets isProjectionBlanked to true', () => {
    const { result } = renderProjection()

    act(() => {
      result.current.blankProjection(false)
    })
    expect(result.current.isProjectionBlanked).toBe(false)

    act(() => {
      mockAdapter._trigger('__system:closed', null)
    })
    expect(result.current.isProjectionBlanked).toBe(true)
  })

  it('__system:closed resets ready state so project() skips send', async () => {
    const { result } = renderProjection()

    act(() => {
      mockAdapter._trigger('__system:ready', null)
    })

    act(() => {
      mockAdapter._trigger('__system:closed', null)
    })

    vi.mocked(mockAdapter.send).mockClear()

    await act(async () => {
      await result.current.project('timer:overtime-message', { message: 'new content' })
    })

    expect(mockAdapter.send).not.toHaveBeenCalledWith('timer:overtime-message', {
      message: 'new content'
    })
  })

  it('polling detects closed window', async () => {
    const fakeWindow = { closed: false, close: vi.fn() }
    mockWindowOpen.mockReturnValue(fakeWindow as unknown as Window)

    const { result } = renderProjection()

    await act(async () => {
      await result.current.openProjection()
    })

    act(() => {
      mockAdapter._trigger('__system:pong', null)
    })
    expect(result.current.isProjectionOpen).toBe(true)

    fakeWindow.closed = true
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.isProjectionOpen).toBe(false)
  })

  it('cleanup disposes adapter and closes projection window', async () => {
    const fakeWindow = { closed: false, close: vi.fn() }
    mockWindowOpen.mockReturnValue(fakeWindow as unknown as Window)

    const { result, unmount } = renderProjection()

    await act(async () => {
      await result.current.openProjection()
    })

    unmount()

    expect(fakeWindow.close).toHaveBeenCalled()
    expect(mockAdapter.dispose).toHaveBeenCalled()
  })
})

describe('ProjectionContext — electron mode', () => {
  let mockCheck: ReturnType<typeof vi.fn>
  let mockEnsure: ReturnType<typeof vi.fn>
  let mockClose: ReturnType<typeof vi.fn>
  let openedCallback: (() => void) | null
  let closedCallback: (() => void) | null
  const unsubOpened = vi.fn()
  const unsubClosed = vi.fn()

  beforeEach(() => {
    vi.mocked(isElectron).mockReturnValue(true)
    openedCallback = null
    closedCallback = null
    mockCheck = vi.fn(() => Promise.resolve({ exists: false }))
    mockEnsure = vi.fn(() => Promise.resolve({ created: true }))
    mockClose = vi.fn(() => Promise.resolve({ closed: true }))

    Object.defineProperty(window, 'api', {
      value: {
        projection: {
          check: mockCheck,
          ensure: mockEnsure,
          close: mockClose,
          send: vi.fn(),
          onProjectionOpened: vi.fn((cb: () => void) => {
            openedCallback = cb
            return unsubOpened
          }),
          onProjectionClosed: vi.fn((cb: () => void) => {
            closedCallback = cb
            return unsubClosed
          }),
          onProjectionMessage: vi.fn(() => vi.fn())
        }
      },
      writable: true,
      configurable: true
    })
  })

  it('checks existing projection on mount', async () => {
    renderProjection()
    expect(mockCheck).toHaveBeenCalledOnce()
  })

  it('does not call window.open in electron mode', () => {
    renderProjection()
    expect(mockWindowOpen).not.toHaveBeenCalled()
  })

  it('sets isProjectionOpen true when check returns exists: true', async () => {
    mockCheck.mockResolvedValue({ exists: true })
    const { result } = renderProjection()

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.isProjectionOpen).toBe(true)
  })

  it('responds to projection opened/closed IPC events', async () => {
    const { result } = renderProjection()
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.isProjectionOpen).toBe(false)

    act(() => {
      openedCallback?.()
    })
    expect(result.current.isProjectionOpen).toBe(true)

    act(() => {
      closedCallback?.()
    })
    expect(result.current.isProjectionOpen).toBe(false)
  })

  it('openProjection calls api.projection.ensure', async () => {
    const { result } = renderProjection()
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.openProjection()
    })
    expect(mockEnsure).toHaveBeenCalledOnce()
  })

  it('closeProjection calls api.projection.close', async () => {
    const { result } = renderProjection()
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      await result.current.closeProjection()
    })
    expect(mockClose).toHaveBeenCalledOnce()
  })

  it('cleanup unsubscribes from IPC events', () => {
    const { unmount } = renderProjection()
    unmount()
    expect(unsubOpened).toHaveBeenCalledOnce()
    expect(unsubClosed).toHaveBeenCalledOnce()
  })
})
