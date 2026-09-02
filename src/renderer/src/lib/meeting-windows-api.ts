import { APP_CONFIG } from '@shared/app-config'

export interface MediaSyncWindow {
  startsAt: string
  endsAt: string
}

export interface MeetingWindowsApi {
  list(now?: number): Promise<MediaSyncWindow[]>
}

type MeetingWindowsAuth = {
  getAccessToken: () => Promise<string | null>
  refreshAccessToken: () => Promise<string | null>
}

type MeetingWindowsOptions = {
  origin?: string
  fetcher?: typeof fetch
}

const CACHE_MS = 60_000
const QUERY_RANGE_MS = 24 * 60 * 60 * 1000

function project(value: unknown): MediaSyncWindow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
  const root = value as Record<string, unknown>
  if (
    Object.keys(root).sort().join(',') !== 'data,error,meta' ||
    !Array.isArray(root.data) ||
    root.data.length > 500 ||
    !root.meta ||
    typeof root.meta !== 'object' ||
    Array.isArray(root.meta) ||
    root.error !== null
  ) {
    throw new Error()
  }
  return root.data.map((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error()
    const window = entry as Record<string, unknown>
    if (
      Object.keys(window).sort().join(',') !== 'endsAt,startsAt' ||
      typeof window.startsAt !== 'string' ||
      typeof window.endsAt !== 'string' ||
      !Number.isFinite(Date.parse(window.startsAt)) ||
      !Number.isFinite(Date.parse(window.endsAt)) ||
      Date.parse(window.startsAt) >= Date.parse(window.endsAt)
    ) {
      throw new Error()
    }
    return { startsAt: window.startsAt, endsAt: window.endsAt }
  })
}

export function createMeetingWindowsApi(
  auth: MeetingWindowsAuth,
  options: MeetingWindowsOptions = {}
): MeetingWindowsApi {
  const origin = options.origin ?? APP_CONFIG.hhcAssetOrigin
  if (new URL(origin).origin !== origin || origin !== APP_CONFIG.hhcAssetOrigin) {
    throw new Error('Invalid HHC meeting origin')
  }
  const fetcher = options.fetcher ?? ((...args) => window.fetch(...args))
  let cached: MediaSyncWindow[] = []
  let cachedAt = Number.NEGATIVE_INFINITY
  let inFlight: Promise<MediaSyncWindow[]> | undefined

  return {
    list(now = Date.now()) {
      if (now - cachedAt < CACHE_MS) return Promise.resolve(cached)
      if (inFlight) return inFlight
      inFlight = (async () => {
        try {
          const params = new URLSearchParams({
            from: new Date(now - QUERY_RANGE_MS).toISOString(),
            to: new Date(now + QUERY_RANGE_MS).toISOString()
          })
          const send = (token: string): Promise<Response> =>
            fetcher(`${origin}/api/meeting-sync-windows?${params}`, {
              headers: { accept: 'application/json', authorization: `Bearer ${token}` }
            })
          const token = await auth.getAccessToken()
          if (!token) throw new Error()
          let response = await send(token)
          if (response.status === 401) {
            const refreshed = await auth.refreshAccessToken()
            if (!refreshed) throw new Error()
            response = await send(refreshed)
          }
          if (!response.ok) throw new Error()
          cached = project(await response.json())
        } catch {
          cached = []
        } finally {
          cachedAt = now
          inFlight = undefined
        }
        return cached
      })()
      return inFlight
    }
  }
}
