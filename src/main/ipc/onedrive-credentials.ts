import { app, ipcMain, safeStorage } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { OneDriveCredentialStatus } from '@shared/ipc-channels'
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

  ipcMain.handle('onedrive:delete-credentials', async (event, connectionId: unknown) => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized OneDrive credential access')
    const validConnectionId = validateConnectionId(connectionId)
    await fs.rm(getCredentialPath(validConnectionId), { force: true })
  })
}
