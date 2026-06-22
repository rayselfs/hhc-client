import { listMediaJobs } from '@renderer/lib/media-work-db'
import { mediaJobQueue } from '@renderer/lib/media-job-queue'
import { scanMediaStorageIntegrity } from '@renderer/lib/media-storage-integrity'
import { createMediaStorageDiagnosticsReport } from '@renderer/lib/media-storage-diagnostics'
import { listSyncEntries, putSyncEntry } from '@renderer/lib/sync-db'
import type { RecoveryActionType, RecoveryIssue } from '@renderer/types/recovery-center'

const SEVERITY_RANK: Record<RecoveryIssue['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2
}

export function sortRecoveryIssues(issues: RecoveryIssue[]): RecoveryIssue[] {
  return [...issues].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.occurredAt - a.occurredAt
  )
}

export async function collectRecoveryIssues(): Promise<RecoveryIssue[]> {
  const [jobs, integrity, syncEntries] = await Promise.all([
    listMediaJobs(),
    scanMediaStorageIntegrity(),
    listSyncEntries()
  ])

  const issues: RecoveryIssue[] = []

  for (const job of jobs) {
    if (!['failed', 'blocked'].includes(job.status)) continue
    issues.push({
      id: `job-failed:${job.id}`,
      kind: 'job-failed',
      severity: job.status === 'failed' ? 'error' : 'warning',
      titleKey: 'recovery.issues.jobFailed.title',
      detailKey: 'recovery.issues.jobFailed.detail',
      sourceId: job.id,
      itemId: job.itemId,
      blobId: job.sourceBlobId,
      occurredAt: job.updatedAt,
      actions: [
        { type: 'retry-job', labelKey: 'recovery.actions.retryJob' },
        { type: 'cancel-job', labelKey: 'recovery.actions.cancelJob', destructive: true }
      ]
    })
  }

  for (const issue of integrity.issues) {
    issues.push({
      id: `storage-integrity:${issue.kind}:${issue.resourceId}`,
      kind: issue.kind === 'file-item-missing-blob' ? 'media-missing' : 'storage-integrity',
      severity: issue.severity,
      titleKey: 'recovery.issues.storageIntegrity.title',
      detailKey: 'recovery.issues.storageIntegrity.detail',
      sourceId: issue.resourceId,
      itemId: issue.kind === 'file-item-missing-blob' ? issue.resourceId : undefined,
      blobId: issue.relatedId,
      occurredAt: integrity.checkedAt,
      actions: [
        { type: 'run-integrity-repair', labelKey: 'recovery.actions.runIntegrityRepair' },
        { type: 'export-diagnostics', labelKey: 'recovery.actions.exportDiagnostics' }
      ]
    })
  }

  for (const entry of syncEntries) {
    if (!['failed', 'insufficient-storage'].includes(entry.status)) continue
    issues.push({
      id: `sync-download:${entry.id}`,
      kind: entry.errorKind === 'auth-required' ? 'sync-auth' : 'sync-download',
      severity: entry.status === 'insufficient-storage' ? 'error' : 'warning',
      titleKey:
        entry.errorKind === 'auth-required'
          ? 'recovery.issues.syncAuth.title'
          : 'recovery.issues.syncDownload.title',
      detailKey:
        entry.errorKind === 'auth-required'
          ? 'recovery.issues.syncAuth.detail'
          : 'recovery.issues.syncDownload.detail',
      sourceId: entry.id,
      itemId: entry.itemId,
      blobId: entry.blobId,
      occurredAt: entry.updatedAt,
      actions: [{ type: 'retry-sync-download', labelKey: 'recovery.actions.retrySyncDownload' }]
    })
  }

  return sortRecoveryIssues(issues)
}

export async function runRecoveryAction(
  type: RecoveryActionType,
  sourceId?: string
): Promise<void> {
  if (type === 'retry-job' && sourceId) {
    await mediaJobQueue.retry(sourceId)
    return
  }

  if (type === 'cancel-job' && sourceId) {
    await mediaJobQueue.cancel(sourceId)
    return
  }

  if (type === 'retry-sync-download' && sourceId) {
    const entry = (await listSyncEntries()).find((entry) => entry.id === sourceId)
    if (!entry || entry.kind !== 'file') return
    await putSyncEntry({
      ...entry,
      status: 'queued',
      errorKind: undefined,
      retryCount: undefined,
      nextRetryAt: undefined,
      lastError: undefined,
      downloadedBytes: 0,
      downloadTotalBytes: entry.size,
      updatedAt: Date.now()
    })
    return
  }

  if (type === 'run-integrity-repair') {
    await scanMediaStorageIntegrity()
    return
  }

  if (type === 'export-diagnostics') {
    await createMediaStorageDiagnosticsReport()
  }
}
