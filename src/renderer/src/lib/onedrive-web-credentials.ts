import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { createOneDriveRefreshTokenBody, ONEDRIVE_TOKEN_ENDPOINT } from './onedrive-auth'

interface WebOneDriveCredentialRecord {
  connectionId: string
  accessToken: string
  refreshToken: string
  expiresAt?: number
  scope?: string
  tokenType?: string
  updatedAt: number
}

interface WebOneDriveCredentialDB extends DBSchema {
  credentials: {
    key: string
    value: WebOneDriveCredentialRecord
  }
}

const DB_NAME = 'hhc-presenter-onedrive-web-credentials'
const DB_VERSION = 1
const TOKEN_EXPIRY_SKEW_MS = 60_000

let dbPromise: Promise<IDBPDatabase<WebOneDriveCredentialDB>> | null = null

function openCredentialDB(): Promise<IDBPDatabase<WebOneDriveCredentialDB>> {
  dbPromise ??= openDB<WebOneDriveCredentialDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('credentials')) {
        db.createObjectStore('credentials', { keyPath: 'connectionId' })
      }
    }
  })
  return dbPromise
}

export async function resetWebOneDriveCredentialDB(): Promise<void> {
  const db = await dbPromise
  db?.close()
  dbPromise = null
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('OneDrive credential database deletion blocked'))
  })
}

export async function saveWebOneDriveCredentials(input: {
  connectionId: string
  accessToken: string
  refreshToken: string
  expiresAt?: number
  scope?: string
  tokenType?: string
}): Promise<void> {
  const db = await openCredentialDB()
  await db.put('credentials', {
    ...input,
    updatedAt: Date.now()
  })
}

export async function deleteWebOneDriveCredentials(connectionId: string): Promise<void> {
  const db = await openCredentialDB()
  await db.delete('credentials', connectionId)
}

export async function getWebOneDriveAccessToken(input: {
  connectionId: string
  clientId: string
}): Promise<string> {
  const db = await openCredentialDB()
  const existing = await db.get('credentials', input.connectionId)
  if (!existing) throw new Error('OneDrive credentials not found')
  if (existing.expiresAt && existing.expiresAt - TOKEN_EXPIRY_SKEW_MS > Date.now()) {
    return existing.accessToken
  }

  const response = await fetch(ONEDRIVE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: createOneDriveRefreshTokenBody({
      clientId: input.clientId,
      refreshToken: existing.refreshToken
    })
  })
  if (!response.ok) throw new Error(`OneDrive token refresh failed: ${response.status}`)
  const data = (await response.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    token_type?: string
  }
  if (!data.access_token) throw new Error('Invalid OneDrive token response')
  await saveWebOneDriveCredentials({
    connectionId: input.connectionId,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? existing.refreshToken,
    expiresAt:
      typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
        ? Date.now() + data.expires_in * 1000
        : undefined,
    scope: data.scope ?? existing.scope,
    tokenType: data.token_type ?? existing.tokenType
  })
  return data.access_token
}
