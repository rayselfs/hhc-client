import type { HhcSession } from '@shared/hhc-auth'
import type { FolderRecord } from '@shared/types/folder'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { isElectron } from './env'
import { refreshLocalSyncConnection } from './local-sync-import'
import { refreshAllOneDriveFolders, type OneDriveRefreshSummary } from './onedrive-connect'
import {
  getCloudProviderAdapter,
  type CloudRefreshSummary,
  type HhcLineCloudAuth
} from './cloud-provider'
import { listProviderConnectionsByType, type ProviderConnectionRecord } from './sync-db'

const LOCAL_SYNC_POLL_MS = 3_000
const ONEDRIVE_IDLE_REFRESH_MS = 60_000
const ONEDRIVE_ACTIVE_REFRESH_MS = 15_000

const localRefreshInFlight = new Set<string>()
let oneDriveRefreshInFlight = false
const hhcRefreshInFlight = new Set<string>()
const hhcAuthBlockedForSession = new Map<string, HhcSession>()
const hhcRevokedRoots = new Map<string, FolderRecord>()

export interface SyncRuntimeOptions {
  hhcAuth?: HhcLineCloudAuth
  onHhcAccessRevoked?: (input: {
    connectionId: string
    rootFolderId: string
  }) => void | Promise<void>
}

interface RefreshTimingSummary {
  changedCount?: number
  pendingFileCount?: number
  retryableFileCount?: number
  nextRetryAt?: number
}

interface HhcRefreshResult {
  summaries: CloudRefreshSummary[]
  retrySoon: boolean
}

async function refreshLocalConnection(connectionId: string): Promise<void> {
  if (localRefreshInFlight.has(connectionId)) return
  localRefreshInFlight.add(connectionId)
  try {
    await refreshLocalSyncConnection(connectionId)
  } finally {
    localRefreshInFlight.delete(connectionId)
  }
}

async function refreshAllLocalSyncFolders(): Promise<void> {
  if (!isElectron() || !window.api?.localSync) return
  const connections = await window.api.localSync.listFolders()
  for (const connection of connections) {
    await refreshLocalConnection(connection.id)
    await window.api.localSync.startWatch(connection.id).catch(() => undefined)
  }
}

async function refreshLocalSyncIfDirty(): Promise<void> {
  if (!isElectron() || !window.api?.localSync) return
  const connections = await window.api.localSync.listFolders()
  for (const connection of connections) {
    const status = await window.api.localSync.getWatchStatus(connection.id).catch(() => null)
    if (!status || status.state === 'idle') {
      await window.api.localSync.startWatch(connection.id).catch(() => undefined)
      continue
    }
    if (status.state === 'rescan-needed' || status.state === 'overflow-rescan') {
      await refreshLocalConnection(connection.id)
      await window.api.localSync.startWatch(connection.id).catch(() => undefined)
    }
  }
}

function getNextCloudDelay(summaries: RefreshTimingSummary[], now = Date.now()): number {
  const nextRetryAt = summaries
    .map((summary) => summary.nextRetryAt)
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b)[0]
  if (nextRetryAt !== undefined) {
    return Math.max(
      ONEDRIVE_ACTIVE_REFRESH_MS,
      Math.min(ONEDRIVE_IDLE_REFRESH_MS, nextRetryAt - now)
    )
  }
  const hasActiveWork = summaries.some(
    (summary) =>
      (summary.changedCount ?? 0) > 0 ||
      (summary.pendingFileCount ?? 0) > 0 ||
      (summary.retryableFileCount ?? 0) > 0
  )
  return hasActiveWork ? ONEDRIVE_ACTIVE_REFRESH_MS : ONEDRIVE_IDLE_REFRESH_MS
}

async function refreshOneDrive(): Promise<OneDriveRefreshSummary[]> {
  if (oneDriveRefreshInFlight) return []
  oneDriveRefreshInFlight = true
  try {
    return await refreshAllOneDriveFolders()
  } finally {
    oneDriveRefreshInFlight = false
  }
}

function classifyHhcError(
  error: unknown
): 'retryable' | 'offline' | 'auth-required' | 'access-revoked' | 'fatal' {
  if (error instanceof TypeError) return 'offline'
  if (error && typeof error === 'object' && 'classification' in error) {
    const classification = error.classification
    if (
      classification === 'retryable' ||
      classification === 'auth-required' ||
      classification === 'access-revoked' ||
      classification === 'fatal'
    ) {
      return classification
    }
  }
  return 'fatal'
}

function activeHhcRoots(connectionId: string): FolderRecord[] {
  return Object.values(useFileExplorerStore.getState().folders).filter(
    (folder) =>
      !folder.deletedAt &&
      folder.syncLink?.providerType === 'hhc-line' &&
      folder.syncLink.providerConnectionId === connectionId &&
      folder.syncLink.status === 'active'
  )
}

