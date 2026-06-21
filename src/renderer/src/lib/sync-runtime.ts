import { isElectron } from './env'
import { refreshLocalSyncConnection } from './local-sync-import'
import { refreshAllOneDriveFolders, type OneDriveRefreshSummary } from './onedrive-connect'

const LOCAL_SYNC_POLL_MS = 3_000
const ONEDRIVE_IDLE_REFRESH_MS = 5 * 60_000
const ONEDRIVE_ACTIVE_REFRESH_MS = 15_000

const localRefreshInFlight = new Set<string>()
let oneDriveRefreshInFlight = false

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

function getNextOneDriveDelay(summaries: OneDriveRefreshSummary[], now = Date.now()): number {
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
      summary.changedCount > 0 || summary.pendingFileCount > 0 || summary.retryableFileCount > 0
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

export function startSyncRuntime(): () => void {
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
  let oneDriveTimeout: number | undefined

  const scheduleOneDrive = (delay: number): void => {
    if (stopped) return
    oneDriveTimeout = window.setTimeout(() => {
      void runOneDriveRefresh()
    }, delay)
  }

  const runOneDriveRefresh = async (): Promise<void> => {
    try {
      const summaries = await refreshOneDrive()
      scheduleOneDrive(getNextOneDriveDelay(summaries))
    } catch (error) {
      console.warn('[sync] Failed to refresh OneDrive folders', error)
      scheduleOneDrive(ONEDRIVE_ACTIVE_REFRESH_MS)
    }
  }

  void runOneDriveRefresh()

  return () => {
    stopped = true
    if (localInterval !== undefined) window.clearInterval(localInterval)
    if (oneDriveTimeout !== undefined) window.clearTimeout(oneDriveTimeout)
  }
}
