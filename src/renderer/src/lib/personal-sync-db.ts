import type { PersonalMutationRequest } from '@shared/personal-cloud'
import type { FileItemRecord, FolderRecord } from '@shared/types/folder'
import { openFileExplorerDB, type FileBlobRecord } from './file-explorer-db'
import { getBlobId } from './blob-identity'
import { isElectron } from './env'
import { createResourceCleanupRecord } from './resource-cleanup-journal'
import { EDITABLE_PRESENTATION_MIME_TYPE } from './presentation-media'

export type PersonalLocalMutation =
  | { type: 'create-folder' | 'create-file'; name: string; parentId: string }
  | { type: 'replace-content' }
  | { type: 'rename'; name: string }
  | { type: 'move'; parentId: string }
  | { type: 'delete' | 'restore' }

export interface PersonalSyncNode {
  id: string
  ownerId: string
  remoteId: string
  kind: 'folder' | 'file'
  localRevision: number
  syncedLocalRevision: number
  remoteRevision: number
  lastOperationId?: string
}

export interface PersonalSyncState {
  ownerId: string
  collectionId: string
  rootId: string
  collectionRevision: number
  sequence: number
  cursor?: string
  lease?: { workerId: string; expiresAt: number }
}

export interface PersonalOutboxRecord {
  id: string
  ownerId: string
  nodeId: string
  remoteId: string
  sequence: number
  localRevision: number
  mutation: PersonalLocalMutation
  expectedRevision: number
  expectedCollectionRevision: number
  dependsOn?: string
  snapshotBlobId?: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  createdAt: number
  uploadAttempt?: number
  uploadId?: string
  submittedRequest?: PersonalMutationRequest
  failure?: string
}

export interface PersonalLocalMutationWrite {
  ownerId: string
  nodeId: string
  remoteId: string
  operationId: string
  localRevision: number
  catalog: FolderRecord | FileItemRecord
  mutation: PersonalLocalMutation
  snapshot?: FileBlobRecord
  stagingCleanupId?: string
  contentRevision?: number
}

export async function commitPersonalFileMutation(
  write: Omit<PersonalLocalMutationWrite, 'snapshot' | 'stagingCleanupId'>,
  file: File
): Promise<void> {
  if (!('type' in write.catalog)) throw new Error('Personal upload requires a file catalog item')
  if (write.catalog.size !== file.size || file.size > 200 * 1024 * 1024) {
    throw new Error('Personal file size does not match the catalog or exceeds 200 MiB')
  }
  const id = getBlobId(write.catalog)
  if (!isElectron()) {
    await commitPersonalLocalMutation({
      ...write,
      snapshot: {
        id,
        blob: file,
        storage: 'indexed-db',
        size: file.size,
        revision: write.contentRevision
      }
    })
    return
  }
  const stagingLock = `personal-blob:${id}`
  await navigator.locks.request(stagingLock, async () => {
    const db = await openFileExplorerDB()
    if (await db.get('file-blobs', id)) throw new Error('Personal snapshot already exists')
    if ((await db.getAll('resource-cleanup-journal')).some((record) => record.blobId === id)) {
      throw new Error('Personal snapshot cleanup is pending; use a new snapshot ID')
    }
    const cleanup = createResourceCleanupRecord({
      blobId: id,
      storage: 'native-fs',
      deleteNativeFile: true,
      deleteDerivedAssets: false,
      deletePdfPageThumbs: false,
      itemThumbnailIds: [],
      stagingLock
    })
    // Journal first: a crash during native import leaves a recoverable orphan.
    await db.add('resource-cleanup-journal', cleanup)
    const imported = await window.api.nativeFs.importFile(id, file)
    if (imported.size !== file.size) throw new Error('Personal native snapshot size mismatch')
    await commitPersonalLocalMutation({
      ...write,
      stagingCleanupId: cleanup.id,
      snapshot: { id, storage: 'native-fs', size: imported.size, revision: write.contentRevision }
    })
  })
}

export async function listPersonalOutbox(ownerId: string): Promise<PersonalOutboxRecord[]> {
  const db = await openFileExplorerDB()
  const records = await db.getAllFromIndex('personal-sync-outbox', 'by-owner', ownerId)
  return records.sort((a, b) => a.sequence - b.sequence)
}

