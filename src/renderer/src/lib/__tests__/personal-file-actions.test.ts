import { beforeEach, expect, it, vi } from 'vitest'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import {
  createPersonalFolder,
  ensurePersonalLocalSpace,
  mutatePersonalNode,
  togglePersonalFolderFavorite
} from '../personal-file-actions'
import { usePersonalSyncStore } from '../../stores/personal-sync'
import { createExplorerFolder, useFileExplorerStore } from '../../stores/file-explorer'
import { listPersonalOutbox } from '../personal-sync-db'

beforeEach(async () => {
  usePersonalSyncStore.getState().setAccount('anonymous')
  await resetFileExplorerDBForTests()
  usePersonalSyncStore.getState().setAccount('authenticated', 'alice')
  await ensurePersonalLocalSpace(
    'alice',
    { id: 'space', revision: 100 },
    new AbortController().signal
  )
})

it('keeps local favorites separate from queued cloud metadata', async () => {
  const folder = await createPersonalFolder('Original', 'personal:space')
  await mutatePersonalNode(folder, { type: 'rename', name: 'Updated' })
  await togglePersonalFolderFavorite(folder)
  expect(await (await openFileExplorerDB()).get('folder-records', folder)).toMatchObject({
    name: 'Updated',
    isFavorited: true
  })
  expect(await listPersonalOutbox('alice')).toHaveLength(2)
})

it('creates nested folders durably and maps a local parent to its remote ID', async () => {
  const parent = await createPersonalFolder('Parent', 'personal:space')
  const child = await createPersonalFolder('Child', parent)
  const pending = await listPersonalOutbox('alice')
  expect(pending.map((entry) => entry.mutation)).toEqual([
    { type: 'create-folder', name: 'Parent', parentId: '' },
    { type: 'create-folder', name: 'Child', parentId: parent }
  ])
  await expect(mutatePersonalNode(parent, { type: 'move', parentId: child })).rejects.toThrow(
    'cycle'
  )
  expect(await listPersonalOutbox('alice')).toHaveLength(2)
})

it('retains offline edits and refuses another account mutation of the same local ID', async () => {
  const folder = await createPersonalFolder('Draft', 'personal:space')
  usePersonalSyncStore.getState().setAccount('unavailable')
  await mutatePersonalNode(folder, { type: 'rename', name: 'Offline' })
  usePersonalSyncStore.getState().setAccount('authenticated', 'bob')
  await expect(mutatePersonalNode(folder, { type: 'delete' })).rejects.toThrow('unavailable')
  expect(await (await openFileExplorerDB()).get('folder-records', folder)).toMatchObject({
    name: 'Offline'
  })
  expect(await listPersonalOutbox('alice')).toHaveLength(2)
})

it('routes public rename and delete actions through the outbox and blocks the legacy synchronous writer', async () => {
  const folder = await createExplorerFolder('Routed', 'personal:space')
  expect(useFileExplorerStore.getState().addFolder('Unsafe', 'personal:space')).toBe('')
  useFileExplorerStore.getState().updateFolder(folder, { name: 'Renamed' })
  await vi.waitFor(async () => expect(await listPersonalOutbox('alice')).toHaveLength(2))
  useFileExplorerStore.getState().softDeleteFolder(folder)
  await vi.waitFor(async () => expect(await listPersonalOutbox('alice')).toHaveLength(3))
  expect(await (await openFileExplorerDB()).get('folder-records', folder)).toMatchObject({
    name: 'Renamed',
    deletedAt: expect.any(Number)
  })
})

it('queues a chosen restore name in the same operation as restoring the folder', async () => {
  const folder = await createPersonalFolder('Sunday', 'personal:space')
  await mutatePersonalNode(folder, { type: 'delete' })
  await createPersonalFolder('Sunday', 'personal:space')
  await mutatePersonalNode(folder, { type: 'restore', name: 'Sunday restored' })
  expect((await listPersonalOutbox('alice')).at(-1)?.mutation).toEqual({
    type: 'restore',
    name: 'Sunday restored'
  })
  expect(await (await openFileExplorerDB()).get('folder-records', folder)).toMatchObject({
    name: 'Sunday restored',
    deletedAt: undefined
  })
})
