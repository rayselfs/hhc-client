import type { HhcAuthAdapter, HhcSession } from '@shared/hhc-auth'
import { HHC_AUTH } from './hhc-auth'

const CALLBACK_TTL_MS = 5 * 60 * 1000
const CSRF_REJECTION_CODES = new Set([
  'ACC_AUTH_CSRF_INVALID',
  'ACC_CSRF_TOKEN_INVALID',
  'ACC_CSRF_TOKEN_MISSING'
])

const csrfTokens = new Map<string, string>()
const csrfRequests = new Map<string, Promise<string>>()

type BrowserWindow = Pick<Window, 'addEventListener' | 'removeEventListener' | 'location' | 'open'>

type Transaction = {
  state: string
  codeVerifier: string
  popup: Window
  expiresAt: number
  returnRoute: string
}

type SessionResponse = {
  authenticated?: boolean
  user?: { id?: string; display_name?: string; avatar_url?: string }
}

type TokenResponse = { access_token?: string }

export type BrowserHhcAuthOptions = {
  accountOrigin?: string
  fetcher?: typeof fetch
  now?: () => number
  window?: BrowserWindow
}

function base64Url(bytes: Uint8Array): string {
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function randomValue(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64Url(bytes)
}

export async function createPkceChallenge(verifier: string): Promise<string> {
  const bytes = new TextEncoder().encode(verifier)
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
}

function readClaims(accessToken: string, userId: string, now: number): string[] {
  const encoded = accessToken.split('.')[1]
  if (!encoded) throw new Error('Invalid HHC access token')

  let claims: { sub?: unknown; roles?: unknown; exp?: unknown }
  try {
    claims = JSON.parse(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')))
  } catch {
    throw new Error('Invalid HHC access token')
  }

  if (
    typeof claims.sub !== 'string' ||
    claims.sub !== userId ||
    !Array.isArray(claims.roles) ||
    !claims.roles.every((role) => typeof role === 'string') ||
    typeof claims.exp !== 'number' ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now / 1000
  ) {
    throw new Error('Invalid HHC access token claims')
  }

  return claims.roles
}

async function responseJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!response.ok) throw new Error(text || `HHC account request failed (${response.status})`)
  return text ? (JSON.parse(text) as T) : ({} as T)
}

function csrfRejected(response: Response, data: { error_code?: unknown }): boolean {
  return (
    response.status === 403 &&
    typeof data.error_code === 'string' &&
    CSRF_REJECTION_CODES.has(data.error_code)
  )
}

export class BrowserHhcAuthAdapter implements HhcAuthAdapter {
  private readonly accountApi: string
  private readonly authorize: string
  private readonly callbackUri: string
  private readonly fetcher: typeof fetch
  private readonly now: () => number
  private readonly window: BrowserWindow
  private transaction: Transaction | null = null
  private signInPromise: Promise<void> | null = null
  private session: HhcSession | null = null
  private accessToken: string | null = null
  private readonly listeners = new Set<(session: HhcSession | null) => void>()

  constructor(options: BrowserHhcAuthOptions = {}) {
    const accountOrigin = options.accountOrigin ?? new URL(HHC_AUTH.accountApi).origin
    this.accountApi = `${accountOrigin}/api/account/v1`
    this.authorize = `${accountOrigin}/api/account/v1/oauth/authorize`
    this.fetcher = options.fetcher ?? ((...args) => window.fetch(...args))
    this.now = options.now ?? Date.now
    this.window = options.window ?? window
    this.callbackUri = HHC_AUTH.callbackUri
    this.window.addEventListener('message', this.onMessage)
  }

  subscribe(listener: (session: HhcSession | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    this.window.removeEventListener('message', this.onMessage)
  }

  async signIn(): Promise<void> {
    if (
      this.transaction &&
      this.transaction.expiresAt > this.now() &&
      !this.transaction.popup.closed
    ) {
      this.transaction.popup.focus()
      return
    }
    if (this.signInPromise) return this.signInPromise

    const popup = this.window.open('', 'hhc-account-auth', 'popup,width=520,height=720')
    if (!popup) throw new Error('Sign-in popup was blocked')

    this.signInPromise = this.beginSignIn(popup).finally(() => {
      this.signInPromise = null
    })
    return this.signInPromise
  }

  async getSession(): Promise<HhcSession | null> {
    const response = await this.fetcher(`${this.accountApi}/session`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'application/json' }
    })
    const data = await responseJson<SessionResponse>(response)
    if (!data.authenticated || !data.user?.id || !data.user.display_name) {
      this.clearSession()
      return null
    }