export async function commitPersonalLocalMutation(
  write: PersonalLocalMutationWrite
): Promise<void> {
  if (
    !write.ownerId ||
    !write.operationId ||
    !write.remoteId ||
    write.catalog.id !== write.nodeId
  ) {
    throw new Error('Invalid personal mutation identity')
  }
  if (!Number.isSafeInteger(write.localRevision) || write.localRevision < 1) {
    throw new Error('Invalid personal local revision')
  }
  const isFile = 'type' in write.catalog
  const needsSnapshot = ['create-file', 'replace-content'].includes(write.mutation.type)
  if (needsSnapshot && (!isFile || !write.snapshot)) {
    throw new Error('Personal content mutation requires an immutable snapshot')
  }
  if (write.snapshot && !write.snapshot.blob && write.snapshot.storage !== 'native-fs') {
    throw new Error('Personal snapshot content is missing')
  }

  const db = await openFileExplorerDB()
  const tx = db.transaction(
    [
      'file-blobs',
      'folder-records',
      'folder-items',
      'personal-sync-nodes',
      'personal-sync-outbox',
      'personal-sync-state',
      'resource-cleanup-journal'
    ],
    'readwrite'
  )
  try {
    const nodes = tx.objectStore('personal-sync-nodes')
    const states = tx.objectStore('personal-sync-state')
    const [node, state] = await Promise.all([nodes.get(write.nodeId), states.get(write.ownerId)])
    if (!state || (node && node.ownerId !== write.ownerId)) {
      throw new Error('Personal owner does not match the local collection')
    }
    if (node && node.remoteId !== write.remoteId)
      throw new Error('Personal remote identity changed')
    if (write.localRevision !== (node?.localRevision ?? 0) + 1) {
      throw new Error('Personal local revision is stale')
    }
    const isCreate =
      write.mutation.type === 'create-file' || write.mutation.type === 'create-folder'
    if (isCreate === Boolean(node) || (node && node.kind !== (isFile ? 'file' : 'folder'))) {
      throw new Error('Personal mutation does not match the existing node')
    }
    const existingCatalog = await tx
      .objectStore(isFile ? 'folder-items' : 'folder-records')
      .get(write.nodeId)
    if (!node && existingCatalog) throw new Error('Personal node collides with an existing item')
    if (write.catalog.parentId !== state.rootId) {
      const parent = write.catalog.parentId ? await nodes.get(write.catalog.parentId) : undefined
      if (!parent || parent.ownerId !== write.ownerId || parent.kind !== 'folder') {
        throw new Error('Personal parent belongs to a different owner or is missing')
      }
    }

    if (write.snapshot) {
      if (!('type' in write.catalog) || getBlobId(write.catalog) !== write.snapshot.id) {
        throw new Error('Personal catalog must reference its immutable snapshot')
      }
      // add, never put: an upload snapshot cannot be overwritten by a later edit.
      await tx.objectStore('file-blobs').add({ ...write.snapshot, refCount: 2 })
      if (existingCatalog && 'type' in existingCatalog && existingCatalog.type === 'file') {
        const previous = await tx.objectStore('file-blobs').get(getBlobId(existingCatalog))
        if (previous) {
          await tx.objectStore('file-blobs').put({
            ...previous,
            refCount: Math.max(0, (previous.refCount ?? 1) - 1)
          })
        }
      }
    }
    if ('type' in write.catalog) {
      await tx.objectStore('folder-items').put({ ...write.catalog, expiresAt: null })
    } else {
      await tx.objectStore('folder-records').put({ ...write.catalog, expiresAt: null })
    }
    const renameAfterContent =
      write.mutation.type === 'replace-content' &&
      existingCatalog &&
      'name' in existingCatalog &&
      existingCatalog.name !== write.catalog.name
    const lastOperationId = renameAfterContent ? `${write.operationId}:rename` : write.operationId
    await nodes.put({
      id: write.nodeId,
      ownerId: write.ownerId,
      remoteId: write.remoteId,
      kind: isFile ? 'file' : 'folder',
      localRevision: write.localRevision,
      syncedLocalRevision: node?.syncedLocalRevision ?? 0,
      remoteRevision: node?.remoteRevision ?? 0,
      lastOperationId
    })
    await tx.objectStore('personal-sync-outbox').add({
      id: write.operationId,
      ownerId: write.ownerId,
      nodeId: write.nodeId,
      remoteId: write.remoteId,
      sequence: state.sequence + 1,
      localRevision: write.localRevision,
      mutation: write.mutation,
      expectedRevision: node?.remoteRevision ?? 0,
      expectedCollectionRevision: state.collectionRevision,
      dependsOn: node?.lastOperationId,
      snapshotBlobId: write.snapshot?.id,
      ...('type' in write.catalog && write.snapshot
        ? {
            fileName:
              write.catalog.mimeType === EDITABLE_PRESENTATION_MIME_TYPE &&
              !/\.lpdeck$/i.test(write.catalog.name)
                ? `${write.catalog.name}.lpdeck`
                : write.catalog.name,
            mimeType: write.catalog.mimeType,
            sizeBytes: write.catalog.size
          }
        : {}),
      createdAt: Date.now()
    })
    if (renameAfterContent) {
      await tx.objectStore('personal-sync-outbox').add({
        id: lastOperationId,
        ownerId: write.ownerId,
        nodeId: write.nodeId,
        remoteId: write.remoteId,
        sequence: state.sequence + 2,
        localRevision: write.localRevision,
        mutation: { type: 'rename', name: write.catalog.name },
        expectedRevision: 0,
        expectedCollectionRevision: state.collectionRevision,
        dependsOn: write.operationId,
        createdAt: Date.now()
      })
    }
    await states.put({ ...state, sequence: state.sequence + (renameAfterContent ? 2 : 1) })
    if (write.stagingCleanupId) {
      await tx.objectStore('resource-cleanup-journal').delete(write.stagingCleanupId)
    }
    await tx.done
  } catch (error) {
    try {
      tx.abort()
    } catch {
      /* The failing request may have already aborted the transaction. */
    }
    await tx.done.catch(() => undefined)
    throw error
  }
}

