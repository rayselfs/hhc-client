import {
  HHC_AUTH_CALLBACK_CHANNEL,
  HHC_AUTH_TRANSACTION_TTL_MS,
  type HhcAuthAdapter,
  type HhcPendingSignIn,
  type HhcSession
} from '@shared/hhc-auth'
import { HHC_AUTH } from './hhc-auth'

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
  generation: number
  timeoutId: ReturnType<typeof setTimeout> | null
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
  private readonly callbackChannel: BroadcastChannel | null
  private transaction: Transaction | null = null
  private completionInFlight: Promise<void> | null = null
  private signOutInFlight: Promise<void> | null = null
  private session: HhcSession | null = null
  private accessToken: string | null = null
  private authGeneration = 0
  private signedOut = false
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
    this.callbackChannel =
      typeof BroadcastChannel === 'undefined'
        ? null
        : new BroadcastChannel(HHC_AUTH_CALLBACK_CHANNEL)
    this.callbackChannel?.addEventListener('message', this.onBroadcast)
  }

  subscribe(listener: (session: HhcSession | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    this.authGeneration += 1
    this.closeTransaction()
    this.window.removeEventListener('message', this.onMessage)
    this.callbackChannel?.removeEventListener('message', this.onBroadcast)
    this.callbackChannel?.close()
  }

  async signIn(): Promise<HhcPendingSignIn> {
    if (this.completionInFlight || this.signOutInFlight) {
      throw new Error('HHC sign-in is already in progress')
    }

    this.authGeneration += 1
    this.closeTransaction()
    const popup = this.window.open('', 'hhc-account-auth', 'popup,width=520,height=720')
    if (!popup) throw new Error('Sign-in popup was blocked')

    this.signedOut = false
    if (this.session || this.accessToken) this.clearSession()
    return this.beginSignIn(popup, this.authGeneration)
  }

  cancelSignIn(): Promise<void> {
    if (this.transaction) {
      this.authGeneration += 1
      this.closeTransaction()
    }
    return Promise.resolve()
  }

  async getSession(): Promise<HhcSession | null> {
    const generation = this.authGeneration
    const expectedUserId = this.session?.userId ?? null
    const data = await this.requestSession()
    if (generation !== this.authGeneration || (this.session?.userId ?? null) !== expectedUserId) {
      return this.session
    }
    if (!data.authenticated || !data.user?.id || !data.user.display_name) {
      if (expectedUserId) this.authGeneration += 1
      this.clearSession()
      return null
    }
    if (this.signedOut) return null

    const identityChanged = expectedUserId !== data.user.id
    const roles =
      !identityChanged && this.accessToken
        ? readClaims(this.accessToken, data.user.id, this.now())
        : []
    if (identityChanged) {
      this.authGeneration += 1
      this.accessToken = null
    }
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
    if (this.signedOut) return null
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
    if (!session || this.signedOut) return null

    const generation = this.authGeneration
    const expectedUserId = session.userId
    const token = await this.requestAccessToken(session.userId)
    if (
      generation !== this.authGeneration ||
      this.signedOut ||
      this.session?.userId !== expectedUserId
    ) {
      return null
    }
    this.accessToken = token
    this.session = { ...session, roles: readClaims(token, session.userId, this.now()) }
    this.notify()
    return token
  }

  async refreshAccessToken(): Promise<string | null> {
    if (this.signedOut) return null
    const session = this.session ?? (await this.getSession())
    if (!session || this.signedOut) return null

    const generation = this.authGeneration
    const expectedUserId = session.userId
    const token = await this.requestAccessToken(session.userId)
    if (
      generation !== this.authGeneration ||
      this.signedOut ||
      this.session?.userId !== expectedUserId
    ) {
      return null
    }
    this.accessToken = token
    this.session = { ...session, roles: readClaims(token, session.userId, this.now()) }
    this.notify()
    return token
  }

  signOut(): Promise<void> {
    if (this.signOutInFlight) return this.signOutInFlight
    const request = this.performSignOut().finally(() => {
      if (this.signOutInFlight === request) this.signOutInFlight = null
    })
    this.signOutInFlight = request
    return request
  }

  private async performSignOut(): Promise<void> {
    const completion = this.completionInFlight
    this.authGeneration += 1
    this.signedOut = true
    this.closeTransaction()
    this.clearSession()
    if (completion) await completion.catch(() => undefined)
    try {
      await responseJson(await this.protectedPost('/session/logout'))
    } finally {
      csrfTokens.delete(this.accountApi)
    }
  }

  private async beginSignIn(popup: Window, generation: number): Promise<HhcPendingSignIn> {
    const state = randomValue()
    const codeVerifier = randomValue()
    const pending = { expiresAt: this.now() + HHC_AUTH_TRANSACTION_TTL_MS }
    const transaction: Transaction = {
      state,
      codeVerifier,
      popup,
      expiresAt: pending.expiresAt,
      returnRoute: this.window.location.href,
      generation,
      timeoutId: null
    }
    transaction.timeoutId = setTimeout(() => {
      if (this.transaction !== transaction) return
      this.authGeneration += 1
      this.closeTransaction()
    }, HHC_AUTH_TRANSACTION_TTL_MS)
    this.transaction = transaction

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
    if (generation !== this.authGeneration || this.signedOut || this.transaction !== transaction)
      return pending
    popup.location.href = url.toString()
    return pending
  }

  private readonly onMessage = (event: MessageEvent<unknown>): void => {
    const transaction = this.transaction
    const expectedOrigin = new URL(this.callbackUri).origin
    if (!transaction || event.origin !== expectedOrigin || event.source !== transaction.popup)
      return
    this.acceptCallback(event.data)
  }

  private readonly onBroadcast = (event: MessageEvent<unknown>): void => {
    this.acceptCallback(event.data)
  }

  private acceptCallback(data: unknown): void {
    const transaction = this.transaction
    if (!transaction || transaction.generation !== this.authGeneration || this.signedOut) return
    if (this.now() >= transaction.expiresAt) {
      this.authGeneration += 1
      this.closeTransaction()
      return
    }
    if (
      !data ||
      typeof data !== 'object' ||
      !('code' in data) ||
      !('state' in data) ||
      typeof data.code !== 'string' ||
      typeof data.state !== 'string' ||
      !data.code ||
      data.state !== transaction.state
    )
      return

    this.transaction = null
    if (transaction.timeoutId) clearTimeout(transaction.timeoutId)
    const completion = this.completeSignIn(transaction, data.code)
      .then((completed) => {
        this.notifyCallback(transaction, completed ? 'complete' : 'failed')
      })
      .catch((error) => {
        this.notifyCallback(transaction, 'failed')
        throw error
      })
      .finally(() => {
        if (this.completionInFlight === completion) this.completionInFlight = null
      })
    this.completionInFlight = completion
    void completion.catch(() => undefined)
  }

  private async completeSignIn(transaction: Transaction, code: string): Promise<boolean> {
    const generation = transaction.generation
    try {
      const response = await this.fetcher(`${this.accountApi}/oauth/token`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded'
        },
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
      if (generation !== this.authGeneration || this.signedOut) return false

      const sessionData = await this.requestSession()
      if (generation !== this.authGeneration || this.signedOut) return false
      if (!sessionData.authenticated || !sessionData.user?.id || !sessionData.user.display_name) {
        throw new Error('HHC account session is unavailable')
      }
      const roles = readClaims(data.access_token, sessionData.user.id, this.now())
      this.authGeneration += 1
      this.accessToken = data.access_token
      this.session = {
        userId: sessionData.user.id,
        displayName: sessionData.user.display_name,
        ...(sessionData.user.avatar_url ? { avatarUrl: sessionData.user.avatar_url } : {}),
        roles
      }
      this.notify()
      return true
    } catch (error) {
      if (generation === this.authGeneration && !this.signedOut) this.clearSession()
      throw error
    }
  }

  private notifyCallback(transaction: Transaction, status: 'complete' | 'failed'): void {
    const message = { state: transaction.state, status }
    this.callbackChannel?.postMessage(message)
    try {
      if (!transaction.popup.closed) {
        transaction.popup.postMessage(message, new URL(this.callbackUri).origin)
      }
    } catch {
      // Browser isolation may sever the popup WindowProxy; BroadcastChannel remains available.
    }
  }

  private async requestSession(): Promise<SessionResponse> {
    const response = await this.fetcher(`${this.accountApi}/session`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'application/json' }
    })
    return responseJson<SessionResponse>(response)
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

  private closeTransaction(): void {
    const transaction = this.transaction
    if (!transaction) return
    this.transaction = null
    if (transaction.timeoutId) clearTimeout(transaction.timeoutId)
    if (!transaction.popup.closed) transaction.popup.close()
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
