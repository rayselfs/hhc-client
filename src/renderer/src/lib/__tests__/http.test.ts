import { afterEach, describe, expect, it, vi } from 'vitest'
import { http } from '../http'

describe('http', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('gets JSON and converts nested snake_case keys to camelCase', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user_info: { first_name: 'Jane', last_address: { zip_code: '12345' } },
            is_active: true
          })
        )
      )
    )

    await expect(http.get('/api/example')).resolves.toEqual({
      data: {
        userInfo: { firstName: 'Jane', lastAddress: { zipCode: '12345' } },
        isActive: true
      }
    })
  })

  it('rejects unsuccessful HTTP responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('', { status: 503, statusText: 'Service Unavailable' }))
    )

    await expect(http.get('/api/example')).rejects.toThrow('HTTP 503: Service Unavailable')
  })

  it('aborts a request after its configured timeout', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        })
      })
    )

    const request = http.get('/api/example', { timeout: 25 })
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(25)

    await rejection
  })

  it('uses a 30 second timeout by default', async () => {
    vi.useFakeTimers()
    let signal: AbortSignal | null | undefined
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal
        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted', 'AbortError'))
          })
        })
      })
    )

    const request = http.get('/api/example')
    const rejection = expect(request).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(29_999)
    expect(signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    await rejection
  })
})
