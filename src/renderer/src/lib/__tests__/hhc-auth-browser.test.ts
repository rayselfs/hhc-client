import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BrowserHhcAuthAdapter,
  createBrowserHhcAuthAdapter,
  createPkceChallenge
} from '../hhc-auth-browser'

const ACCOUNT_ORIGIN = 'https://account.alive.org.tw'
const CLIENT_ORIGIN = 'https://client.alive.org.tw'

function jwt(claims: object): string {
  return `header.${btoa(JSON.stringify(claims)).replaceAll('=', '')}.signature`
}

function response(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function popup(): Window {
  return {
    closed: false,
    close: vi.fn(),
    focus: vi.fn(),
    location: { href: '' }
  } as unknown as Window
}

function createAdapter(
  options: {
    fetcher?: typeof fetch
    now?: () => number
    open?: ReturnType<typeof vi.fn>
    accountOrigin?: string
  } = {}
): { adapter: BrowserHhcAuthAdapter; open: ReturnType<typeof vi.fn>; target: Window } {
  const open = options.open ?? vi.fn(() => popup())
  const target = new EventTarget() as Window
  Object.assign(target, {
    location: { href: `${CLIENT_ORIGIN}/#/files`, origin: CLIENT_ORIGIN },
    open
  })

  return {
    adapter: createBrowserHhcAuthAdapter({
      accountOrigin: options.accountOrigin ?? ACCOUNT_ORIGIN,
      fetcher: options.fetcher ?? vi.fn(),
      now: options.now ?? (() => 1_000),
      window: target
    }),
    open,
    target
  }
}

describe('browser HHC auth', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates an S256 PKCE challenge', async () => {
    await expect(createPkceChallenge('abc')).resolves.toBe(
      'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0'
    )
  })

  it('calls the default native fetch with the Window receiver', async () => {
    const nativeFetch = vi.fn(function (this: unknown): Promise<Response> {
      if (this !== window) throw new TypeError('Illegal invocation')
      return Promise.resolve(response({ authenticated: false }))
    })
    vi.stubGlobal('fetch', nativeFetch)
    const adapter = createBrowserHhcAuthAdapter({ accountOrigin: ACCOUNT_ORIGIN })

    try {
      await expect(adapter.getSession()).resolves.toBeNull()
      expect(nativeFetch).toHaveBeenCalledOnce()
    } finally {
      adapter.dispose()
      vi.unstubAllGlobals()
    }
  })

  it('opens a blank popup synchronously and navigates it to the exact authorization URL', async () => {
    const { adapter, open } = createAdapter()

    await adapter.signIn()

    expect(open).toHaveBeenCalledWith('', 'hhc-account-auth', 'popup,width=520,height=720')
    const opened = open.mock.results[0]?.value as Window
    const url = new URL(String(opened.location.href))
    expect(url.origin).toBe(ACCOUNT_ORIGIN)
    expect(url.pathname).toBe('/api/account/v1/oauth/authorize')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'client-web',
      redirect_uri: `${CLIENT_ORIGIN}/oauth/callback`,
      response_type: 'code',
      scope: 'openid profile',
      code_challenge_method: 'S256'
    })
    expect(url.searchParams.get('state')).toHaveLength(43)
    expect(url.searchParams.get('code_challenge')).toHaveLength(43)
  })

  it('fails explicitly when the sign-in popup is blocked', async () => {
    const { adapter } = createAdapter({ open: vi.fn(() => null) })
    await expect(adapter.signIn()).rejects.toThrow('Sign-in popup was blocked')
  })

  it('reuses the active popup without creating a second transaction', async () => {
    const { adapter, open } = createAdapter()
    await adapter.signIn()
    await adapter.signIn()
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('exchanges only an exact-origin, matching-popup, matching-state callback once', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/oauth/token')) {
        expect(init).toMatchObject({ method: 'POST', credentials: 'include' })
        const body = new URLSearchParams(String(init?.body))
        expect(Object.fromEntries(body)).toMatchObject({
          grant_type: 'authorization_code',
          client_id: 'client-web',
          redirect_uri: `${CLIENT_ORIGIN}/oauth/callback`,
          code: 'code-1'
        })
        return response({
          access_token: jwt({ sub: 'user-1', roles: ['media_sync_user'], exp: 9_999_999_999 })
        })
      }
      if (String(input).endsWith('/session')) {
        return response({
          authenticated: true,
          user: { id: 'user-1', display_name: 'Ada', avatar_url: 'https://avatar' }
        })
      }
      throw new Error(`Unexpected URL: ${String(input)}`)
    })
    const { adapter, open, target } = createAdapter({ fetcher })
    await adapter.signIn()
    const opened = open.mock.results[0]?.value as Window
    const state = new URL(String(opened.location.href)).searchParams.get('state')!

    target.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        source: opened,
        data: { code: 'code-1', state }
      })
    )
    target.dispatchEvent(
      new MessageEvent('message', {
        origin: CLIENT_ORIGIN,
        source: popup(),
        data: { code: 'code-1', state }
      })
    )
    target.dispatchEvent(
      new MessageEvent('message', {
        origin: CLIENT_ORIGIN,
        source: opened,
        data: { code: 'code-1', state: 'wrong' }
      })
    )
    await Promise.resolve()
    expect(fetcher).not.toHaveBeenCalled()

    target.dispatchEvent(
      new MessageEvent('message', {
        origin: CLIENT_ORIGIN,
        source: opened,
        data: { code: 'code-1', state }
      })
    )
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(opened.close).toHaveBeenCalledTimes(1)
    expect(await adapter.getAccessToken()).toContain('.')
    expect(await adapter.getAccessToken()).not.toContain('refresh')
    expect(await adapter.getSession()).toEqual({
      userId: 'user-1',
      displayName: 'Ada',
      avatarUrl: 'https://avatar',
      roles: ['media_sync_user']
    })

    target.dispatchEvent(
      new MessageEvent('message', {
        origin: CLIENT_ORIGIN,
        source: opened,
        data: { code: 'code-1', state }
      })
    )
    await Promise.resolve()
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('rejects expired callbacks without exchanging', async () => {
    const fetcher = vi.fn()
    let now = 1_000
    const { adapter, open, target } = createAdapter({ fetcher, now: () => now })
    await adapter.signIn()
    const opened = open.mock.results[0]?.value as Window
    const state = new URL(String(opened.location.href)).searchParams.get('state')!
    now = 301_001
    target.dispatchEvent(
      new MessageEvent('message', {
        origin: CLIENT_ORIGIN,
        source: opened,
        data: { code: 'code', state }
      })
    )
    await Promise.resolve()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('obtains a cookie-backed session access token through CSRF and never sends identity headers', async () => {
    const accessToken = jwt({ sub: 'user-1', roles: ['media_sync_user'], exp: 9_999_999_999 })
    const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      if (String(input).endsWith('/session'))
        return response({ authenticated: true, user: { id: 'user-1', display_name: 'Ada' } })
      if (String(input).endsWith('/csrf-token')) return response({ csrf_token: 'csrf-1' })
      if (String(input).endsWith('/session/access-token'))
        return response({ access_token: accessToken })
      throw new Error(`Unexpected URL: ${String(input)}`)
    })
    const { adapter } = createAdapter({ fetcher, accountOrigin: 'https://coalesce.example' })

    await expect(adapter.getSession()).resolves.toEqual({
      userId: 'user-1',
      displayName: 'Ada',
      roles: []
    })
    await expect(adapter.getAccessToken()).resolves.toBe(accessToken)
    const csrf = fetcher.mock.calls.find(([url]) => String(url).endsWith('/csrf-token'))?.[1]
    const access = fetcher.mock.calls.find(([url]) =>
      String(url).endsWith('/session/access-token')
    )?.[1]
    expect(csrf).toMatchObject({ credentials: 'include', cache: 'no-store' })
    expect(access).toMatchObject({ method: 'POST', credentials: 'include' })
    expect(new Headers(access?.headers).get('x-csrf-token')).toBe('csrf-1')
    expect(new Headers(access?.headers).get('authorization')).toBeNull()
    expect(new Headers(access?.headers).get('x-hhc-roles')).toBeNull()
  })

  it('explicitly refreshes a still-valid cached access token', async () => {
    const firstToken = jwt({ sub: 'user-1', roles: ['media_sync_user'], exp: 9_999_999_999 })
    const secondToken = jwt({
      sub: 'user-1',
      roles: ['media_sync_user', 'reader'],
      exp: 9_999_999_999
    })
    let accessTokenRequests = 0
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/session')) {
        return response({ authenticated: true, user: { id: 'user-1', display_name: 'Ada' } })
      }
      if (String(input).endsWith('/csrf-token')) return response({ csrf_token: 'csrf-refresh' })
      if (String(input).endsWith('/session/access-token')) {
        accessTokenRequests += 1
        return response({ access_token: accessTokenRequests === 1 ? firstToken : secondToken })
      }
      throw new Error(`Unexpected URL: ${String(input)}`)
    })
    const { adapter } = createAdapter({ fetcher, accountOrigin: 'https://force-refresh.example' })

    await expect(adapter.getAccessToken()).resolves.toBe(firstToken)
    await expect(adapter.getAccessToken()).resolves.toBe(firstToken)
    await expect(adapter.refreshAccessToken()).resolves.toBe(secondToken)
    await expect(adapter.getSession()).resolves.toMatchObject({
      roles: ['media_sync_user', 'reader']
    })
    expect(accessTokenRequests).toBe(2)
  })

  it('coalesces CSRF calls and retries a rejected protected request once with a new token', async () => {
    let csrfRequests = 0
    let accessRequests = 0
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/session'))
        return response({ authenticated: true, user: { id: 'user-1', display_name: 'Ada' } })
      if (url.endsWith('/csrf-token')) return response({ csrf_token: `csrf-${++csrfRequests}` })
      if (url.endsWith('/session/access-token')) {
        accessRequests++
        return accessRequests === 1
          ? response({ error_code: 'ACC_CSRF_TOKEN_INVALID' }, 403)
          : response({ access_token: jwt({ sub: 'user-1', roles: [], exp: 9_999_999_999 }) })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const { adapter } = createAdapter({ fetcher, accountOrigin: 'https://logout.example' })
    await adapter.getSession()
    await Promise.all([adapter.getAccessToken(), adapter.getAccessToken()])
    expect(csrfRequests).toBe(2)
    expect(accessRequests).toBe(3)
  })

  it('clears memory and calls CSRF-protected logout even when logout fails', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/session'))
        return response({ authenticated: true, user: { id: 'user-1', display_name: 'Ada' } })
      if (url.endsWith('/csrf-token')) return response({ csrf_token: 'csrf-1' })
      if (url.endsWith('/session/access-token'))
        return response({ access_token: jwt({ sub: 'user-1', roles: [], exp: 9_999_999_999 }) })
      if (url.endsWith('/session/logout')) return response({ error_code: 'ERR' }, 500)
      throw new Error(`Unexpected URL: ${url}`)
    })
    const { adapter } = createAdapter({ fetcher, accountOrigin: 'https://logout.example' })
    const sessions: unknown[] = []
    adapter.subscribe((session) => sessions.push(session))
    await adapter.getSession()
    await adapter.getAccessToken()
    await expect(adapter.signOut()).rejects.toThrow()
    expect(sessions.at(-1)).toBeNull()
  })

  it('refreshes the cookie session once after an access-token rejection', async () => {
    let accessRequests = 0
    let refreshRequests = 0
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/session'))
        return response({ authenticated: true, user: { id: 'user-1', display_name: 'Ada' } })
      if (url.endsWith('/csrf-token')) return response({ csrf_token: 'csrf-1' })
      if (url.endsWith('/session/access-token')) {
        accessRequests++
        return accessRequests === 1
          ? response({ error_code: 'ACC_AUTH_TOKEN_INVALID' }, 401)
          : response({ access_token: jwt({ sub: 'user-1', roles: [], exp: 9_999_999_999 }) })
      }
      if (url.endsWith('/refresh')) {
        refreshRequests++
        return response({ access_token: 'unused-cookie-refresh-response' })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const { adapter } = createAdapter({ fetcher, accountOrigin: 'https://refresh.example' })
    await adapter.getSession()

    await expect(adapter.getAccessToken()).resolves.toContain('.')
    expect(accessRequests).toBe(2)
    expect(refreshRequests).toBe(1)
  })

  it('does not touch browser Web Storage during browser authentication', async () => {
    const local = vi.spyOn(Storage.prototype, 'getItem')
    const session = vi.spyOn(Storage.prototype, 'setItem')
    const { adapter } = createAdapter()
    await adapter.signIn()
    adapter.dispose()
    expect(local).not.toHaveBeenCalled()
    expect(session).not.toHaveBeenCalled()
  })

  it('uses the only registered production callback by default and removes its listener on dispose', async () => {
    const open = vi.fn(() => popup())
    const target = new EventTarget() as Window
    Object.assign(target, {
      location: { href: 'https://preview.example/#/files', origin: 'https://preview.example' },
      open
    })
    const adapter = createBrowserHhcAuthAdapter({
      accountOrigin: ACCOUNT_ORIGIN,
      fetcher: vi.fn(),
      window: target
    })

    await adapter.signIn()
    const opened = open.mock.results[0]?.value as Window
    expect(new URL(String(opened.location.href)).searchParams.get('redirect_uri')).toBe(
      'https://client.alive.org.tw/oauth/callback'
    )
    const remove = vi.spyOn(target, 'removeEventListener')
    adapter.dispose()
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function))
  })

  it('reacquires an expired cached access token using the current clock', async () => {
    let now = 1_000
    let tokenIssues = 0
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/session'))
        return response({ authenticated: true, user: { id: 'user-1', display_name: 'Ada' } })
      if (url.endsWith('/csrf-token')) return response({ csrf_token: 'csrf-1' })
      if (url.endsWith('/session/access-token')) {
        tokenIssues++
        return response({
          access_token: jwt({ sub: 'user-1', roles: [], exp: tokenIssues === 1 ? 2 : 10 })
        })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const { adapter } = createAdapter({
      fetcher,
      now: () => now,
      accountOrigin: 'https://clock.example'
    })
    await adapter.getSession()

    const first = await adapter.getAccessToken()
    now = 3_000
    const second = await adapter.getAccessToken()
    expect(first).not.toBe(second)
    expect(tokenIssues).toBe(2)
  })

  it.each([
    ['sub mismatch', jwt({ sub: 'other', roles: [], exp: 9_999_999_999 })],
    ['missing roles', jwt({ sub: 'user-1', exp: 9_999_999_999 })],
    ['expired token', jwt({ sub: 'user-1', roles: [], exp: 1 })],
    ['malformed token', 'not-a-jwt']
  ])('rejects %s claims without retaining a token', async (_name, accessToken) => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/session'))
        return response({ authenticated: true, user: { id: 'user-1', display_name: 'Ada' } })
      if (url.endsWith('/csrf-token')) return response({ csrf_token: 'csrf-1' })
      if (url.endsWith('/session/access-token')) return response({ access_token: accessToken })
      throw new Error(`Unexpected URL: ${url}`)
    })
    const { adapter } = createAdapter({ fetcher })
    await adapter.getSession()
    await expect(adapter.getAccessToken()).rejects.toThrow()
    await expect(adapter.getAccessToken()).rejects.toThrow()
  })

  it('does not retain an access token whose claims fail validation', async () => {
    const invalidToken = jwt({ sub: 'other', roles: [], exp: 9_999_999_999 })
    let issues = 0
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/session'))
        return response({ authenticated: true, user: { id: 'user-1', display_name: 'Ada' } })
      if (url.endsWith('/csrf-token')) return response({ csrf_token: 'csrf-1' })
      if (url.endsWith('/session/access-token')) {
        issues++
        return response({ access_token: invalidToken })
      }
      throw new Error(`Unexpected URL: ${url}`)
    })
    const { adapter } = createAdapter({ fetcher, accountOrigin: 'https://invalid-token.example' })
    await adapter.getSession()

    await expect(adapter.getAccessToken()).rejects.toThrow('Invalid HHC access token claims')
    await expect(adapter.getAccessToken()).rejects.toThrow('Invalid HHC access token claims')
    expect(issues).toBe(2)
  })
})
