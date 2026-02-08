import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProjectionElectron } from '../useElectron'

describe('useProjectionElectron postMessage security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete (window as { electronAPI?: unknown }).electronAPI
  })

  it('should reject messages from different origins', () => {
    const callback = vi.fn()
    const { handleMessage } = useProjectionElectron()

    const cleanup = handleMessage(callback)

    const maliciousEvent = new MessageEvent('message', {
      data: { type: 'TIMER_UPDATE', payload: { malicious: true } },
      origin: 'https://evil.com',
    })

    window.dispatchEvent(maliciousEvent)

    expect(callback).not.toHaveBeenCalled()

    if (cleanup) cleanup()
  })

  it('should accept messages from same origin', () => {
    const callback = vi.fn()
    const { handleMessage } = useProjectionElectron()

    const cleanup = handleMessage(callback)

    const validEvent = new MessageEvent('message', {
      data: { type: 'TIMER_UPDATE', payload: { time: 100 } },
      origin: window.location.origin,
    })

    window.dispatchEvent(validEvent)

    expect(callback).toHaveBeenCalledWith({ type: 'TIMER_UPDATE', payload: { time: 100 } })

    if (cleanup) cleanup()
  })

  it('should use window.location.origin for postMessage target', () => {
    const mockOpener = {
      postMessage: vi.fn(),
    }

    Object.defineProperty(window, 'opener', {
      value: mockOpener,
      writable: true,
      configurable: true,
    })

    const { requestCurrentState } = useProjectionElectron()
    requestCurrentState()

    expect(mockOpener.postMessage).toHaveBeenCalledWith(
      { type: 'REQUEST_STATE' },
      window.location.origin,
    )
  })
})
