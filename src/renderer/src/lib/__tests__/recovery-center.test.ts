import { expect, it, vi } from 'vitest'
import { collectRecoveryIssues, sortRecoveryIssues } from '@renderer/lib/recovery-center'

vi.mock('@renderer/lib/media-work-db', () => ({
  listMediaJobs: vi.fn(async () => [
    {
      id: 'job-1',
      type: 'video-poster',
      status: 'failed',
      errorCode: 'bad codec',
      priority: 0,
      attempt: 1,
      createdAt: 10,
      updatedAt: 20
    }
  ])
}))

vi.mock('@renderer/lib/media-storage-integrity', () => ({
  scanMediaStorageIntegrity: vi.fn(async () => ({
    checkedAt: 30,
    issueCount: 1,
    issues: [
      {
        kind: 'file-item-missing-blob',
        severity: 'error',
        resourceId: 'file-1',
        relatedId: 'blob-1',
        message: 'raw path must not appear here'
      }
    ]
  }))
}))

vi.mock('@renderer/lib/sync-db', () => ({
  listSyncEntries: vi.fn(async () => [
    {
      id: 'sync-1',
      providerConnectionId: 'conn-1',
      status: 'failed',
      remoteItemId: 'remote-1',
      parentRemoteItemId: null,
      name: 'slide.mp4',
      kind: 'file',
      createdAt: 35,
      updatedAt: 40
    }
  ])
}))

vi.mock('@renderer/lib/media-job-queue', () => ({
  mediaJobQueue: {
    retry: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined)
  }
}))

vi.mock('@renderer/lib/media-storage-diagnostics', () => ({
  createMediaStorageDiagnosticsReport: vi.fn(async () => ({}))
}))

it('collects current actionable issues with stable ids', async () => {
  const issues = await collectRecoveryIssues()

  expect(issues.map((issue) => issue.id)).toEqual([
    'storage-integrity:file-item-missing-blob:file-1',
    'job-failed:job-1',
    'sync-download:sync-1'
  ])
  expect(issues.every((issue) => issue.titleKey.startsWith('recovery.'))).toBe(true)
})

it('sorts errors before warnings and newest within severity', () => {
  const sorted = sortRecoveryIssues([
    {
      id: 'w-old',
      kind: 'job-failed',
      severity: 'warning',
      titleKey: 'x',
      detailKey: 'x',
      occurredAt: 1,
      actions: []
    },
    {
      id: 'e-old',
      kind: 'media-missing',
      severity: 'error',
      titleKey: 'x',
      detailKey: 'x',
      occurredAt: 1,
      actions: []
    },
    {
      id: 'e-new',
      kind: 'asset-failed',
      severity: 'error',
      titleKey: 'x',
      detailKey: 'x',
      occurredAt: 2,
      actions: []
    }
  ])

  expect(sorted.map((issue) => issue.id)).toEqual(['e-new', 'e-old', 'w-old'])
})
