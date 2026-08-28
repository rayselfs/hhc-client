import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import PresentationNavigationGuard from '../PresentationNavigationGuard'
import type { PresentationSessionRegistry } from '@renderer/contexts/PresentationSessionRegistryContext'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

const mocks = vi.hoisted(() => ({
  registry: null as PresentationSessionRegistry | null,
  requestCloseDecision: vi.fn(),
  stopProjection: vi.fn<() => Promise<void>>(),
  danger: vi.fn()
}))

vi.mock('@renderer/contexts/PresentationSessionRegistryContext', async () => {
  const actual = await vi.importActual<
    typeof import('@renderer/contexts/PresentationSessionRegistryContext')
  >('@renderer/contexts/PresentationSessionRegistryContext')
  return {
    ...actual,
    usePresentationSessionRegistry: () => mocks.registry
  }
})

vi.mock('@renderer/contexts/PresentationCloseDecisionContext', () => ({
  usePresentationCloseDecision: () => mocks.requestCloseDecision
}))

vi.mock('@renderer/contexts/ProjectionContext', () => ({
  useProjection: () => ({ stopProjection: mocks.stopProjection })
}))

vi.mock('@heroui/react/toast', () => ({
  toast: { danger: mocks.danger }
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key })
}))

function createRegistry(): PresentationSessionRegistry {
  return {
    open: vi.fn(),
    get: vi.fn(),
    finalizeAndFlush: vi.fn(),
    activate: vi.fn(),
    close: vi.fn(),
    flushAll: vi.fn().mockResolvedValue(undefined),
    discardAll: vi.fn().mockResolvedValue(undefined),
    hasUnsafeWork: vi.fn(() => true),
    getUnsafeItemIds: vi.fn(() => ['deck-1']),
    subscribe: vi.fn(() => () => undefined)
  }
}

function createRouter(
  initialPath = '/presentations/deck-1'
): ReturnType<typeof createMemoryRouter> {
  return createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <PresentationNavigationGuard />
            <div>route</div>
          </>
        )
      }
    ],
    { initialEntries: [initialPath] }
  )
}

describe('PresentationNavigationGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.registry = createRegistry()
    mocks.requestCloseDecision.mockResolvedValue('keep-editing')
    mocks.stopProjection.mockResolvedValue(undefined)
    useMediaProjectionStore.getState().endLiveSession()
  })

  it('flushes before proceeding to another route', async () => {
    const router = createRouter()
    render(<RouterProvider router={router} />)

    await act(() => router.navigate('/files'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/files'))
    expect(mocks.registry!.flushAll).toHaveBeenCalledTimes(1)
  })

  it('keeps the current route when flush fails and the user keeps editing', async () => {
    vi.mocked(mocks.registry!.flushAll).mockRejectedValue(new Error('quota exceeded'))
    const router = createRouter()
    render(<RouterProvider router={router} />)

    await act(() => router.navigate('/files'))
    await waitFor(() => expect(mocks.requestCloseDecision).toHaveBeenCalledTimes(1))

    expect(router.state.location.pathname).toBe('/presentations/deck-1')
    expect(mocks.requestCloseDecision).toHaveBeenCalledWith(['deck-1'])
  })

  it('retries the flush before proceeding', async () => {
    vi.mocked(mocks.registry!.flushAll)
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(undefined)
    mocks.requestCloseDecision.mockResolvedValue('retry')
    const router = createRouter()
    render(<RouterProvider router={router} />)

    await act(() => router.navigate('/files'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/files'))
    expect(mocks.registry!.flushAll).toHaveBeenCalledTimes(2)
  })

  it('discards unsafe sessions before proceeding', async () => {
    vi.mocked(mocks.registry!.flushAll).mockRejectedValue(new Error('quota exceeded'))
    mocks.requestCloseDecision.mockResolvedValue('discard')
    const router = createRouter()
    render(<RouterProvider router={router} />)

    await act(() => router.navigate('/files'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/files'))
    expect(mocks.registry!.discardAll).toHaveBeenCalledTimes(1)
  })

  it('warns before browser unload without pretending to flush', () => {
    const router = createRouter()
    render(<RouterProvider router={router} />)
    const event = new Event('beforeunload', { cancelable: true })

    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(mocks.registry!.flushAll).not.toHaveBeenCalled()
  })

  it('does not touch beforeunload when every session is safe', () => {
    vi.mocked(mocks.registry!.hasUnsafeWork).mockReturnValue(false)
    const router = createRouter()
    render(<RouterProvider router={router} />)
    const event = new Event('beforeunload', { cancelable: true })

    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })

  it('closes projection before browser navigation leaves live Media controls', async () => {
    vi.mocked(mocks.registry!.hasUnsafeWork).mockReturnValue(false)
    useMediaProjectionStore.setState({ isPresenting: true })
    const router = createRouter('/media')
    render(<RouterProvider router={router} />)

    await act(() => router.navigate('/files'))

    await waitFor(() => expect(router.state.location.pathname).toBe('/files'))
    expect(mocks.stopProjection).toHaveBeenCalledOnce()
    expect(useMediaProjectionStore.getState().isPresenting).toBe(false)
  })

  it('keeps Media controls and state when browser navigation cannot close projection', async () => {
    vi.mocked(mocks.registry!.hasUnsafeWork).mockReturnValue(false)
    mocks.stopProjection.mockRejectedValue(new Error('close failed'))
    useMediaProjectionStore.setState({ isPresenting: true })
    const router = createRouter('/media')
    render(<RouterProvider router={router} />)

    await act(() => router.navigate('/files'))

    await waitFor(() => expect(mocks.danger).toHaveBeenCalledWith('toast.projectionCloseFailed'))
    expect(router.state.location.pathname).toBe('/media')
    expect(useMediaProjectionStore.getState().isPresenting).toBe(true)
  })
})
