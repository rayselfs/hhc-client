export type RecoveryIssueKind =
  | 'job-failed'
  | 'media-missing'
  | 'asset-failed'
  | 'sync-auth'
  | 'sync-download'
  | 'storage-integrity'
  | 'resource-cleanup-failed'

export type RecoveryIssueSeverity = 'info' | 'warning' | 'error'
export type RecoveryFilter = 'all' | 'media' | 'sync' | 'storage'

export type RecoveryActionType =
  | 'retry-job'
  | 'cancel-job'
  | 'retry-sync-download'
  | 'run-integrity-repair'
  | 'retry-resource-cleanup'
  | 'export-diagnostics'

export type RecoveryTranslationKey =
  | 'recovery.filters.all'
  | 'recovery.filters.media'
  | 'recovery.filters.sync'
  | 'recovery.filters.storage'
  | 'recovery.actions.retryJob'
  | 'recovery.actions.cancelJob'
  | 'recovery.actions.retrySyncDownload'
  | 'recovery.actions.runIntegrityRepair'
  | 'recovery.actions.retryResourceCleanup'
  | 'recovery.actions.exportDiagnostics'
  | 'recovery.issues.jobFailed.title'
  | 'recovery.issues.jobFailed.detail'
  | 'recovery.issues.storageIntegrity.title'
  | 'recovery.issues.storageIntegrity.detail'
  | 'recovery.issues.resourceCleanupFailed.title'
  | 'recovery.issues.resourceCleanupFailed.detail'
  | 'recovery.issues.syncDownload.title'
  | 'recovery.issues.syncDownload.detail'
  | 'recovery.issues.syncAuth.title'
  | 'recovery.issues.syncAuth.detail'

export interface RecoveryAction {
  type: RecoveryActionType
  labelKey: RecoveryTranslationKey
  destructive?: boolean
}

export interface RecoveryIssue {
  id: string
  kind: RecoveryIssueKind
  severity: RecoveryIssueSeverity
  titleKey: RecoveryTranslationKey
  detailKey: RecoveryTranslationKey
  sourceId?: string
  itemId?: string
  blobId?: string
  occurredAt: number
  actions: RecoveryAction[]
}
