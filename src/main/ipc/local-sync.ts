import { app, dialog, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path'
import type { LocalSyncConnectionInfo, LocalSyncRemoteItem } from '../../shared/ipc-channels'
import type { WindowManager } from '../windowManager'
import { isMainWindow } from './validate'

interface StoredLocalSyncConnection extends LocalSyncConnectionInfo {
  rootPath: string
}

interface LocalSyncDirent {
  name: string
  isDirectory: () => boolean
  isFile: () => boolean
  isSymbolicLink: () => boolean
}

const CONFIG_FILE_NAME = 'local-sync-connections.json'
const MAX_SCAN_ITEMS = 10_000
const CONNECTION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILE_NAME)
}

function toInfo(connection: StoredLocalSyncConnection): LocalSyncConnectionInfo {
  return {
    id: connection.id,
    displayName: connection.displayName,
    rootName: connection.rootName,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt
  }
}

async function readConnections(): Promise<StoredLocalSyncConnection[]> {
  try {
    const raw = await fs.readFile(getConfigPath(), 'utf8')
    const parsed = JSON.parse(raw) as StoredLocalSyncConnection[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (connection) =>
        typeof connection.id === 'string' &&
        isValidConnectionId(connection.id) &&
        typeof connection.rootPath === 'string' &&
        typeof connection.displayName === 'string'
    )
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    return []
  }
}

async function writeConnections(connections: StoredLocalSyncConnection[]): Promise<void> {
  const configPath = getConfigPath()
  const temporaryPath = `${configPath}.${process.pid}.tmp`
  await fs.mkdir(dirname(configPath), { recursive: true })
  await fs.writeFile(temporaryPath, JSON.stringify(connections, null, 2), 'utf8')
  await fs.rename(temporaryPath, configPath)
}

function isValidConnectionId(value: string): boolean {
  return CONNECTION_ID_PATTERN.test(value)
}

function isSameOrNested(candidate: string, existing: string): boolean {
  const rel = relative(existing, candidate)
  return rel === '' || (!!rel && !rel.startsWith('..') && !isAbsolute(rel))
}

function isSensitiveDirectory(candidate: string): boolean {
  const root = resolve('/')
  const home = resolve(app.getPath('home'))
  const sensitiveSubtrees = [resolve(app.getPath('userData')), resolve(app.getPath('temp'))]
  return (
    candidate === root ||
    candidate === home ||
    sensitiveSubtrees.some((dir) => candidate === dir || isSameOrNested(candidate, dir))
  )
}

async function validateSelectedDirectory(
  selectedPath: string,
  existing: StoredLocalSyncConnection[]
): Promise<string> {
  if (!isAbsolute(selectedPath)) throw new Error('Local sync directory must be absolute')
  const rootPath = await fs.realpath(selectedPath)
  const stat = await fs.stat(rootPath)
  if (!stat.isDirectory()) throw new Error('Local sync selection is not a directory')
  if (isSensitiveDirectory(rootPath)) throw new Error('Local sync directory is not allowed')

  for (const connection of existing) {
    if (
      isSameOrNested(rootPath, connection.rootPath) ||
      isSameOrNested(connection.rootPath, rootPath)
    ) {
      throw new Error('Local sync directory overlaps an existing connection')
    }
  }
  return rootPath
}

async function validateConnectedDirectory(rootPath: string): Promise<void> {
  const stat = await fs.stat(rootPath)
  if (!stat.isDirectory()) throw new Error('Local sync directory is unavailable')
}

function remoteIdForRelativePath(relativePath: string): string {
  return Buffer.from(relativePath || '.').toString('base64url')
}

function isRecoverableScanError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'EACCES' || code === 'EPERM' || code === 'ENOENT' || code === 'ENOTDIR'
}

async function scanDirectory(
  rootPath: string,
  currentPath = rootPath,
  parentRemoteItemId: string | null = null,
  items: LocalSyncRemoteItem[] = []
): Promise<LocalSyncRemoteItem[]> {
  if (items.length >= MAX_SCAN_ITEMS) return items
  let entries: LocalSyncDirent[]
  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true })
  } catch (error) {
    if (currentPath !== rootPath && isRecoverableScanError(error)) return items
    throw error
  }
  for (const entry of entries) {
    if (items.length >= MAX_SCAN_ITEMS) break
    if (entry.isSymbolicLink()) continue
    const fullPath = join(currentPath, entry.name)
    const relativePath = relative(rootPath, fullPath)
    const remoteItemId = remoteIdForRelativePath(relativePath)
    if (entry.isDirectory()) {
      items.push({
        remoteItemId,
        parentRemoteItemId,
        kind: 'folder',
        name: entry.name
      })
      await scanDirectory(rootPath, fullPath, remoteItemId, items)
    } else if (entry.isFile()) {
      let stat: Awaited<ReturnType<typeof fs.stat>>
      try {
        stat = await fs.stat(fullPath)
      } catch (error) {
        if (isRecoverableScanError(error)) continue
        throw error
      }
      items.push({
        remoteItemId,
        parentRemoteItemId,
        kind: 'file',
        name: entry.name,
        size: stat.size,
        etag: `${stat.mtimeMs}:${stat.size}`
      })
    }
  }
  return items
}

export function registerLocalSyncHandlers(wm: WindowManager): void {
  ipcMain.handle(
    'local-sync:select-folder',
    async (event): Promise<LocalSyncConnectionInfo | null> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized local sync access')
      const result = await dialog.showOpenDialog({
        title: 'Select local folder to sync',
        properties: ['openDirectory']
      })
      if (result.canceled || result.filePaths.length === 0) return null

      const connections = await readConnections()
      const rootPath = await validateSelectedDirectory(result.filePaths[0], connections)
      const now = Date.now()
      const connection: StoredLocalSyncConnection = {
        id: randomUUID(),
        rootPath,
        rootName: basename(rootPath),
        displayName: basename(rootPath),
        createdAt: now,
        updatedAt: now
      }
      await writeConnections([...connections, connection])
      return toInfo(connection)
    }
  )

  ipcMain.handle('local-sync:list-folders', async (event): Promise<LocalSyncConnectionInfo[]> => {
    if (!isMainWindow(wm, event)) throw new Error('Unauthorized local sync access')
    return (await readConnections()).map(toInfo)
  })

  ipcMain.handle(
    'local-sync:scan-folder',
    async (event, connectionId: unknown): Promise<LocalSyncRemoteItem[]> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized local sync access')
      if (typeof connectionId !== 'string' || !isValidConnectionId(connectionId)) {
        throw new Error('Invalid local sync connection id')
      }
      const connection = (await readConnections()).find(
        (candidate) => candidate.id === connectionId
      )
      if (!connection) throw new Error('Local sync connection not found')
      await validateConnectedDirectory(connection.rootPath)
      return scanDirectory(connection.rootPath)
    }
  )

  ipcMain.handle(
    'local-sync:disconnect-folder',
    async (event, connectionId: unknown): Promise<void> => {
      if (!isMainWindow(wm, event)) throw new Error('Unauthorized local sync access')
      if (typeof connectionId !== 'string' || !isValidConnectionId(connectionId)) {
        throw new Error('Invalid local sync connection id')
      }
      const connections = await readConnections()
      await writeConnections(connections.filter((connection) => connection.id !== connectionId))
    }
  )
}
