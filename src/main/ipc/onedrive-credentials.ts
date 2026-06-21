import { app, ipcMain, net, safeStorage } from 'electron'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { createServer, type Server } from 'http'
import { join } from 'path'
import type {
  OneDriveAccessTokenRequest,
  OneDriveAccessTokenResult,
  OneDriveAuthCodeExchangeRequest,
  OneDriveAuthCallbackSession,
  OneDriveConnectedAccount,
  OneDriveCredentialStatus
} from '@shared/ipc-channels'
import type { WindowManager } from '../windowManager'
import { isMainWindow } from './validate'

interface StoredOneDriveCredential {
  connectionId: string
  accessToken?: string
  refreshToken: string
  expiresAt?: number
  scope?: string
  tokenType?: 'Bearer'
  updatedAt: number
}

const CONNECTION_ID_PATTERN = /^onedrive:[A-Za-z0-9._~-]{1,160}$/
const CLIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ONEDRIVE_TOKEN_ENDPOINT = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const MICROSOFT_GRAPH_ME_ENDPOINT = 'https://graph.microsoft.com/v1.0/me'
const ONEDRIVE_CALLBACK_PATH = '/onedrive-callback'
const AUTH_CALLBACK_TIMEOUT_MS = 5 * 60_000

interface OneDriveAccountProfile {
  id?: unknown
  displayName?: unknown
  userPrincipalName?: unknown
  mail?: unknown
}

interface AuthCallbackState {
  server: Server
  redirectUri: string
  resolve: (url: string | null) => void
  promise: Promise<string | null>
  timeout: NodeJS.Timeout
}

const authCallbacks = new Map<string, AuthCallbackState>()

function validateConnectionId(connectionId: unknown): string {
  if (
    typeof connectionId !== 'string' ||
    !CONNECTION_ID_PATTERN.test(connectionId) ||
    connectionId.includes('..')
  ) {
    throw new Error('Invalid OneDrive connection id')
  }
  return connectionId
}

function validateClientId(clientId: unknown): string {
  if (typeof clientId !== 'string' || !CLIENT_ID_PATTERN.test(clientId.trim())) {
    throw new Error('Invalid OneDrive Client ID')
  }
  return clientId.trim()
}

function validateCallbackId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/i.test(value)) {
    throw new Error('Invalid OneDrive auth callback id')
  }
  return value
}

function closeAuthCallback(callbackId: string, result: string | null): void {
  const state = authCallbacks.get(callbackId)
  if (!state) return
  authCallbacks.delete(callbackId)
  clearTimeout(state.timeout)
  state.server.close(() => undefined)
  state.resolve(result)
}

function startAuthCallbackServer(): Promise<OneDriveAuthCallbackSession> {
  const callbackId = randomUUID()
  let resolvePromise: (url: string | null) => void = () => undefined
  const promise = new Promise<string | null>((resolve) => {
    resolvePromise = resolve
  })
  const server = createServer((req, res) => {
    const host = req.headers.host
    const url = new URL(req.url ?? '/', `http://${host ?? 'localhost'}`)
    if (url.pathname !== ONEDRIVE_CALLBACK_PATH) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(
      '<!doctype html><title>LibrePresenter</title><body><p>OneDrive sign-in completed. You can close this window.</p></body>'
    )
    closeAuthCallback(callbackId, url.toString())
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, 'localhost', () => {
      server.off('error', reject)
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => undefined)
        reject(new Error('Unable to start OneDrive auth callback server'))
        return
      }
      const redirectUri = `http://localhost:${address.port}${ONEDRIVE_CALLBACK_PATH}`
      const timeout = setTimeout(() => {
        closeAuthCallback(callbackId, null)
      }, AUTH_CALLBACK_TIMEOUT_MS)
      authCallbacks.set(callbackId, {
        server,
        redirectUri,
        resolve: resolvePromise,
        promise,
        timeout
      })
      resolve({ callbackId, redirectUri })
    })
  })
}

function getCredentialDir(): string {
  return join(app.getPath('userData'), 'onedrive-credentials')
}

function getCredentialPath(connectionId: string): string {
  return join(getCredentialDir(), `${encodeURIComponent(connectionId)}.enc`)
}

