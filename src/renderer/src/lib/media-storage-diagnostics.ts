import {
  getMediaStorageAccounting,
  type BrowserStorageEstimate,
  type MediaStorageUsage
} from './media-storage-accounting'
import {
  scanMediaStorageIntegrity,
  type MediaStorageIntegrityIssueKind
} from './media-storage-integrity'
import { listResourceCleanupRecords } from './resource-cleanup-journal'

export interface MediaStorageDiagnosticsIssueSummary {
  kind: MediaStorageIntegrityIssueKind
  severity: 'warning' | 'error'
  count: number
}

export interface MediaStorageDiagnosticsReport {
  schemaVersion: 1
  generatedAt: number
  usage: MediaStorageUsage
  total: number
  browser?: BrowserStorageEstimate
  integrity: {
    checkedAt: number
    issueCount: number
    issues: MediaStorageDiagnosticsIssueSummary[]
  }
  cleanupJournal: {
    pending: number
    failed: number
    maxAttempt: number
  }
}

export async function createMediaStorageDiagnosticsReport(
  now = Date.now()
): Promise<MediaStorageDiagnosticsReport> {
  const [accounting, integrity, cleanupRecords] = await Promise.all([
    getMediaStorageAccounting(),
    scanMediaStorageIntegrity(now),
    listResourceCleanupRecords()
  ])

  return {
    schemaVersion: 1,
    generatedAt: now,
    usage: accounting.usage,
    total: accounting.total,
    browser: accounting.browser,
    integrity: {
      checkedAt: integrity.checkedAt,
      issueCount: integrity.issueCount,
      issues: summarizeIntegrityIssues(integrity.issues)
    },
    cleanupJournal: {
      pending: cleanupRecords.filter((record) => record.status === 'pending').length,
      failed: cleanupRecords.filter((record) => record.status === 'failed').length,
      maxAttempt: cleanupRecords.reduce((max, record) => Math.max(max, record.attempt), 0)
    }
  }
}

export function stringifyRedactedDiagnostics(report: MediaStorageDiagnosticsReport): string {
  return JSON.stringify(report, null, 2)
}

function summarizeIntegrityIssues(
  issues: Awaited<ReturnType<typeof scanMediaStorageIntegrity>>['issues']
): MediaStorageDiagnosticsIssueSummary[] {
  const counts = new Map<string, MediaStorageDiagnosticsIssueSummary>()
  for (const issue of issues) {
    const key = `${issue.kind}:${issue.severity}`
    const existing = counts.get(key)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(key, {
        kind: issue.kind,
        severity: issue.severity,
        count: 1
      })
    }
  }
  return [...counts.values()].sort((a, b) => a.kind.localeCompare(b.kind))
}
