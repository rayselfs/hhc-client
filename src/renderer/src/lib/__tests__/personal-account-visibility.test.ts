import { searchAllItems } from '../file-explorer-search'
import { beforeEach, expect, it } from 'vitest'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import { isPersonalRecordVisible, usePersonalSyncStore } from '../../stores/personal-sync'
import { refreshPersonalCatalog, useFileExplorerStore } from '../../stores/file-explorer'

beforeEach(async () => {
  usePersonalSyncStore.getState().setAccount('anonymous')
  await resetFileExplorerDBForTests()
  useFileExplorerStore.setState({
    isInitialized: false,
    folders: {},
    items: {},
    loadedParents: new Set()
  })
  const db = await openFileExplorerDB()
  await db.put('folder-records', {
    id: 'alice-root',
    personalOwnerId: 'alice',
    parentId: 'file-root',
    name: 'Cloud',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null
  })
  await db.put('folder-items', {
    id: 'alice-file',
    personalOwnerId: 'alice',
    parentId: 'alice-root',
    name: 'Private.png',
    type: 'file',
    url: 'blob:private',
    size: 3,
    mimeType: 'image/png',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null
  })
})

it('restores the last account only for offline unavailability and clears it on explicit logout', async () => {
  usePersonalSyncStore.getState().setAccount('authenticated', 'alice', true)
  usePersonalSyncStore.getState().setAccount('loading')
  expect(isPersonalRecordVisible({ personalOwnerId: 'alice' })).toBe(false)
  usePersonalSyncStore.getState().setAccount('unavailable')
  expect(isPersonalRecordVisible({ personalOwnerId: 'alice' })).toBe(true)
  usePersonalSyncStore.getState().setAccount('anonymous')
  usePersonalSyncStore.getState().setAccount('unavailable')
  expect(isPersonalRecordVisible({ personalOwnerId: 'alice' })).toBe(false)
  await refreshPersonalCatalog('alice')
})

it('hides old account folders and rejects lazy reads without deleting their durable data', async () => {
  await useFileExplorerStore.getState().initialize()
  expect(useFileExplorerStore.getState().folders['alice-root']).toBeUndefined()
  usePersonalSyncStore.getState().setAccount('authenticated', 'alice', true)
  await refreshPersonalCatalog('alice')
  expect(useFileExplorerStore.getState().items['alice-file']).toBeDefined()
  useFileExplorerStore.setState({ currentFolderId: 'alice-root' })
  usePersonalSyncStore.getState().setAccount('authenticated', 'bob', true)
  expect(useFileExplorerStore.getState().folders['alice-root']).toBeUndefined()
  expect(useFileExplorerStore.getState().items['alice-file']).toBeUndefined()
  expect(useFileExplorerStore.getState().currentFolderId).toBe('file-root')
  await useFileExplorerStore.getState().ensureItemsLoaded('alice-root')
  await refreshPersonalCatalog('bob')
  expect(useFileExplorerStore.getState().items['alice-file']).toBeUndefined()
  expect(await (await openFileExplorerDB()).get('folder-items', 'alice-file')).toBeDefined()
})

it('denies missing permission and clears offline access after revocation without deleting edits', async () => {
  usePersonalSyncStore.getState().setAccount('authenticated', 'alice')
  expect(isPersonalRecordVisible({ personalOwnerId: 'alice' })).toBe(false)
  usePersonalSyncStore.getState().setAccount('authenticated', 'alice', true)
  expect(isPersonalRecordVisible({ personalOwnerId: 'alice' })).toBe(true)
  usePersonalSyncStore.getState().setAccount('authenticated', 'alice', false)
  usePersonalSyncStore.getState().setAccount('unavailable')
  expect(isPersonalRecordVisible({ personalOwnerId: 'alice' })).toBe(false)
  expect(await (await openFileExplorerDB()).get('folder-items', 'alice-file')).toBeDefined()
})

it('scopes file search before limiting results and hides the personal root', async () => {
  await useFileExplorerStore.getState().initialize()
  usePersonalSyncStore.getState().setAccount('authenticated', 'alice', true)
  await refreshPersonalCatalog('alice')
  const state = useFileExplorerStore.getState()
  const item = state.items['alice-file']
  const catalog = {
    ...state,
    _itemsArray: [
      ...Array.from({ length: 20 }, (_, i) => ({
        ...item,
        id: `local-${i}`,
        personalOwnerId: undefined
      })),
      item
    ]
  }
  const cloud = searchAllItems('Private', catalog, 'Cloud documents', 'alice')
  expect(cloud).toHaveLength(1)
  expect(cloud[0]).toMatchObject({
    kind: 'file',
    item: { id: 'alice-file' },
    folderPath: '/Cloud documents'
  })
  expect(searchAllItems('Private', catalog, 'Home', null)).toHaveLength(20)
  expect(searchAllItems('Cloud', catalog, 'Cloud documents', 'alice')).toEqual([])
})
