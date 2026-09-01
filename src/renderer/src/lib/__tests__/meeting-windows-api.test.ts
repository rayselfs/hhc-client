import { describe, expect, it, vi } from 'vitest'
import { createMeetingWindowsApi } from '../meeting-windows-api'

const ORIGIN = 'https://www.alive.org.tw'

describe('meeting windows API', () => {
  it('uses HHC auth, validates the redacted response, and caches for 60 seconds', async () => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            data: [{ startsAt: '2026-09-02T01:00:00Z', endsAt: '2026-09-02T03:00:00Z' }]
          })
        )
    )
    const api = createMeetingWindowsApi(
      {
        getAccessToken: vi.fn(async () => 'token'),
        refreshAccessToken: vi.fn(async () => 'refreshed')
      },
      { origin: ORIGIN, fetcher }
    )

    await expect(api.list(1_788_315_600_000)).resolves.toEqual([
      { startsAt: '2026-09-02T01:00:00Z', endsAt: '2026-09-02T03:00:00Z' }
    ])
    await api.list(1_788_315_659_999)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('authorization')).toBe(
      'Bearer token'
    )
    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(
      /^https:\/\/www\.alive\.org\.tw\/api\/meeting-sync-windows\?from=.*&to=.*/
    )

    await api.list(1_788_315_660_000)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('coalesces in-flight reads and returns no active windows on failure', async () => {
    let resolve!: (response: Response) => void
    const fetcher = vi.fn<typeof fetch>(() => new Promise<Response>((done) => (resolve = done)))
    const api = createMeetingWindowsApi(
      {
        getAccessToken: vi.fn(async () => 'token'),
        refreshAccessToken: vi.fn(async () => null)
      },
      { origin: ORIGIN, fetcher }
    )

    const first = api.list(1_000_000)
    const second = api.list(1_000_000)
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
    resolve(new Response('{}', { status: 503 }))

    await expect(first).resolves.toEqual([])
    await expect(second).resolves.toEqual([])
  })

  it('rejects malformed or privacy-expanding response fields', async () => {
    const api = createMeetingWindowsApi(
      {
        getAccessToken: vi.fn(async () => 'token'),
        refreshAccessToken: vi.fn(async () => null)
      },
      {
        origin: ORIGIN,
        fetcher: vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                data: [
                  {
                    startsAt: '2026-09-02T01:00:00Z',
                    endsAt: '2026-09-02T03:00:00Z',
                    meetingId: 'must-not-cross'
                  }
                ]
              })
            )
        )
      }
    )

    await expect(api.list()).resolves.toEqual([])
  })
})
