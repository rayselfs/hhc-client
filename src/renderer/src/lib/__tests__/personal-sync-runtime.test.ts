import { beforeEach, expect, it, vi } from 'vitest'
import { PersonalCloudHttpError, type PersonalUploadState } from '@shared/personal-cloud'
import type { PersonalCloudProvider } from '../personal-cloud-provider'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import {
  acquirePersonalSyncLease,
  commitPersonalLocalMutation,
  listPersonalOutbox
} from '../personal-sync-db'
import { advancePersonalOutbox } from '../personal-sync-runtime'

const upload: PersonalUploadState = {
  id: 'upload',
  contentPath: '/unused',
  expiresAt: '2099-01-01T00:00:00Z',
  uploadStatus: 'completed',
  scanStatus: 'clean',
  processingStatus: 'not_required'
}
const api = {
  ensureSpace: vi.fn(),
  getChanges: vi.fn(),
  createUpload: vi.fn(),
  getUpload: vi.fn(),
  uploadSnapshot: vi.fn(),
  completeUpload: vi.fn(),
  mutate: vi.fn(),
  downloadSnapshot: vi.fn()
} satisfies PersonalCloudProvider
const run = (): ReturnType<typeof advancePersonalOutbox> =>
  advancePersonalOutbox('alice', 'worker', api, new AbortController().signal)

beforeEach(async () => {
  vi.resetAllMocks()
  await resetFileExplorerDBForTests()
  const db = await openFileExplorerDB()
  await db.put('personal-sync-state', {
    ownerId: 'alice',
    collectionId: 'space',
    rootId: 'root',
    collectionRevision: 0,
    sequence: 0
  })
  await commitPersonalLocalMutation({
    ownerId: 'alice',
    nodeId: 'file',
    remoteId: 'remote',
    operationId: 'operation',
    localRevision: 1,
    catalog: {
      id: 'file',
      parentId: 'root',
      type: 'file',
      name: 'image.png',
      mimeType: 'image/png',
      size: 3,
      url: 'blob:snapshot',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null
    },
    mutation: { type: 'create-file', parentId: '', name: 'image.png' },
    snapshot: { id: 'snapshot', blob: new Blob(['one']), size: 3 }
  })
  await acquirePersonalSyncLease('alice', 'worker')
  api.createUpload.mockResolvedValue(upload)
  api.getUpload.mockResolvedValue(upload)
  api.mutate.mockResolvedValue({ itemId: 'remote', nodeRevision: 1, collectionRevision: 1 })
})

it('replays the exact submitted body after a lost mutation response, without a new upload', async () => {
  api.mutate.mockRejectedValueOnce(new TypeError('Connection lost'))
  await expect(run()).rejects.toThrow('Connection lost')
  const pending = (await listPersonalOutbox('alice'))[0]
  expect(pending.submittedRequest?.uploadId).toBe('upload')
  api.getUpload.mockRejectedValue(new PersonalCloudHttpError(404, 'expired'))
  expect(await run()).toBe('acknowledged')
  expect(api.mutate.mock.calls[1][0]).toEqual(api.mutate.mock.calls[0][0])
  expect(api.createUpload).toHaveBeenCalledTimes(1)
  expect(api.getUpload).not.toHaveBeenCalled()
  expect(await listPersonalOutbox('alice')).toEqual([])
})

it('waits for scanning and preserves immutable bytes on a rate limit', async () => {
  api.createUpload.mockResolvedValue({ ...upload, scanStatus: 'pending' })
  expect(await run()).toBe('scanning')
  expect(api.mutate).not.toHaveBeenCalled()
  api.getUpload.mockRejectedValue(new PersonalCloudHttpError(429, 'rate-limit', 10000))
  await expect(run()).rejects.toMatchObject({ retryAfterMs: 10000 })
  expect(await listPersonalOutbox('alice')).toHaveLength(1)
  expect(await (await openFileExplorerDB()).get('file-blobs', 'snapshot')).toMatchObject({
    refCount: 2
  })
})

it('starts a new upload attempt only before a mutation has been submitted', async () => {
  api.createUpload.mockResolvedValueOnce({ ...upload, expiresAt: '2000-01-01T00:00:00Z' })
  expect(await run()).toBe('scanning')
  expect((await listPersonalOutbox('alice'))[0]).toMatchObject({ uploadAttempt: 1 })
  expect(await run()).toBe('acknowledged')
  expect(api.createUpload.mock.calls.map((call) => call[1])).toEqual([
    'operation-upload-0',
    'operation-upload-1'
  ])
})

it('retains conflicting content and stops retrying the destructive operation', async () => {
  api.mutate.mockRejectedValue(new PersonalCloudHttpError(409, 'AST_CONFLICT'))
  expect(await run()).toBe('blocked')
  expect(await run()).toBe('blocked')
  expect(api.mutate).toHaveBeenCalledTimes(1)
  expect((await listPersonalOutbox('alice'))[0]).toMatchObject({
    failure: 'conflict',
    snapshotBlobId: 'snapshot'
  })
})