function normalizeCredential(input: unknown): StoredOneDriveCredential {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid OneDrive credential payload')
  }
  const value = input as Record<string, unknown>
  const connectionId = validateConnectionId(value.connectionId)
  if (typeof value.refreshToken !== 'string' || value.refreshToken.trim().length === 0) {
    throw new Error('Invalid OneDrive refresh token')
  }
  if (value.accessToken !== undefined && typeof value.accessToken !== 'string') {
    throw new Error('Invalid OneDrive access token')
  }
  if (
    value.expiresAt !== undefined &&
    (typeof value.expiresAt !== 'number' || !Number.isFinite(value.expiresAt))
  ) {
    throw new Error('Invalid OneDrive token expiry')
  }
  if (value.scope !== undefined && typeof value.scope !== 'string') {
    throw new Error('Invalid OneDrive token scope')
  }

  return {
    connectionId,
    accessToken: value.accessToken,
    refreshToken: value.refreshToken,
    expiresAt: value.expiresAt,
    scope: value.scope,
    tokenType: value.tokenType === 'Bearer' ? 'Bearer' : undefined,
    updatedAt: Date.now()
  }
}

function normalizeAccessTokenRequest(input: unknown): OneDriveAccessTokenRequest {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid OneDrive access token request')
  }
  const value = input as Record<string, unknown>
  return {
    connectionId: validateConnectionId(value.connectionId),
    clientId: validateClientId(value.clientId)
  }
}

function normalizeAuthCodeExchangeRequest(input: unknown): OneDriveAuthCodeExchangeRequest {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid OneDrive auth code exchange request')
  }
  const value = input as Record<string, unknown>
  if (typeof value.redirectUri !== 'string' || !value.redirectUri.startsWith('http://localhost:')) {
    throw new Error('Invalid OneDrive redirect URI')
  }
  if (typeof value.code !== 'string' || value.code.trim().length === 0) {
    throw new Error('Invalid OneDrive auth code')
  }
  if (typeof value.codeVerifier !== 'string' || value.codeVerifier.trim().length === 0) {
    throw new Error('Invalid OneDrive code verifier')
  }
  return {
    clientId: validateClientId(value.clientId),
    redirectUri: value.redirectUri,
    code: value.code,
    codeVerifier: value.codeVerifier
  }
}

function normalizeTokenResponse(input: unknown): {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  scope?: string
  tokenType?: 'Bearer'
} {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Invalid OneDrive token response')
  }
  const value = input as Record<string, unknown>
  if (typeof value.access_token !== 'string' || value.access_token.trim().length === 0) {
    throw new Error('Invalid OneDrive access token response')
  }
  if (value.refresh_token !== undefined && typeof value.refresh_token !== 'string') {
    throw new Error('Invalid OneDrive refresh token response')
  }
  if (value.expires_in !== undefined && typeof value.expires_in !== 'number') {
    throw new Error('Invalid OneDrive token expiry response')
  }
  if (value.scope !== undefined && typeof value.scope !== 'string') {
    throw new Error('Invalid OneDrive token scope response')
  }

  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token,
    expiresAt:
      typeof value.expires_in === 'number' && Number.isFinite(value.expires_in)
        ? Date.now() + value.expires_in * 1000
        : undefined,
    scope: value.scope,
    tokenType: value.token_type === 'Bearer' ? 'Bearer' : undefined
  }
}

function toStatus(credential: StoredOneDriveCredential | null): OneDriveCredentialStatus {
  if (!credential) return { hasRefreshToken: false }
  return {
    hasRefreshToken: true,
    expiresAt: credential.expiresAt,
    scope: credential.scope
  }
}

