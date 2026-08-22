import { app, ipcMain, net, safeStorage, shell } from 'electron'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { APP_CONFIG } from '@shared/app-config'
import type { HhcSession } from '@shared/hhc-auth'
import type { LibrePresenterProtocolAction } from '../protocol-router'
import type { WindowManager } from '../windowManager'
import { isMainWindow } from './validate'

const CLIENT_ID = 'hhc-desktop'
const REDIRECT_URI = 'librepresenter://auth/account'
const SCOPE = 'openid profile'
const TRANSACTION_TTL_MS = 5 * 60_000

type AccountAuthAction = Extract<LibrePresenterProtocolAction, { kind: 'account-auth' }>

type StoredCredential = {
  installationId: string
  refreshToken?: string
}

type AccessCredential = {
  token: string
  subject: string
  roles: string[]
  expiresAt: number
}

type Transaction = {
  state: string
  codeVerifier: string
  expiresAt: number
}

type HhcAuthServiceOptions = {
  now?: () => number
}

export interface HhcAuthService {
  begin(): Promise<void>
  completeProtocolCallback(action: AccountAuthAction): Promise<boolean>
  getAccessToken(): Promise<string | null>
  refreshAccessToken(): Promise<string | null>
  getSession(): Promise<HhcSession | null>
  signOut(): Promise<void>
  subscribe(listener: (session: HhcSession | null) => void): () => void
}

function secureStorageAvailable(): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'
}

function parseStoredCredential(value: unknown): StoredCredential {
  if (!value || typeof value !== 'object') throw new Error('Invalid HHC credential record')
  const record = value as Record<string, unknown>
  if (typeof record.installationId !== 'string' || !record.installationId) {
    throw new Error('Invalid HHC credential record')
  }
  if (
    record.refreshToken !== undefined &&
    (typeof record.refreshToken !== 'string' || !record.refreshToken)
  ) {
    throw new Error('Invalid HHC credential record')
  }
  return {
    installationId: record.installationId,
    ...(record.refreshToken ? { refreshToken: record.refreshToken } : {})
  }
}

function parseAccessCredential(token: string, now: number): AccessCredential {
  const encoded = token.split('.')[1]
  if (!encoded) throw new Error('Invalid HHC access token')

  let claims: Record<string, unknown>
  try {
    claims = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >
  } catch {
    throw new Error('Invalid HHC access token')
  }
  if (
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    !Array.isArray(claims.roles) ||
    !claims.roles.every((role) => typeof role === 'string') ||
    typeof claims.exp !== 'number' ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now / 1000
  ) {
    throw new Error('Invalid HHC access token claims')
  }
  return {
    token,
    subject: claims.sub,
    roles: claims.roles,
    expiresAt: claims.exp * 1000
  }
}

async function responseJson(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`HHC account request failed (${response.status})`)
  try {
    return (await response.json()) as Record<string, unknown>
  } catch {
    throw new Error('Invalid HHC account response')
  }
}

class MainHhcAuthService implements HhcAuthService {
  private readonly accountApi = `${APP_CONFIG.hhcAccountOrigin}/api/account/v1`
  private readonly credentialPath = join(app.getPath('userData'), 'hhc-auth.enc')
  private readonly now: () => number
  private readonly listeners = new Set<(session: HhcSession | null) => void>()
  private transaction: Transaction | null = null
  private beginInFlight: Promise<void> | null = null
  private completionInFlight: Promise<boolean> | null = null
  private refreshInFlight: Promise<string | null> | null = null
  private signOutInFlight: Promise<void> | null = null
  private storedCredential: StoredCredential | null = null
  private storedCredentialLoaded = false
  private accessCredential: AccessCredential | null = null
  private session: HhcSession | null = null

  constructor(options: HhcAuthServiceOptions) {
    this.now = options.now ?? Date.now
  }

  async begin(): Promise<void> {
    if (
      this.beginInFlight ||
      this.completionInFlight ||
      this.signOutInFlight ||
      (this.transaction && this.transaction.expiresAt > this.now())
    ) {
      throw new Error('HHC sign-in is already in progress')
    }
    if (this.transaction) this.transaction = null

    this.beginInFlight = this.startAuthorization().finally(() => {
      this.beginInFlight = null
    })
    return this.beginInFlight
  }

  completeProtocolCallback(action: AccountAuthAction): Promise<boolean> {
    if (this.signOutInFlight) return Promise.resolve(false)
    const transaction = this.transaction
    if (!transaction || transaction.expiresAt <= this.now()) {
      this.transaction = null
      return Promise.resolve(false)
    }
    if (action.state !== transaction.state) return Promise.resolve(false)
    this.transaction = null

    const completion = this.finishProtocolCallback(action, transaction).finally(() => {
      if (this.completionInFlight === completion) this.completionInFlight = null
    })
    this.completionInFlight = completion
    return completion
  }