function revokedRootKey(connectionId: string, rootFolderId: string): string {
  return `${connectionId}\0${rootFolderId}`
}

async function refreshHhcConnection(
  connection: ProviderConnectionRecord,
  roots: FolderRecord[],
  session: HhcSession,
  options: SyncRuntimeOptions
): Promise<HhcRefreshResult> {
  const auth = options.hhcAuth
  if (!auth || hhcRefreshInFlight.has(connection.id)) return { summaries: [], retrySoon: false }

  const blockedSession = hhcAuthBlockedForSession.get(connection.id)
  if (blockedSession === session) return { summaries: [], retrySoon: false }
  if (blockedSession) hhcAuthBlockedForSession.delete(connection.id)

  hhcRefreshInFlight.add(connection.id)
  const summaries: CloudRefreshSummary[] = []
  let retrySoon = false
  try {
    const adapter = getCloudProviderAdapter('hhc-line', auth)
    for (const root of roots) {
      if (auth.getSession()?.userId !== session.userId) break
      const key = revokedRootKey(connection.id, root.id)
      if (hhcRevokedRoots.has(key)) continue
      try {
        summaries.push(await adapter.refreshFolder(root.id))
      } catch (error) {
        const classification = classifyHhcError(error)
        if (classification === 'auth-required') {
          hhcAuthBlockedForSession.set(connection.id, session)
          break
        }
        if (classification === 'access-revoked') {
          hhcRevokedRoots.set(key, root)
          try {
            await options.onHhcAccessRevoked?.({
              connectionId: connection.id,
              rootFolderId: root.id
            })
          } catch {
            console.warn('[sync] Failed to handle revoked HHC LINE root')
          }
          continue
        }
        if (classification === 'retryable' || classification === 'offline') {
          retrySoon = true
          continue
        }
        console.warn('[sync] Failed to refresh HHC LINE root')
      }
    }
  } finally {
    hhcRefreshInFlight.delete(connection.id)
  }
  return { summaries, retrySoon }
}

async function refreshAllHhcFolders(options: SyncRuntimeOptions): Promise<HhcRefreshResult> {
  const auth = options.hhcAuth
  const session = auth?.getSession()
  if (!auth || !session) return { summaries: [], retrySoon: false }

  const connections = (await listProviderConnectionsByType('hhc-line')).filter(
    (connection) => connection.accountUserId === session.userId
  )
  if (auth.getSession()?.userId !== session.userId) return { summaries: [], retrySoon: false }

  const folders = useFileExplorerStore.getState().folders
  for (const [key, revokedRoot] of hhcRevokedRoots) {
    const current = folders[revokedRoot.id]
    if (!current || current !== revokedRoot || current.syncLink?.status !== 'active') {
      hhcRevokedRoots.delete(key)
    }
  }

  const results = await Promise.all(
    connections.map((connection) =>
      refreshHhcConnection(connection, activeHhcRoots(connection.id), session, options)
    )
  )
  return {
    summaries: results.flatMap((result) => result.summaries),
    retrySoon: results.some((result) => result.retrySoon)
  }
}

export function startSyncRuntime(options: SyncRuntimeOptions = {}): () => void {
  let localInterval: number | undefined
  if (isElectron()) {
    void refreshAllLocalSyncFolders().catch((error) => {
      console.warn('[sync] Failed to start local sync runtime', error)
    })
    localInterval = window.setInterval(() => {
      void refreshLocalSyncIfDirty().catch((error) => {
        console.warn('[sync] Failed to refresh local sync folders', error)
      })
    }, LOCAL_SYNC_POLL_MS)
  }

  let stopped = false
  let cloudTimeout: number | undefined

  const scheduleCloudRefresh = (delay: number): void => {
    if (stopped) return
    cloudTimeout = window.setTimeout(() => {
      void runCloudRefresh()
    }, delay)
  }

  const runCloudRefresh = async (): Promise<void> => {
    const [oneDrive, hhc] = await Promise.all([
      refreshOneDrive()
        .then((summaries) => ({ summaries, retrySoon: false }))
        .catch((error) => {
          console.warn('[sync] Failed to refresh OneDrive folders', error)
          return { summaries: [] as OneDriveRefreshSummary[], retrySoon: true }
        }),
      refreshAllHhcFolders(options).catch(() => {
        console.warn('[sync] Failed to enumerate HHC LINE roots')
        return { summaries: [] as CloudRefreshSummary[], retrySoon: true }
      })
    ])
    const summaries = [...oneDrive.summaries, ...hhc.summaries]
    scheduleCloudRefresh(
      oneDrive.retrySoon || hhc.retrySoon
        ? ONEDRIVE_ACTIVE_REFRESH_MS
        : getNextCloudDelay(summaries)
    )
  }

  void runCloudRefresh()

  return () => {
    stopped = true
    if (localInterval !== undefined) window.clearInterval(localInterval)
    if (cloudTimeout !== undefined) window.clearTimeout(cloudTimeout)
  }
}
