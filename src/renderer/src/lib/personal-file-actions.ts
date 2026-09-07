import type { FileItemRecord, FolderRecord } from '@shared/types/folder'
import type { PersonalSpace } from '@shared/personal-cloud'
import { openFileExplorerDB } from './file-explorer-db'
import { commitPersonalFileMutation, commitPersonalLocalMutation } from './personal-sync-db'
import { resolveUniqueName } from './file-naming'
import { usePersonalSyncStore } from '@renderer/stores/personal-sync'
import {
  FILE_EXPLORER_ROOT_ID,
  publishPersistedFileItem,
  refreshPersonalCatalog
} from '@renderer/stores/file-explorer'

function activeOwner(): string {
  const ownerId = usePersonalSyncStore.getState().activeOwnerId
  if (!ownerId) throw new Error('Personal account is unavailable')
  return ownerId
}

export async function ensurePersonalLocalSpace(
  ownerId: string,
  space: PersonalSpace,
  signal: AbortSignal
): Promise<void> {
  signal.throwIfAborted()
  if (activeOwner() !== ownerId) throw new Error('Personal account changed')
  const db = await openFileExplorerDB()
  const tx = db.transaction(['personal-sync-state', 'folder-records'], 'readwrite')
  try {
    const state = await tx.objectStore('personal-sync-state').get(ownerId)
    if (state && state.collectionId !== space.id)
      throw new Error('Personal collection identity changed')
    if (!state) {
      const rootId = `personal:${space.id}`
      await tx.objectStore('personal-sync-state').add({
        ownerId,
        collectionId: space.id,
        rootId,
        collectionRevision: 0,
        sequence: 0
      })
      await tx.objectStore('folder-records').add({
        id: rootId,
        personalOwnerId: ownerId,
        name: 'Cloud folder',
        parentId: FILE_EXPLORER_ROOT_ID,
        sortIndex: -1,
        createdAt: Date.now(),
        expiresAt: null
      })
    }
    signal.throwIfAborted()
    if (activeOwner() !== ownerId) throw new Error('Personal account changed')
    await tx.done
    await refreshPersonalCatalog(ownerId)
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

async function personalParent(
  parentId: string
): Promise<{ ownerId: string; remoteParentId: string }> {
  const ownerId = activeOwner()
  const db = await openFileExplorerDB()
  const [state, parent] = await Promise.all([
    db.get('personal-sync-state', ownerId),
    db.get('folder-records', parentId)
  ])
  if (!state || !parent || parent.personalOwnerId !== ownerId || parent.deletedAt) {
    throw new Error('Personal destination is unavailable')
  }
  if (parentId === state.rootId) return { ownerId, remoteParentId: '' }
  const node = await db.get('personal-sync-nodes', parentId)
  if (node?.ownerId !== ownerId || node.kind !== 'folder')
    throw new Error('Invalid personal destination')
  return { ownerId, remoteParentId: node.remoteId }
}

async function uniqueName(name: string, parentId: string): Promise<string> {
  const db = await openFileExplorerDB()
  const [folders, items] = await Promise.all([
    db.getAllFromIndex('folder-records', 'by-parent', parentId),
    db.getAllFromIndex('folder-items', 'by-parent', parentId)
  ])
  return resolveUniqueName(
    name.trim().normalize('NFC'),
    [...folders, ...items]
      .filter((entry) => !entry.deletedAt && 'name' in entry)
      .map((entry) => ('name' in entry ? entry.name : ''))
  )
}

async function publish(ownerId: string): Promise<void> {
  if (usePersonalSyncStore.getState().activeOwnerId !== ownerId) return
  await refreshPersonalCatalog(ownerId)
  if (usePersonalSyncStore.getState().activeOwnerId !== ownerId) return
  usePersonalSyncStore.setState({ syncStatus: 'pending', errorCode: null })
  window.dispatchEvent(new CustomEvent('hhc:personal-sync', { detail: ownerId }))
}

export async function createPersonalFolder(name: string, parentId: string): Promise<string> {
  const { ownerId, remoteParentId } = await personalParent(parentId)
  const id = crypto.randomUUID()
  const catalog: FolderRecord = {
    id,
    personalOwnerId: ownerId,
    parentId,
    name: await uniqueName(name, parentId),
    sortIndex: Date.now(),
    createdAt: Date.now(),
    expiresAt: null
  }
  await commitPersonalLocalMutation({
    ownerId,
    nodeId: id,
    remoteId: id,
    localRevision: 1,
    operationId: crypto.randomUUID(),
    catalog,
    mutation: { type: 'create-folder', name: catalog.name, parentId: remoteParentId }
  })
  await publish(ownerId)
  return id
}

export async function createPersonalFile(
  file: File,
  parentId: string,
  mimeType = file.type
): Promise<string> {
  const { ownerId, remoteParentId } = await personalParent(parentId)
  const id = crypto.randomUUID()
  const catalog: FileItemRecord = {
    id,
    personalOwnerId: ownerId,
    parentId,
    name: await uniqueName(file.name, parentId),
    type: 'file',
    mimeType,
    size: file.size,
    url: `blob:${crypto.randomUUID()}`,
    sortIndex: Date.now(),
    createdAt: Date.now(),
    expiresAt: null
  }
  await commitPersonalFileMutation(
    {
      ownerId,
      nodeId: id,
      remoteId: id,
      localRevision: 1,
      operationId: crypto.randomUUID(),
      catalog,
      mutation: { type: 'create-file', name: catalog.name, parentId: remoteParentId }
    },
    file
  )
  await publish(ownerId)
  return id
}

export async function mutatePersonalNode(
  id: string,
  mutation:
    | { type: 'rename'; name: string }
    | { type: 'move'; parentId: string }
    | { type: 'delete' }
    | { type: 'restore'; name?: string }
): Promise<void> {
  const ownerId = activeOwner()
  const db = await openFileExplorerDB()
  const node = await db.get('personal-sync-nodes', id)
  const state = await db.get('personal-sync-state', ownerId)
  if (!node || !state || node.ownerId !== ownerId) throw new Error('Personal node is unavailable')
  const stored =
    node.kind === 'folder' ? await db.get('folder-records', id) : await db.get('folder-items', id)
  if (!stored || ('type' in stored && stored.type !== 'file'))
    throw new Error('Personal catalog is missing')
  let catalog = stored
  let operation
  switch (mutation.type) {
    case 'rename':
      catalog = { ...stored, name: mutation.name.trim().normalize('NFC') }
      operation = { type: 'rename' as const, name: catalog.name }
      break
    case 'move': {
      const destination = await personalParent(mutation.parentId)
      if (destination.ownerId !== ownerId) throw new Error('Personal account changed')
      catalog = { ...stored, parentId: mutation.parentId }
      operation = { type: 'move' as const, parentId: destination.remoteParentId }
      break
    }
    case 'delete':
      catalog = { ...stored, deletedAt: Date.now(), originalParentId: stored.parentId ?? undefined }
      operation = { type: 'delete' as const }
      break
    case 'restore': {
      const originalParent = stored.parentId
        ? await db.get('folder-records', stored.parentId)
        : undefined
      const parentId =
        originalParent && !originalParent.deletedAt ? originalParent.id : state.rootId
      catalog = {
        ...stored,
        name: mutation.name?.trim().normalize('NFC') ?? stored.name,
        parentId,
        deletedAt: undefined,
        originalParentId: undefined
      }
      operation = { type: 'restore' as const, ...(mutation.name ? { name: catalog.name } : {}) }
      break
    }
  }
  await commitPersonalLocalMutation({
    ownerId,
    nodeId: id,
    remoteId: node.remoteId,
    localRevision: node.localRevision + 1,
    operationId: crypto.randomUUID(),
    catalog,
    mutation: operation
  })
  await publish(ownerId)
}

export async function setPersonalFileNotes(id: string, notes: string | undefined): Promise<void> {
  const ownerId = activeOwner()
  const db = await openFileExplorerDB()
  const tx = db.transaction(['personal-sync-nodes', 'folder-items'], 'readwrite')
  try {
    const node = await tx.objectStore('personal-sync-nodes').get(id)
    const item = await tx.objectStore('folder-items').get(id)
    if (node?.ownerId !== ownerId || item?.type !== 'file')
      throw new Error('Personal file is unavailable')
    // File projection notes are local settings; pulls preserve them independently of cloud content.
    const updated = { ...item, notes }
    await tx.objectStore('folder-items').put(updated)
    await tx.done
    if (usePersonalSyncStore.getState().activeOwnerId === ownerId) publishPersistedFileItem(updated)
  } catch (error) {
    try {
      tx.abort()
    } catch {
      /* Already completed. */
    }
    await tx.done.catch(() => undefined)
    throw error
  }
}
