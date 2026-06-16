import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { SyncEntryStatus } from '@renderer/lib/sync-db'

interface SyncStatusBadgeProps {
  status?: SyncEntryStatus
  compact?: boolean
}

const STATUS_STYLES: Record<SyncEntryStatus, string> = {
  'remote-only': 'border-default-300 bg-default-100 text-default-600',
  queued: 'border-warning-300 bg-warning-50 text-warning-700',
  downloading: 'border-primary-300 bg-primary-50 text-primary-700',
  'available-offline': 'border-success-300 bg-success-50 text-success-700',
  outdated: 'border-warning-300 bg-warning-50 text-warning-700',
  failed: 'border-danger-300 bg-danger-50 text-danger-700',
  'insufficient-storage': 'border-danger-300 bg-danger-50 text-danger-700',
  'deleted-pending-release': 'border-default-300 bg-default-100 text-default-600'
}

function translateStatus(t: TFunction, key: string, fallback: string): string {
  return String(t(key, fallback))
}

function getStatusLabel(status: SyncEntryStatus, t: TFunction): string {
  switch (status) {
    case 'remote-only':
      return translateStatus(t, 'fileExplorer.syncStatus.remoteOnly', 'Remote only')
    case 'queued':
      return translateStatus(t, 'fileExplorer.syncStatus.queued', 'Queued')
    case 'downloading':
      return translateStatus(t, 'fileExplorer.syncStatus.downloading', 'Downloading')
    case 'available-offline':
      return translateStatus(t, 'fileExplorer.syncStatus.availableOffline', 'Offline')
    case 'outdated':
      return translateStatus(t, 'fileExplorer.syncStatus.outdated', 'Outdated')
    case 'failed':
      return translateStatus(t, 'fileExplorer.syncStatus.failed', 'Failed')
    case 'insufficient-storage':
      return translateStatus(t, 'fileExplorer.syncStatus.insufficientStorage', 'No space')
    case 'deleted-pending-release':
      return translateStatus(t, 'fileExplorer.syncStatus.deletedPendingRelease', 'Pending delete')
  }
}

export function SyncStatusBadge({
  status,
  compact = false
}: SyncStatusBadgeProps): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!status) return null
  const label = getStatusLabel(status, t)
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full border font-medium leading-none ${STATUS_STYLES[status]} ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
      }`}
      title={label}
      aria-label={label}
    >
      {label}
    </span>
  )
}
