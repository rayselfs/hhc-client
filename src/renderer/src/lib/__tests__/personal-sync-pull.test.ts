import { beforeEach, expect, it } from 'vitest'
import type { PersonalChangePage } from '@shared/personal-cloud'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import { acquirePersonalSyncLease, commitPersonalLocalMutation } from '../personal-sync-db'
import { commitPersonalChangePage, personalLocalNodeId } from '../personal-sync-pull'

const page: PersonalChangePage = {
  collection: { id: 'space', revision: 100 },
  items: [
    {
      id: 'remote',
      collectionId: 'space',
      kind: 'file',
      name: 'image.png',
      revision: 1,
      assetId: 'asset'
    }
  ],
  nextCursor: 'next',
  hasMore: false,
  reset: true
}
const signal = (): AbortSignal => new AbortController().signal
beforeEach(async () => {
  await resetFileExplorerDBForTests()
  const db = await openFileExplorerDB()
  await db.put('personal-sync-state', {
    ownerId: 'alice',
    collectionId: 'space',
    rootId: 'root',
    collectionRevision: 0,
    sequence: 0
  })
  await acquirePersonalSyncLease('alice', 'worker')
})

it('commits a page with its snapshot and advances only to revisions actually observed', async () => {
  await commitPersonalChangePage(
    'alice',
    'worker',
    undefined,
    page,
    new Map([
      ['remote', { id: 'snapshot', blob: new Blob(['one']), size: 3, mimeType: 'image/png' }]
    ]),
    signal()
  )
  const db = await openFileExplorerDB()
  expect(await db.get('personal-sync-state', 'alice')).toMatchObject({
    cursor: 'next',
    collectionRevision: 1
  })
  expect(await db.get('folder-items', personalLocalNodeId('space', 'remote'))).toMatchObject({
    personalOwnerId: 'alice',
    url: 'blob:snapshot',
    expiresAt: null
  })
})

it('rolls back the entire page and cursor when one active file has no download', async () => {
  await expect(
    commitPersonalChangePage(
      'alice',
      'worker',
      undefined,
      {
        ...page,
        items: [
          { id: 'folder', collectionId: 'space', kind: 'folder', name: 'Folder', revision: 1 },
          ...page.items
        ]
      },
      new Map(),
      signal()
    )
  ).rejects.toThrow('download')
  const db = await openFileExplorerDB()
  expect(await db.get('folder-records', personalLocalNodeId('space', 'folder'))).toBeUndefined()
  expect(await db.get('personal-sync-state', 'alice')).not.toHaveProperty('cursor')
})

it('retains a local edit made while the remote content was downloading', async () => {
  await commitPersonalLocalMutation({
    ownerId: 'alice',
    nodeId: 'local',
    remoteId: 'remote',
    operationId: 'operation',
    localRevision: 1,
    catalog: {
      id: 'local',
      parentId: 'root',
      type: 'file',
      name: 'Local.png',
      size: 3,
      mimeType: 'image/png',
      url: 'blob:local-blob',
      createdAt: 1,
      sortIndex: 0,
      expiresAt: null
    },
    mutation: { type: 'create-file', name: 'Local.png', parentId: '' },
    snapshot: { id: 'local-blob', blob: new Blob(['two']), size: 3 }
  })
  await commitPersonalChangePage(
    'alice',
    'worker',
    undefined,
    page,
    new Map([
      ['remote', { id: 'remote-blob', blob: new Blob(['one']), size: 3, mimeType: 'image/png' }]
    ]),
    signal()
  )
  const db = await openFileExplorerDB()
  expect(await db.get('folder-items', 'local')).toMatchObject({
    name: 'Local.png',
    url: 'blob:local-blob'
  })
  expect(await db.get('personal-sync-nodes', 'local')).toMatchObject({
    remoteHead: page.items[0],
    remoteRevision: 0
  })
  expect(await db.get('file-blobs', 'remote-blob')).toBeUndefined()
  expect(await db.getAll('personal-sync-outbox')).toHaveLength(1)
})

it('does not advance the observed collection revision halfway through pagination', async () => {
  await commitPersonalChangePage(
    'alice',
    'worker',
    undefined,
    {
      ...page,
      items: [{ id: 'folder', collectionId: 'space', kind: 'folder', name: 'Folder', revision: 5 }],
      hasMore: true
    },
    new Map(),
    signal()
  )
  const db = await openFileExplorerDB()
  expect(await db.get('personal-sync-state', 'alice')).toMatchObject({
    collectionRevision: 0,
    pullRevision: 5
  })
  await commitPersonalChangePage(
    'alice',
    'worker',
    'next',
    { ...page, items: [], nextCursor: 'done' },
    new Map(),
    signal()
  )
  expect(await db.get('personal-sync-state', 'alice')).toMatchObject({
    collectionRevision: 5,
    cursor: 'done'
  })
})
