import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import '@renderer/i18n'
import HhcOAuthCallbackPage from '../HhcOAuthCallbackPage'

describe('HhcOAuthCallbackPage', () => {
  const channels: Array<
    EventTarget & {
      name: string
      postMessage: ReturnType<typeof vi.fn>
      close: ReturnType<typeof vi.fn>
    }
  > = []

  beforeEach(() => {
    channels.length = 0
    vi.stubGlobal(
      'BroadcastChannel',
      class extends EventTarget {
        readonly postMessage = vi.fn()
        readonly close = vi.fn()

        constructor(readonly name: string) {
          super()
          channels.push(this)
        }
      }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts only code and state to its same-origin opener', async () => {
    const postMessage = vi.fn()
    Object.defineProperty(window, 'opener', {
      configurable: true,
      value: { location: { origin: window.location.origin }, postMessage }
    })
    window.history.replaceState({}, '', '/oauth/callback?code=code-1&state=state-1')

    render(<HhcOAuthCallbackPage />)

    expect(postMessage).toHaveBeenCalledWith(
      { code: 'code-1', state: 'state-1' },
      window.location.origin
    )
    expect(screen.getByText('Completing sign-in...')).toBeInTheDocument()
    expect(channels).toHaveLength(1)
    channels[0]?.dispatchEvent(
      new MessageEvent('message', { data: { state: 'state-1', status: 'complete' } })
    )
    expect(await screen.findByText('Sign-in complete')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'HHC Presenter' })).toBeInTheDocument()
  })

  it('broadcasts the callback when browser isolation removes the opener', async () => {
    Object.defineProperty(window, 'opener', { configurable: true, value: null })
    window.history.replaceState({}, '', '/oauth/callback?code=code-1&state=state-1')

    render(<HhcOAuthCallbackPage />)

    expect(channels).toHaveLength(1)
    expect(channels[0]?.name).toBe('hhc-auth-callback')
    expect(channels[0]?.postMessage).toHaveBeenCalledWith({ code: 'code-1', state: 'state-1' })
    expect(screen.getByText('Completing sign-in...')).toBeInTheDocument()
    expect(channels[0]?.close).not.toHaveBeenCalled()
    channels[0]?.dispatchEvent(
      new MessageEvent('message', { data: { state: 'state-1', status: 'complete' } })
    )
    expect(await screen.findByRole('heading', { name: 'Sign-in complete' })).toBeInTheDocument()
    expect(channels[0]?.close).toHaveBeenCalledOnce()
  })

  it('shows failure when the opener rejects the callback exchange', async () => {
    Object.defineProperty(window, 'opener', { configurable: true, value: null })
    window.history.replaceState({}, '', '/oauth/callback?code=code-1&state=state-1')

    render(<HhcOAuthCallbackPage />)
    channels[0]?.dispatchEvent(
      new MessageEvent('message', { data: { state: 'state-1', status: 'failed' } })
    )

    expect(await screen.findByText('Unable to complete sign-in')).toBeInTheDocument()
  })

  it('keeps the acknowledged result after the fallback timeout', async () => {
    vi.useFakeTimers()
    try {
      Object.defineProperty(window, 'opener', { configurable: true, value: null })
      window.history.replaceState({}, '', '/oauth/callback?code=code-1&state=state-1')
      render(<HhcOAuthCallbackPage />)

      await act(async () => {
        channels[0]?.dispatchEvent(
          new MessageEvent('message', { data: { state: 'state-1', status: 'complete' } })
        )
        await vi.advanceTimersByTimeAsync(30_000)
      })

      expect(screen.getByText('Sign-in complete')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('fails closed when callback parameters are incomplete', async () => {
    Object.defineProperty(window, 'opener', { configurable: true, value: null })
    window.history.replaceState({}, '', '/oauth/callback?code=code-1')

    render(<HhcOAuthCallbackPage />)

    expect(await screen.findByText('Unable to complete sign-in')).toBeInTheDocument()
    expect(channels).toHaveLength(0)
  })
})