  private async finishProtocolCallback(
    action: AccountAuthAction,
    transaction: Transaction
  ): Promise<boolean> {
    const credential = await this.loadCredential(true)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code_verifier: transaction.codeVerifier,
      code: action.code,
      device_id: credential.installationId,
      device_name: this.deviceName()
    })
    const data = await this.requestToken(body)
    await this.acceptTokenResponse(data, credential)
    await this.loadSessionFromAccessToken()
    return true
  }

  async getAccessToken(): Promise<string | null> {
    if (this.signOutInFlight) return null
    if (this.accessCredential && this.accessCredential.expiresAt > this.now()) {
      if (!this.session) await this.loadSessionFromAccessToken()
      return this.accessCredential.token
    }
    this.accessCredential = null
    if (this.refreshInFlight) return this.refreshInFlight

    this.refreshInFlight = this.refreshStoredCredential().finally(() => {
      this.refreshInFlight = null
    })
    return this.refreshInFlight
  }

  async refreshAccessToken(): Promise<string | null> {
    if (this.signOutInFlight) return null
    const completion = this.completionInFlight
    if (completion) await completion
    if (this.signOutInFlight) return null
    if (this.refreshInFlight) return this.refreshInFlight

    this.refreshInFlight = this.refreshStoredCredential().finally(() => {
      this.refreshInFlight = null
    })
    return this.refreshInFlight
  }

  async getSession(): Promise<HhcSession | null> {
    if (this.session && this.accessCredential && this.accessCredential.expiresAt > this.now()) {
      return this.session
    }
    if (this.accessCredential && this.accessCredential.expiresAt > this.now()) {
      return this.loadSessionFromAccessToken()
    }
    const token = await this.getAccessToken()
    return token ? this.session : null
  }

  signOut(): Promise<void> {
    if (this.signOutInFlight) return this.signOutInFlight
    this.transaction = null
    const beginInFlight = this.beginInFlight
    const completionInFlight = this.completionInFlight
    this.signOutInFlight = this.performSignOut(beginInFlight, completionInFlight).finally(() => {
      this.signOutInFlight = null
    })
    return this.signOutInFlight
  }

  private async performSignOut(
    beginInFlight: Promise<void> | null,
    completionInFlight: Promise<boolean> | null
  ): Promise<void> {
    if (beginInFlight) await beginInFlight.catch(() => undefined)
    this.transaction = null
    if (completionInFlight) await completionInFlight.catch(() => false)
    if (this.refreshInFlight) await this.refreshInFlight.catch(() => null)
    const credential = await this.loadCredential(false)
    if (!credential) {
      this.clearMemory()
      return
    }

    if (credential.refreshToken) {
      try {
        await net.fetch(`${this.accountApi}/oauth/revoke`, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            token: credential.refreshToken,
            client_id: CLIENT_ID,
            token_type_hint: 'refresh_token'
          })
        })
      } catch {
        // Local sign-out remains authoritative when the remote service is unavailable.
      }
    }

    await this.saveCredential({ installationId: credential.installationId })
    this.clearMemory()
  }

  subscribe(listener: (session: HhcSession | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private async startAuthorization(): Promise<void> {
    await this.loadCredential(true)
    const codeVerifier = randomBytes(32).toString('base64url')
    const state = randomBytes(32).toString('base64url')
    const url = new URL(`${this.accountApi}/oauth/authorize`)
    url.search = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      code_challenge: createHash('sha256').update(codeVerifier).digest('base64url'),
      code_challenge_method: 'S256',
      scope: SCOPE,
      state
    }).toString()
    this.transaction = { state, codeVerifier, expiresAt: this.now() + TRANSACTION_TTL_MS }
    try {
      await shell.openExternal(url.toString())
    } catch (error) {
      this.transaction = null
      throw error
    }
  }

  private async refresh(credential: StoredCredential): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: CLIENT_ID,
      refresh_token: credential.refreshToken!,
      device_id: credential.installationId,
      device_name: this.deviceName()
    })
    let data: Record<string, unknown>
    try {
      data = await this.requestToken(body)
      await this.acceptTokenResponse(data, credential)
    } catch (error) {
      if (
        error instanceof Error &&
        /^HHC account request failed \((400|401)\)$/.test(error.message)
      ) {
        await this.clearStoredRefreshToken(credential)
      }
      throw error
    }
    await this.loadSessionFromAccessToken()
    return this.accessCredential!.token
  }

  private async refreshStoredCredential(): Promise<string | null> {
    const credential = await this.loadCredential(false)
    return credential?.refreshToken ? this.refresh(credential) : null
  }

  private async requestToken(body: URLSearchParams): Promise<Record<string, unknown>> {
    return responseJson(
      await net.fetch(`${this.accountApi}/oauth/token`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/x-www-form-urlencoded'
        },
        body
      })
    )
  }

  private async acceptTokenResponse(
    data: Record<string, unknown>,
    credential: StoredCredential
  ): Promise<void> {
    if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string') {
      throw new Error('Invalid HHC token response')
    }
    const accessCredential = parseAccessCredential(data.access_token, this.now())
    await this.saveCredential({
      installationId: credential.installationId,
      refreshToken: data.refresh_token
    })
    this.accessCredential = accessCredential
    this.session = null
  }

  private async loadSessionFromAccessToken(): Promise<HhcSession> {
    const access = this.accessCredential
    if (!access || access.expiresAt <= this.now()) throw new Error('HHC access token expired')
    const data = await responseJson(
      await net.fetch(`${this.accountApi}/me`, {
        method: 'GET',
        headers: { accept: 'application/json', authorization: `Bearer ${access.token}` }
      })
    )
    if (typeof data.id !== 'string' || data.id !== access.subject) {
      const credential = await this.loadCredential(false)
      if (credential) await this.clearStoredRefreshToken(credential)
      this.clearMemory()
      throw new Error('HHC account identity mismatch')
    }

    const firstName = typeof data.first_name === 'string' ? data.first_name.trim() : ''
    const lastName = typeof data.last_name === 'string' ? data.last_name.trim() : ''
    const email = typeof data.email === 'string' ? data.email.trim() : ''
    const displayName = [firstName, lastName].filter(Boolean).join(' ') || email
    if (!displayName) throw new Error('Invalid HHC account profile')

    this.session = {
      userId: access.subject,
      displayName,
      ...(typeof data.avatar_url === 'string' && data.avatar_url
        ? { avatarUrl: data.avatar_url }
        : {}),
      roles: access.roles
    }
    this.notify()
    return this.session
  }

  private async loadCredential(create: true): Promise<StoredCredential>
  private async loadCredential(create: false): Promise<StoredCredential | null>
  private async loadCredential(create: boolean): Promise<StoredCredential | null> {
    if (!secureStorageAvailable()) throw new Error('Secure credential storage is unavailable')
    if (this.storedCredentialLoaded) {
      if (this.storedCredential) return this.storedCredential
      if (!create) return null
    } else {
      try {
        const encrypted = await fs.readFile(this.credentialPath)
        this.storedCredential = parseStoredCredential(
          JSON.parse(safeStorage.decryptString(encrypted))
        )
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
        this.storedCredential = null
      }
      this.storedCredentialLoaded = true
    }

    if (!this.storedCredential && create) {
      await this.saveCredential({ installationId: randomUUID() })
    }
    return this.storedCredential
  }

  private async saveCredential(credential: StoredCredential): Promise<void> {
    if (!secureStorageAvailable()) throw new Error('Secure credential storage is unavailable')
    const temporaryPath = `${this.credentialPath}.${process.pid}.${Date.now()}.tmp`
    await fs.mkdir(dirname(this.credentialPath), { recursive: true })
    try {
      const encrypted = safeStorage.encryptString(JSON.stringify(credential))
      await fs.writeFile(temporaryPath, encrypted, { mode: 0o600 })
      await fs.rename(temporaryPath, this.credentialPath)
      this.storedCredential = credential
      this.storedCredentialLoaded = true
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  private async clearStoredRefreshToken(credential: StoredCredential): Promise<void> {
    await this.saveCredential({ installationId: credential.installationId })
    this.clearMemory()
  }

  private clearMemory(): void {
    this.accessCredential = null
    this.session = null
    this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.session)
  }

  private deviceName(): string {
    return `LibrePresenter Electron (${process.platform})`
  }
}

export function createHhcAuthService(options: HhcAuthServiceOptions = {}): HhcAuthService {
  return new MainHhcAuthService(options)
}

export function registerHhcAuthIpc(wm: WindowManager, service: HhcAuthService): void {
  const authorized =
    <T>(handler: () => Promise<T>) =>
    async (event: Electron.IpcMainInvokeEvent): Promise<T> => {
      if (!isMainWindow(wm, event)) {
        throw new Error('Unauthorized HHC authentication access')
      }
      return handler()
    }

  ipcMain.handle(
    'hhc-auth:begin',
    authorized(() => service.begin())
  )
  ipcMain.handle(
    'hhc-auth:get-access-token',
    authorized(() => service.getAccessToken())
  )
  ipcMain.handle(
    'hhc-auth:refresh-access-token',
    authorized(() => service.refreshAccessToken())
  )
  ipcMain.handle(
    'hhc-auth:get-session',
    authorized(() => service.getSession())
  )
  ipcMain.handle(
    'hhc-auth:sign-out',
    authorized(() => service.signOut())
  )
  service.subscribe((session) => wm.sendToMain('hhc-auth:session-changed', session))
}
