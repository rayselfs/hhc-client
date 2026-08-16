import type { FolderRecord } from '@shared/types/folder'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import type { HhcLineCloudAuth } from './cloud-provider'
import { openFileExplorerDB } from './file-explorer-db'
import { cancelSyncDownloadsAndWait } from './sync-download-queue'
import { getSyncEntryByRemoteItem } from './sync-db'
import { unlinkHhcLineAccountFromApp, unlinkSyncRootFolderFromApp } from './sync-unlink'

type HhcLineAccessScope =
  | { kind: 'account'; accountUserId: string }
  | {
      kind: 'root'
      providerConnectionId: string
      rootFolderId?: string
      rootRemoteFolderId?: string
      remoteItemId?: string
    }

type HhcLineAccessError = {
  classification?: unknown
  status?: unknown
}

const accountCleanups = new Map<string, Promise<void>>()
const rootCleanups = new Map<string, Promise<void>>()

function clearContentLeases(): Promise<void> {
  return window.api?.hhcAssets?.clearContentLeases?.() ?? Promise.resolve()
}

function updateRootStatus(root: FolderRecord): FolderRecord {
  const updated = {
    ...root,
    syncLink: root.syncLink ? { ...root.syncLink, status: 'access-revoked' as const } : undefined
  }
  useFileExplorerStore.setState((state) => {
    const folders = { ...state.folders, [updated.id]: updated }
    return {
      folders,
      _foldersArray: Object.values(folders),
      _childFoldersByParent: Object.fromEntries(
        Object.entries(state._childFoldersByParent).map(([parentId, children]) => [
          parentId,
          children.map((child) => (child.id === updated.id ? updated : child))
        ])
      )
    }
  })
  return updated
}

function findRoot(
  providerConnectionId: string,
  rootRemoteFolderId: string
): FolderRecord | undefined {
  return Object.values(useFileExplorerStore.getState().folders).find(
    (folder) =>
      folder.syncLink?.providerType === 'hhc-line' &&
      folder.syncLink.providerConnectionId === providerConnectionId &&
      folder.syncLink.remoteFolderId === rootRemoteFolderId
  )
}

async function resolveRootRemoteFolderId(
  scope: Extract<HhcLineAccessScope, { kind: 'root' }>
): Promise<string | undefined> {
  if (scope.rootRemoteFolderId) return scope.rootRemoteFolderId
  if (!scope.remoteItemId) return undefined
  const entry = await getSyncEntryByRemoteItem(scope.providerConnectionId, scope.remoteItemId)
  return entry?.parentRemoteItemId ?? (entry?.kind === 'folder' ? entry.remoteItemId : undefined)
}

export function cleanupHhcLineAccountAccess(accountUserId: string): Promise<void> {
  const existing = accountCleanups.get(accountUserId)
  if (existing) return existing
  const cleanup = Promise.all([clearContentLeases(), unlinkHhcLineAccountFromApp(accountUserId)])
    .then(() => undefined)
    .finally(() => {
      if (accountCleanups.get(accountUserId) === cleanup) accountCleanups.delete(accountUserId)
    })
  accountCleanups.set(accountUserId, cleanup)
  return cleanup
}

export async function revokeHhcLineRootAccess(
  scope: Extract<HhcLineAccessScope, { kind: 'root' }>
): Promise<void> {
  const rootById = scope.rootFolderId
    ? useFileExplorerStore.getState().folders[scope.rootFolderId]
    : undefined
  const rootRemoteFolderId =
    rootById?.syncLink?.remoteFolderId ?? (await resolveRootRemoteFolderId(scope))
  if (!rootRemoteFolderId) return
  const key = `${scope.providerConnectionId}\0${rootRemoteFolderId}`
  const existing = rootCleanups.get(key)
  if (existing) return existing

  const cleanup = (async () => {
    const root = rootById ?? findRoot(scope.providerConnectionId, rootRemoteFolderId)
    if (!root?.syncLink) return
    const revokedRoot = updateRootStatus(root)
    await (await openFileExplorerDB()).put('folder-records', revokedRoot)
    await cancelSyncDownloadsAndWait({
      providerConnectionId: scope.providerConnectionId,
      rootRemoteFolderId
    })
    await Promise.all([clearContentLeases(), unlinkSyncRootFolderFromApp(revokedRoot)])
  })().finally(() => {
    if (rootCleanups.get(key) === cleanup) rootCleanups.delete(key)
  })
  rootCleanups.set(key, cleanup)
  return cleanup
}

export async function handleHhcLineAccessError(
  auth: Pick<HhcLineCloudAuth, 'getSession' | 'endSession'>,
  scope: HhcLineAccessScope,
  error: unknown
): Promise<void> {
  const classified = error as HhcLineAccessError
  if (classified.classification === 'auth-required') {
    await auth.endSession()
    return
  }
  if (classified.classification !== 'access-revoked' || classified.status !== 403) return
  if (scope.kind === 'account') {
    await cleanupHhcLineAccountAccess(scope.accountUserId)
    return
  }
  await revokeHhcLineRootAccess(scope)
}

export async function isHhcLineRootAuthorized(
  auth: Pick<HhcLineCloudAuth, 'getSession'>,
  providerConnectionId: string,
  rootRemoteFolderId: string
): Promise<boolean> {
  const session = auth.getSession()
  if (!session || providerConnectionId !== `hhc-line:${session.userId}`) return false
  return findRoot(providerConnectionId, rootRemoteFolderId)?.syncLink?.status === 'active'
}