export async function acknowledgePersonalOperation(
  ownerId: string,
  operationId: string,
  result: { itemId: string; nodeRevision: number; collectionRevision: number },
  signal?: AbortSignal,
  workerId?: string
): Promise<void> {
  signal?.throwIfAborted()
  if (
    !Number.isSafeInteger(result.nodeRevision) ||
    result.nodeRevision < 1 ||
    !Number.isSafeInteger(result.collectionRevision) ||
    result.collectionRevision < result.nodeRevision
  ) {
    throw new Error('Invalid personal mutation acknowledgement')
  }
  const db = await openFileExplorerDB()
  const tx = db.transaction(
    ['personal-sync-nodes', 'personal-sync-state', 'personal-sync-outbox', 'file-blobs'],
    'readwrite'
  )
  const abort = (): void => {
    try {
      tx.abort()
    } catch {
      /* Already committed or aborted. */
    }
  }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    signal?.throwIfAborted()
    const outbox = tx.objectStore('personal-sync-outbox')
    const operation = await outbox.get(operationId)
    if (!operation) {
      await tx.done
      return
    }
    if (operation.ownerId !== ownerId || operation.remoteId !== result.itemId) {
      throw new Error('Personal acknowledgement owner or item does not match')
    }
    const nodes = tx.objectStore('personal-sync-nodes')
    const states = tx.objectStore('personal-sync-state')
    const [node, state, pending] = await Promise.all([
      nodes.get(operation.nodeId),
      states.get(ownerId),
      outbox.index('by-owner').getAll(ownerId)
    ])
    if (!node || !state || node.ownerId !== ownerId) throw new Error('Personal owner is missing')
    if (workerId) assertPersonalSyncLease(state, workerId)
    if (pending.some((entry) => entry.sequence < operation.sequence)) {
      throw new Error('Personal acknowledgements must follow outbox order')
    }
    await outbox.delete(operationId)
    const remaining = pending.filter((entry) => entry.id !== operationId)
    for (const next of remaining) {
      let updated = next
      if (next.dependsOn === operationId) {
        updated = { ...updated, dependsOn: undefined, expectedRevision: result.nodeRevision }
      }
      // Only advance a folder command past our own next revision, never unseen remote changes.
      if (
        result.collectionRevision === state.collectionRevision + 1 &&
        next.expectedCollectionRevision === state.collectionRevision
      ) {
        updated = { ...updated, expectedCollectionRevision: result.collectionRevision }
      }
      if (updated !== next) await outbox.put(updated)
    }
    const outstandingRevision = Math.min(
      ...remaining.filter((entry) => entry.nodeId === node.id).map((entry) => entry.localRevision)
    )
    await nodes.put({
      ...node,
      remoteRevision: Math.max(node.remoteRevision, result.nodeRevision),
      syncedLocalRevision: Math.max(
        node.syncedLocalRevision,
        Math.min(operation.localRevision, outstandingRevision - 1)
      ),
      lastOperationId: node.lastOperationId === operationId ? undefined : node.lastOperationId
    })
    await states.put({
      ...state,
      collectionRevision: Math.max(state.collectionRevision, result.collectionRevision)
    })
    if (operation.snapshotBlobId) {
      const blobs = tx.objectStore('file-blobs')
      const snapshot = await blobs.get(operation.snapshotBlobId)
      if (snapshot)
        await blobs.put({ ...snapshot, refCount: Math.max(0, (snapshot.refCount ?? 1) - 1) })
    }
    signal?.throwIfAborted()
    if (workerId) assertPersonalSyncLease(state, workerId)
    await tx.done
  } catch (error) {
    abort()
    await tx.done.catch(() => undefined)
    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
  }
}

