import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import type { SyncEntryStatus } from '@renderer/lib/sync-db'
import type { SyncFolderHealthStatus } from '@renderer/lib/sync-folder-health'
import { SyncStatusBadge, SyncStatusIcon } from './views/SyncStatusBadge'
import type { MediaProcessingStatus } from '@renderer/lib/media-job-view-state'
import { useTranslation } from 'react-i18next'
import type { PersonalItemStatus } from '@renderer/stores/personal-sync'

interface FileItemStatusProps {
  personalStatus?: PersonalItemStatus
  syncStatus?: SyncEntryStatus
  downloadedBytes?: number
  downloadTotalBytes?: number
  folderHealth?: SyncFolderHealthStatus
  folderHealthTooltip?: string
  variant: 'icon' | 'badge'
  processingStatus?: MediaProcessingStatus
  processingProgress?: number
}

export function FileItemStatus({
  personalStatus,
  syncStatus,
  downloadedBytes,
  downloadTotalBytes,
  folderHealth,
  folderHealthTooltip,
  variant,
  processingStatus,
  processingProgress
}: FileItemStatusProps): React.JSX.Element | null {
  const { t } = useTranslation()
  if (personalStatus) {
    const label = t(`personalCloud.${personalStatus}`)
    const Icon = personalStatus === 'synced' ? CheckCircle2 : AlertTriangle
    return (
      <span title={label} aria-label={label} className="inline-flex items-center gap-1 text-xs">
        <Icon size={14} className={personalStatus === 'synced' ? 'text-success' : 'text-warning'} />
        {variant === 'badge' ? label : null}
      </span>
    )
  }
  if (folderHealth && folderHealth !== 'unknown') {
    const icon =
      folderHealth === 'syncing' ? (
        <Loader2
          size={14}
          className="animate-spin text-primary"
          aria-label={t('fileExplorer.syncHealth.syncing', 'Syncing')}
        />
      ) : folderHealth === 'warning' ? (
        <AlertTriangle
          size={14}
          className="text-warning"
          aria-label={t('fileExplorer.syncHealth.warning')}
        />
      ) : folderHealth === 'error' ? (
        <XCircle
          size={14}
          className="text-danger"
          aria-label={t('fileExplorer.syncHealth.error')}
        />
      ) : (
        <CheckCircle2
          size={14}
          className="text-success"
          aria-label={t('fileExplorer.syncHealth.ok')}
        />
      )
    return <span title={folderHealthTooltip}>{icon}</span>
  }

  if (processingStatus) {
    const percent =
      typeof processingProgress === 'number'
        ? Math.max(0, Math.min(100, Math.round(processingProgress)))
        : null
    const label = String(
      processingStatus === 'failed'
        ? t('fileExplorer.processingStatus.failed', 'Processing failed')
        : processingStatus === 'blocked'
          ? t('fileExplorer.processingStatus.blocked', 'Processing blocked')
          : processingStatus === 'paused'
            ? t('fileExplorer.processingStatus.paused', 'Processing paused')
            : percent === null
              ? t('fileExplorer.processingStatus.processing', 'Processing')
              : `${t('fileExplorer.processingStatus.processing', 'Processing')} ${percent}%`
    )
    const icon =
      processingStatus === 'failed' ? (
        <XCircle size={16} className="text-danger" />
      ) : processingStatus === 'blocked' || processingStatus === 'paused' ? (
        <AlertTriangle size={16} className="text-warning" />
      ) : (
        <Loader2 size={16} className="animate-spin text-primary" />
      )
    return (
      <span
        aria-label={label}
        title={label}
        className={variant === 'badge' ? 'inline-flex items-center gap-1 text-xs' : 'inline-flex'}
      >
        {icon}
        {variant === 'badge' ? label : null}
      </span>
    )
  }

  return variant === 'icon' ? (
    <SyncStatusIcon
      status={syncStatus}
      downloadedBytes={downloadedBytes}
      downloadTotalBytes={downloadTotalBytes}
    />
  ) : (
    <SyncStatusBadge
      status={syncStatus}
      downloadedBytes={downloadedBytes}
      downloadTotalBytes={downloadTotalBytes}
      compact
    />
  )
}