    const roles = this.accessToken ? readClaims(this.accessToken, data.user.id, this.now()) : []
    this.session = {
      userId: data.user.id,
      displayName: data.user.display_name,
      ...(data.user.avatar_url ? { avatarUrl: data.user.avatar_url } : {}),
      roles
    }
    this.notify()
    return this.session
  }

  async getAccessToken(): Promise<string | null> {
    if (this.accessToken && this.session) {
      try {
        readClaims(this.accessToken, this.session.userId, this.now())
        return this.accessToken
      } catch {
        this.accessToken = null
        this.session = { ...this.session, roles: [] }
        this.notify()
      }
    }
    const session = this.session ?? (await this.getSession())
    if (!session) return null

    const token = await this.requestAccessToken(session.userId)
    this.accessToken = token
    this.session = { ...session, roles: readClaims(token, session.userId, this.now()) }
    this.notify()
    return token
  }

  async refreshAccessToken(): Promise<string | null> {
    const session = this.session ?? (await this.getSession())
    if (!session) return null

    const token = await this.requestAccessToken(session.userId)
    this.accessToken = token
    this.session = { ...session, roles: readClaims(token, session.userId, this.now()) }
    this.notify()
    return token
  }

  async signOut(): Promise<void> {
    try {
      await responseJson(await this.protectedPost('/session/logout'))
    } finally {
      csrfTokens.delete(this.accountApi)
      this.clearSession()
    }
  }

  private async beginSignIn(popup: Window): Promise<void> {
    const state = randomValue()
    const codeVerifier = randomValue()
    const url = new URL(this.authorize)
    url.search = new URLSearchParams({
      client_id: HHC_AUTH.clientId,
      redirect_uri: this.callbackUri,
      response_type: 'code',
      code_challenge: await createPkceChallenge(codeVerifier),
      code_challenge_method: 'S256',
      scope: HHC_AUTH.scope,
      state
    }).toString()

    this.transaction = {
      state,
      codeVerifier,
      popup,
      expiresAt: this.now() + CALLBACK_TTL_MS,
      returnRoute: this.window.location.href
    }
    popup.location.href = url.toString()
  }

  private readonly onMessage = (event: MessageEvent<unknown>): void => {
    const transaction = this.transaction
    const expectedOrigin = new URL(this.callbackUri).origin
    if (
      !transaction ||
      this.now() > transaction.expiresAt ||
      event.origin !== expectedOrigin ||
      event.source !== transaction.popup ||
      !event.data ||
      typeof event.data !== 'object' ||
      !('code' in event.data) ||
      !('state' in event.data) ||
      typeof event.data.code !== 'string' ||
      typeof event.data.state !== 'string' ||
      !event.data.code ||
      event.data.state !== transaction.state
    )
      return

    this.transaction = null
    transaction.popup.close()
    void this.completeSignIn(transaction, event.data.code).catch(() => this.clearSession())
  }

  private async completeSignIn(transaction: Transaction, code: string): Promise<void> {
    const response = await this.fetcher(`${this.accountApi}/oauth/token`, {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: HHC_AUTH.clientId,
        redirect_uri: this.callbackUri,
        code_verifier: transaction.codeVerifier,
        code
      }).toString()
    })
    const data = await responseJson<TokenResponse>(response)
    if (!data.access_token) throw new Error('HHC account did not issue an access token')
    this.accessToken = data.access_token
    await this.getSession()
    if (!this.session) throw new Error('HHC account session is unavailable')
    this.session = {
      ...this.session,
      roles: readClaims(data.access_token, this.session.userId, this.now())
    }
    this.notify()
  }

  private async requestAccessToken(userId: string): Promise<string> {
    let response = await this.protectedPost('/session/access-token')
    if (response.status === 401) {
      await responseJson(await this.protectedPost('/refresh'))
      response = await this.protectedPost('/session/access-token')
    }
    const data = await responseJson<TokenResponse>(response)
    if (!data.access_token) throw new Error('HHC account did not issue an access token')
    readClaims(data.access_token, userId, this.now())
    return data.access_token
  }

  private async protectedPost(path: string, retry = true): Promise<Response> {
    const token = await this.getCsrfToken()
    const response = await this.fetcher(`${this.accountApi}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { accept: 'application/json', 'x-csrf-token': token }
    })
    if (!retry || response.status !== 403) return response

    const data = (await response
      .clone()
      .json()
      .catch(() => ({}))) as { error_code?: unknown }
    if (!csrfRejected(response, data)) return response
    csrfTokens.delete(this.accountApi)
    return this.protectedPost(path, false)
  }

  private async getCsrfToken(): Promise<string> {
    const existing = csrfTokens.get(this.accountApi)
    if (existing) return existing
    let request = csrfRequests.get(this.accountApi)
    if (!request) {
      request = this.fetcher(`${this.accountApi}/csrf-token`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { accept: 'application/json' }
      })
        .then(async (response) => {
          const data = await responseJson<{ csrf_token?: unknown }>(response)
          if (typeof data.csrf_token !== 'string' || !data.csrf_token)
            throw new Error('CSRF token missing')
          return data.csrf_token
        })
        .finally(() => {
          csrfRequests.delete(this.accountApi)
        })
      csrfRequests.set(this.accountApi, request)
    }
    const token = await request
    csrfTokens.set(this.accountApi, token)
    return token
  }

  private clearSession(): void {
    this.accessToken = null
    this.session = null
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.session)
  }
}

export function createBrowserHhcAuthAdapter(
  options?: BrowserHhcAuthOptions
): BrowserHhcAuthAdapter {
  return new BrowserHhcAuthAdapter(options)
}