export const PERSONAL_SYNC_LEASE_MS = 30_000

export function assertPersonalSyncLease(state: PersonalSyncState, workerId: string): void {
  if (state.lease?.workerId !== workerId || state.lease.expiresAt <= Date.now()) {
    throw new Error('Personal sync lease expired or changed')
  }
}

async function updatePersonalSyncLease(
  ownerId: string,
  workerId: string,
  mode: 'acquire' | 'renew' | 'release'
): Promise<boolean> {
  if (!ownerId || !workerId) throw new Error('Missing personal sync lease identity')
  const db = await openFileExplorerDB()
  const tx = db.transaction('personal-sync-state', 'readwrite')
  const state = await tx.store.get(ownerId)
  const now = Date.now()
  const owned = state?.lease?.workerId === workerId
  const active = (state?.lease?.expiresAt ?? 0) > now
  const allowed =
    state && (mode === 'acquire' ? !active || owned : owned && (mode === 'release' || active))
  if (allowed) {
    await tx.store.put({
      ...state,
      lease: mode === 'release' ? undefined : { workerId, expiresAt: now + PERSONAL_SYNC_LEASE_MS }
    })
  }
  await tx.done
  return Boolean(allowed)
}

export function acquirePersonalSyncLease(ownerId: string, workerId: string): Promise<boolean> {
  return updatePersonalSyncLease(ownerId, workerId, 'acquire')
}

export function renewPersonalSyncLease(ownerId: string, workerId: string): Promise<boolean> {
  return updatePersonalSyncLease(ownerId, workerId, 'renew')
}

export async function releasePersonalSyncLease(ownerId: string, workerId: string): Promise<void> {
  await updatePersonalSyncLease(ownerId, workerId, 'release')
}

export async function updatePersonalOperationTransfer(
  ownerId: string,
  workerId: string,
  operationId: string,
  update: Pick<PersonalOutboxRecord, 'uploadAttempt' | 'uploadId' | 'submittedRequest' | 'failure'>,
  signal: AbortSignal
): Promise<PersonalOutboxRecord> {
  signal.throwIfAborted()
  const db = await openFileExplorerDB()
  const tx = db.transaction(['personal-sync-state', 'personal-sync-outbox'], 'readwrite')
  try {
    const state = await tx.objectStore('personal-sync-state').get(ownerId)
    if (!state) throw new Error('Personal owner is missing')
    assertPersonalSyncLease(state, workerId)
    const outbox = tx.objectStore('personal-sync-outbox')
    const operation = await outbox.get(operationId)
    if (!operation || operation.ownerId !== ownerId)
      throw new Error('Personal operation is missing')
    if (
      operation.submittedRequest &&
      (('submittedRequest' in update &&
        JSON.stringify(operation.submittedRequest) !== JSON.stringify(update.submittedRequest)) ||
        ('uploadId' in update && operation.uploadId !== update.uploadId) ||
        ('uploadAttempt' in update && operation.uploadAttempt !== update.uploadAttempt))
    ) {
      throw new Error('Submitted personal mutation is immutable')
    }
    const next = { ...operation, ...update }
    await outbox.put(next)
    signal.throwIfAborted()
    assertPersonalSyncLease(state, workerId)
    await tx.done
    return next
  } catch (error) {
    try {
      tx.abort()
    } catch {
      /* Already aborted. */
    }
    await tx.done.catch(() => undefined)
    throw error
  }
}
