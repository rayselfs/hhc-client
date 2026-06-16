import { beforeEach, describe, expect, it } from 'vitest'
import { openFileExplorerDB, resetFileExplorerDBForTests } from '../file-explorer-db'
import { createMediaStorageDiagnosticsReport } from '../media-storage-diagnostics'
import { resetMediaWorkDBForTests } from '../media-work-db'
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
      }
    })
    expect(serialized).not.toContain('item-secret-token')
    expect(serialized).not.toContain('/Users/tester')
    expect(serialized).not.toContain('secret-token')
    expect(serialized).not.toContain('accessToken')
    expect(serialized).not.toContain('refreshToken')
  })
})
