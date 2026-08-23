import { expect, it, vi } from 'vitest'
import {
  collectRecoveryIssues,
  runRecoveryAction,
  sortRecoveryIssues
} from '@renderer/lib/recovery-center'
import { scanMediaStorageIntegrity } from '@renderer/lib/media-storage-integrity'

const {
  integrityIssues,
  mockCreateMediaStorageDiagnosticsReport,
  mockRetryResourceCleanup,
  mockRepairMediaStorageIntegrity,
  mockStringifyRedactedDiagnostics
} = vi.hoisted(() => ({
  integrityIssues: [
    {
      kind: 'file-item-missing-blob',
      severity: 'error',
      resourceId: 'file-1',
      relatedId: 'blob-1',
      message: 'raw path must not appear here'
    }
  ],
  mockCreateMediaStorageDiagnosticsReport: vi.fn(async () => ({ schemaVersion: 1 })),
  mockRetryResourceCleanup: vi.fn(async () => undefined),
  mockRepairMediaStorageIntegrity: vi.fn(async () => ({
    correctedRefCounts: [],
    cleanupJournalIds: []
  })),
  mockStringifyRedactedDiagnostics: vi.fn(() => '{"redacted":true}')
}))

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
  repairMediaStorageIntegrity: mockRepairMediaStorageIntegrity,
  scanMediaStorageIntegrity: vi.fn(async () => ({
    checkedAt: 30,
    issueCount: integrityIssues.length,
    issues: integrityIssues
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
  createMediaStorageDiagnosticsReport: mockCreateMediaStorageDiagnosticsReport,
  stringifyRedactedDiagnostics: mockStringifyRedactedDiagnostics
}))

vi.mock('@renderer/lib/resource-cleanup-journal', () => ({
  listResourceCleanupRecords: vi.fn(async () => [
    {
      id: 'cleanup-1',
      blobId: 'private-blob-id',
      status: 'failed',
      attempt: 1,
      createdAt: 45,
      updatedAt: 50
    }
  ]),
  retryResourceCleanup: mockRetryResourceCleanup
}))

it('collects current actionable issues with stable ids', async () => {
  const issues = await collectRecoveryIssues()

  expect(issues.map((issue) => issue.id)).toEqual([
    'resource-cleanup-failed:cleanup-1',
    'storage-integrity:file-item-missing-blob:file-1',
    'job-failed:job-1',
    'sync-download:sync-1'
  ])
  expect(issues.every((issue) => issue.titleKey.startsWith('recovery.'))).toBe(true)
})

it('offers repair only for unreferenced blobs and ref-count mismatches', async () => {
  integrityIssues.splice(
    0,
    integrityIssues.length,
    ...[
      'file-item-missing-blob',
      'file-blob-unreferenced',
      'file-blob-ref-count-mismatch',
      'derived-asset-missing-source',
      'sync-entry-missing-blob'
    ].map((kind, index) => ({
      kind,
      severity: 'warning',
      resourceId: `resource-${index}`,
      relatedId: `related-${index}`,
      message: 'redacted summary'
    }))
  )

  const issues = (await collectRecoveryIssues()).filter((issue) =>
    issue.id.startsWith('storage-integrity:')
  )
  const actionsByKind = Object.fromEntries(
    issues.map((issue) => [issue.id.split(':')[1], issue.actions.map((action) => action.type)])
  )

  expect(actionsByKind).toEqual({
    'file-item-missing-blob': ['export-diagnostics'],
    'file-blob-unreferenced': ['run-integrity-repair', 'export-diagnostics'],
    'file-blob-ref-count-mismatch': ['run-integrity-repair', 'export-diagnostics'],
    'derived-asset-missing-source': ['export-diagnostics'],
    'sync-entry-missing-blob': ['export-diagnostics']
  })
})

it('retries the selected resource cleanup record', async () => {
  await runRecoveryAction('retry-resource-cleanup', 'cleanup-1')

  expect(mockRetryResourceCleanup).toHaveBeenCalledWith('cleanup-1')
})

it('runs an actual integrity repair instead of a scan-only action', async () => {
  await runRecoveryAction('run-integrity-repair')

  expect(mockRepairMediaStorageIntegrity).toHaveBeenCalledTimes(1)
})

