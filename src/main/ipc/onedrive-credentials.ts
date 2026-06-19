import { app, ipcMain, net, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type {
  OneDriveAccessTokenRequest,
  OneDriveAccessTokenResult,
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
const ONEDRIVE_TOKEN_ENDPOINT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'

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
    'onedrive:save-credentials',
    async (event, input: unknown): Promise<OneDriveCredentialStatus> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized OneDrive credential access')
      const credential = normalizeCredential(input)
      await writeCredential(credential)
      return toStatus(credential)
    }
  )

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

  ipcMain.handle('onedrive:delete-credentials', async (event, connectionId: unknown) => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized OneDrive credential access')
    const validConnectionId = validateConnectionId(connectionId)
    await fs.rm(getCredentialPath(validConnectionId), { force: true })
  })
}
