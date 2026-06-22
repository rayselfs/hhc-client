export type RecoveryIssueKind =
  | 'job-failed'
  | 'media-missing'
  | 'asset-failed'
  | 'sync-auth'
  | 'sync-download'
  | 'storage-integrity'
  | 'projection-health'

export type RecoveryIssueSeverity = 'info' | 'warning' | 'error'
export type RecoveryFilter = 'all' | 'media' | 'sync' | 'storage' | 'projection'

export type RecoveryActionType =
  | 'retry-job'
  | 'cancel-job'
  | 'retry-sync-download'
  | 'run-integrity-repair'
  | 'reopen-projection'
  | 'export-diagnostics'

export interface RecoveryAction {
  type: RecoveryActionType
  labelKey: string
  destructive?: boolean
}

export interface RecoveryIssue {
  id: string
  kind: RecoveryIssueKind
  severity: RecoveryIssueSeverity
  titleKey: string
  detailKey: string
  sourceId?: string
  itemId?: string
  blobId?: string
  occurredAt: number
  actions: RecoveryAction[]
}