it('downloads redacted diagnostics through a Blob URL and revokes it', async () => {
  const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:diagnostics')
  const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  let clickedDownload: Pick<HTMLAnchorElement, 'download' | 'href'> | undefined
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    clickedDownload = { download: this.download, href: this.href }
  })

  await runRecoveryAction('export-diagnostics')

  expect(mockStringifyRedactedDiagnostics).toHaveBeenCalledWith({ schemaVersion: 1 })
  expect(createObjectURL).toHaveBeenCalledOnce()
  const blob = createObjectURL.mock.calls[0][0] as Blob
  expect(blob).toBeInstanceOf(Blob)
  expect(blob.type).toBe('application/json')
  await expect(
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(blob)
    })
  ).resolves.toBe('{"redacted":true}')
  expect(clickedDownload).toEqual({
    download: 'librepresenter-diagnostics.json',
    href: 'blob:diagnostics'
  })
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:diagnostics')
})

it('shares one physical scan and coalesces distinct in-flight events into one trailing scan', async () => {
  vi.mocked(scanMediaStorageIntegrity).mockClear()
  const emptyReport = { checkedAt: 60, issueCount: 0, issues: [] }
  let resolveSlowScan: ((report: typeof emptyReport) => void) | undefined
  vi.mocked(scanMediaStorageIntegrity)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSlowScan = resolve
      })
    )
    .mockResolvedValueOnce(emptyReport)
  const firstEvent = new Event('hhc:recovery-source-changed')
  const trailingEvent = new Event('hhc:recovery-source-changed')

  const first = collectRecoveryIssues(firstEvent)
  const concurrent = collectRecoveryIssues(firstEvent)
  const trailing = collectRecoveryIssues(trailingEvent)
  const duplicateTrailing = collectRecoveryIssues(trailingEvent)
  const callsBeforeResolve = vi.mocked(scanMediaStorageIntegrity).mock.calls.length
  resolveSlowScan?.(emptyReport)
  await Promise.allSettled([first, concurrent, trailing, duplicateTrailing])

  expect(concurrent).toBe(first)
  expect(trailing).toBe(first)
  expect(duplicateTrailing).toBe(first)
  expect(callsBeforeResolve).toBe(1)
  expect(scanMediaStorageIntegrity).toHaveBeenCalledTimes(2)
})

it('continues to a queued trailing scan after the active scan rejects', async () => {
  vi.mocked(scanMediaStorageIntegrity).mockClear()
  const emptyReport = { checkedAt: 70, issueCount: 0, issues: [] }
  vi.mocked(scanMediaStorageIntegrity)
    .mockRejectedValueOnce(new Error('first scan failed'))
    .mockResolvedValueOnce(emptyReport)
  const firstEvent = new Event('hhc:recovery-source-changed')
  const trailingEvent = new Event('hhc:recovery-source-changed')

  const scan = collectRecoveryIssues(firstEvent)
  expect(collectRecoveryIssues(trailingEvent)).toBe(scan)

  await expect(scan).resolves.toEqual(expect.any(Array))
  expect(scanMediaStorageIntegrity).toHaveBeenCalledTimes(2)
})

it('allows a subsequent scan after a terminal rejection', async () => {
  vi.mocked(scanMediaStorageIntegrity).mockClear()
  vi.mocked(scanMediaStorageIntegrity).mockRejectedValueOnce(new Error('scan failed'))

  await expect(collectRecoveryIssues()).rejects.toThrow('scan failed')

  await expect(collectRecoveryIssues()).resolves.toEqual(expect.any(Array))
})

it('sorts errors before warnings and newest within severity', () => {
  const sorted = sortRecoveryIssues([
    {
      id: 'w-old',
      kind: 'job-failed',
      severity: 'warning',
      titleKey: 'recovery.issues.jobFailed.title',
      detailKey: 'recovery.issues.jobFailed.detail',
      occurredAt: 1,
      actions: []
    },
    {
      id: 'e-old',
      kind: 'media-missing',
      severity: 'error',
      titleKey: 'recovery.issues.storageIntegrity.title',
      detailKey: 'recovery.issues.storageIntegrity.detail',
      occurredAt: 1,
      actions: []
    },
    {
      id: 'e-new',
      kind: 'asset-failed',
      severity: 'error',
      titleKey: 'recovery.issues.storageIntegrity.title',
      detailKey: 'recovery.issues.storageIntegrity.detail',
      occurredAt: 2,
      actions: []
    }
  ])

  expect(sorted.map((issue) => issue.id)).toEqual(['e-new', 'e-old', 'w-old'])
})
