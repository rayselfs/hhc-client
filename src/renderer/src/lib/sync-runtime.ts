import { isElectron } from './env'
import { refreshLocalSyncConnection } from './local-sync-import'
import { refreshAllOneDriveFolders } from './onedrive-connect'

const LOCAL_SYNC_POLL_MS = 3_000
const ONEDRIVE_REFRESH_MS = 5 * 60_000

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

async function refreshOneDrive(): Promise<void> {
  if (oneDriveRefreshInFlight) return
  oneDriveRefreshInFlight = true
  try {
    await refreshAllOneDriveFolders()
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

  void refreshOneDrive().catch((error) => {
    console.warn('[sync] Failed to refresh OneDrive folders', error)
  })

  const oneDriveInterval = window.setInterval(() => {
    void refreshOneDrive().catch((error) => {
      console.warn('[sync] Failed to refresh OneDrive folders', error)
    })
  }, ONEDRIVE_REFRESH_MS)

  return () => {
    if (localInterval !== undefined) window.clearInterval(localInterval)
    window.clearInterval(oneDriveInterval)
  }
}
