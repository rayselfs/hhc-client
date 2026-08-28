import { act, render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PresentationElectronCloseBridge from '../PresentationElectronCloseBridge'
import type { PresentationSessionRegistry } from '../PresentationSessionRegistryContext'

const mocks = vi.hoisted(() => ({
  isElectron: true,
  registry: null as PresentationSessionRegistry | null,
  requestCloseDecision: vi.fn()
}))

vi.mock('@renderer/lib/env', () => ({
  isElectron: () => mocks.isElectron
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

describe('PresentationElectronCloseBridge', () => {
  let closeRequestedListener: (() => void) | null
  let onCloseRequested: ReturnType<typeof vi.fn>
  let confirmClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isElectron = true
    mocks.registry = createRegistry()
    mocks.requestCloseDecision.mockResolvedValue('keep-editing')
    closeRequestedListener = null
    onCloseRequested = vi.fn((listener: () => void) => {
      closeRequestedListener = listener
      return () => {
        closeRequestedListener = null
      }
    })
    confirmClose = vi.fn().mockResolvedValue({ closing: true })
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: {
        app: {
          onCloseRequested,
          confirmClose
        }
      } as unknown as Window['api']
    })
  })

  it('confirms Electron close only after every presentation flushes', async () => {
    render(<PresentationElectronCloseBridge />)

    act(() => closeRequestedListener?.())

    await waitFor(() => expect(mocks.registry!.flushAll).toHaveBeenCalledTimes(1))
    expect(confirmClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the window open when the user keeps editing after a failure', async () => {
    vi.mocked(mocks.registry!.flushAll).mockRejectedValue(new Error('save failed'))
    render(<PresentationElectronCloseBridge />)

    act(() => closeRequestedListener?.())

    await waitFor(() => expect(mocks.requestCloseDecision).toHaveBeenCalledTimes(1))
    expect(confirmClose).not.toHaveBeenCalled()
  })

  it('discards unsafe work before confirming close', async () => {
    vi.mocked(mocks.registry!.flushAll).mockRejectedValue(new Error('save failed'))
    mocks.requestCloseDecision.mockResolvedValue('discard')
    render(<PresentationElectronCloseBridge />)

    act(() => closeRequestedListener?.())

    await waitFor(() => expect(mocks.registry!.discardAll).toHaveBeenCalledTimes(1))
    expect(confirmClose).toHaveBeenCalledTimes(1)
  })

  it('does not register an Electron listener in browser mode', () => {
    mocks.isElectron = false

    render(<PresentationElectronCloseBridge />)

    expect(onCloseRequested).not.toHaveBeenCalled()
  })
})
