import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HhcOAuthCallbackPage from '../HhcOAuthCallbackPage'

describe('HhcOAuthCallbackPage', () => {
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
    expect(await screen.findByText('Sign-in complete')).toBeInTheDocument()
  })

  it('fails closed when there is no opener or callback parameter', () => {
    Object.defineProperty(window, 'opener', { configurable: true, value: null })
    window.history.replaceState({}, '', '/oauth/callback?code=code-1&state=state-1')
    render(<HhcOAuthCallbackPage />)
    expect(screen.getByText('Unable to complete sign-in')).toBeInTheDocument()
  })
})
