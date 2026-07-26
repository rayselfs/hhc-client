import { beforeEach, describe, expect, it } from 'vitest'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import {
  createMediaStorageDiagnosticsReport,
  stringifyRedactedDiagnostics
} from '../media-storage-diagnostics'
import { resetMediaWorkDBForTests } from '../media-work-db'
import { createResourceCleanupRecord, putResourceCleanupRecord } from '../resource-cleanup-journal'
import { resetSyncDBForTests } from '../sync-db'

beforeEach(async () => {
  await resetFileExplorerDBForTests()
  await resetMediaWorkDBForTests()
  await resetSyncDBForTests()
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: undefined
  })
})

describe('createMediaStorageDiagnosticsReport', () => {
  it('exports redacted storage diagnostics without resource ids, paths, or secrets', async () => {
    const db = await openFileExplorerDB()
    await db.put('folder-items', {
      id: 'item-secret-token',
      parentId: 'root',
      type: 'file',
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null,
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      size: 10,
      url: 'blob:/Users/tester/secret-token'
    })
    await putResourceCleanupRecord({
      ...createResourceCleanupRecord({
        blobId: 'C:\\private\\native-file',
        storage: 'native-fs',
        deleteNativeFile: true,
        deleteDerivedAssets: true,
        deletePdfPageThumbs: true,
        itemThumbnailIds: ['secret-thumbnail']
      }),
      status: 'failed',
      attempt: 3,
      lastError: 'C:\\private\\native-file accessToken=secret',
      updatedAt: 122
    })

    const report = await createMediaStorageDiagnosticsReport(123)
    const serialized = JSON.stringify(report)

    expect(report).toMatchObject({
      schemaVersion: 1,
      generatedAt: 123,
      integrity: {
        checkedAt: 123,
        issueCount: 1,
        issues: [
          {
            kind: 'file-item-missing-blob',
            severity: 'error',
            count: 1
          }
        ]
      },
      cleanupJournal: {
        pending: 0,
        failed: 1,
        maxAttempt: 3
      }
    })
    expect(serialized).not.toContain('item-secret-token')
    expect(serialized).not.toContain('/Users/tester')
    expect(serialized).not.toContain('native-file')
    expect(serialized).not.toContain('secret-token')
    expect(serialized).not.toContain('accessToken')
    expect(serialized).not.toContain('refreshToken')
  })

  it('stringifies diagnostics without paths, tokens, or stack traces', () => {
    const output = stringifyRedactedDiagnostics({
      schemaVersion: 1,
      generatedAt: 1,
      usage: {} as never,
      total: 0,
      integrity: {
        checkedAt: 1,
        issueCount: 1,
        issues: [{ kind: 'file-item-missing-blob', severity: 'error', count: 1 }]
      },
      cleanupJournal: { pending: 0, failed: 0, maxAttempt: 0 }
    })

    expect(output).not.toMatch(/\/Users|C:\\|accessToken|refreshToken|Error:/)
    expect(JSON.parse(output).schemaVersion).toBe(1)
  })
})