async function readCredential(connectionId: string): Promise<StoredOneDriveCredential | null> {
  try {
    const encrypted = await fs.readFile(getCredentialPath(connectionId))
    const decrypted = safeStorage.decryptString(encrypted)
    const parsed = JSON.parse(decrypted) as unknown
    return normalizeCredential(parsed)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

async function writeCredential(credential: StoredOneDriveCredential): Promise<void> {
  const dir = getCredentialDir()
  await fs.mkdir(dir, { recursive: true })
  const targetPath = getCredentialPath(credential.connectionId)
  const temporaryPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`
  const encrypted = safeStorage.encryptString(JSON.stringify(credential))
  try {
    await fs.writeFile(temporaryPath, encrypted)
    await fs.rename(temporaryPath, targetPath)
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

async function exchangeAuthCode(request: OneDriveAuthCodeExchangeRequest): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt?: number
  scope?: string
  tokenType?: 'Bearer'
}> {
  const body = new URLSearchParams()
  body.set('client_id', request.clientId)
  body.set('grant_type', 'authorization_code')
  body.set('code', request.code)
  body.set('redirect_uri', request.redirectUri)
  body.set('code_verifier', request.codeVerifier)
  body.set('scope', 'offline_access User.Read Files.Read')

  const response = await net.fetch(ONEDRIVE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!response.ok) throw new Error(`OneDrive token exchange failed: ${response.status}`)

  const token = normalizeTokenResponse(await response.json())
  if (!token.refreshToken) throw new Error('Invalid OneDrive token response')
  return {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
    scope: token.scope,
    tokenType: token.tokenType
  }
}

function normalizeAccountProfile(input: OneDriveAccountProfile): OneDriveConnectedAccount {
  if (typeof input.id !== 'string' || input.id.trim().length === 0) {
    throw new Error('Invalid OneDrive account profile')
  }
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : ''
  const userPrincipalName =
    typeof input.userPrincipalName === 'string' ? input.userPrincipalName.trim() : ''
  const mail = typeof input.mail === 'string' ? input.mail.trim() : ''
  const accountLabel = userPrincipalName || mail || displayName || undefined

  return {
    id: `onedrive:${input.id.trim()}`,
    providerType: 'onedrive',
    displayName: displayName ? `OneDrive - ${displayName}` : 'OneDrive',
    accountLabel
  }
}

async function fetchConnectedAccount(accessToken: string): Promise<OneDriveConnectedAccount> {
  const response = await net.fetch(MICROSOFT_GRAPH_ME_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!response.ok) throw new Error(`OneDrive profile fetch failed: ${response.status}`)
  return normalizeAccountProfile((await response.json()) as OneDriveAccountProfile)
}

async function completeAuth(
  request: OneDriveAuthCodeExchangeRequest
): Promise<OneDriveConnectedAccount> {
  const token = await exchangeAuthCode(request)
  const account = await fetchConnectedAccount(token.accessToken)
  const connectionId = validateConnectionId(account.id)
  await writeCredential({
    connectionId,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: token.expiresAt,
    scope: token.scope,
    tokenType: token.tokenType,
    updatedAt: Date.now()
  })
  return account
}

async function refreshAccessToken(
  credential: StoredOneDriveCredential,
  clientId: string
): Promise<OneDriveAccessTokenResult> {
  const body = new URLSearchParams()
  body.set('client_id', clientId)
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', credential.refreshToken)
  body.set('scope', 'offline_access User.Read Files.Read')

  const response = await net.fetch(ONEDRIVE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!response.ok) throw new Error(`OneDrive token refresh failed: ${response.status}`)

  const token = normalizeTokenResponse(await response.json())
  const updatedCredential: StoredOneDriveCredential = {
    ...credential,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken ?? credential.refreshToken,
    expiresAt: token.expiresAt,
    scope: token.scope,
    tokenType: token.tokenType,
    updatedAt: Date.now()
  }
  await writeCredential(updatedCredential)

  return {
    accessToken: token.accessToken,
    expiresAt: token.expiresAt,
    scope: token.scope,
    tokenType: token.tokenType
  }
}

export function registerOneDriveCredentialHandlers(wm: WindowManager): void {
  ipcMain.handle(
    'onedrive:get-credential-status',
    async (event, connectionId: unknown): Promise<OneDriveCredentialStatus> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized OneDrive credential access')
      const validConnectionId = validateConnectionId(connectionId)
      return toStatus(await readCredential(validConnectionId))
    }
  )

  ipcMain.handle(
    'onedrive:get-access-token',
    async (event, input: unknown): Promise<OneDriveAccessTokenResult> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized OneDrive credential access')
      const request = normalizeAccessTokenRequest(input)
      const credential = await readCredential(request.connectionId)
      if (!credential) throw new Error('OneDrive credentials not found')
      return refreshAccessToken(credential, request.clientId)
    }
  )

  ipcMain.handle(
    'onedrive:complete-auth',
    async (event, input: unknown): Promise<OneDriveConnectedAccount> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized OneDrive credential access')
      return completeAuth(normalizeAuthCodeExchangeRequest(input))
    }
  )

  ipcMain.handle('onedrive:delete-credentials', async (event, connectionId: unknown) => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized OneDrive credential access')
    const validConnectionId = validateConnectionId(connectionId)
    await fs.rm(getCredentialPath(validConnectionId), { force: true })
  })

  ipcMain.handle(
    'onedrive:start-auth-callback',
    async (event): Promise<OneDriveAuthCallbackSession> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized OneDrive credential access')
      return startAuthCallbackServer()
    }
  )

  ipcMain.handle('onedrive:wait-auth-callback', async (event, callbackId: unknown) => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized OneDrive credential access')
    const state = authCallbacks.get(validateCallbackId(callbackId))
    if (!state) return null
    return state.promise
  })

  ipcMain.handle('onedrive:cancel-auth-callback', async (event, callbackId: unknown) => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized OneDrive credential access')
    closeAuthCallback(validateCallbackId(callbackId), null)
  })
}
