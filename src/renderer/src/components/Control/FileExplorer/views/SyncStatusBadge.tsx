import React from 'react'
import { AlertTriangle, CheckCircle2, Cloud, Loader2, RefreshCw, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { SyncEntryStatus } from '@renderer/lib/sync-db'

interface SyncStatusBadgeProps {
  status?: SyncEntryStatus
  downloadedBytes?: number
  downloadTotalBytes?: number
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

function getDownloadPercent(downloadedBytes?: number, downloadTotalBytes?: number): number | null {
  if (
    typeof downloadedBytes !== 'number' ||
    typeof downloadTotalBytes !== 'number' ||
    downloadTotalBytes <= 0
  ) {
    return null
  }
  return Math.max(0, Math.min(100, Math.round((downloadedBytes / downloadTotalBytes) * 100)))
}

function getStatusLabel(
  status: SyncEntryStatus,
  t: TFunction,
  downloadedBytes?: number,
  downloadTotalBytes?: number
): string {
  const percent = getDownloadPercent(downloadedBytes, downloadTotalBytes)
  if (status === 'downloading' && percent !== null) {
    return translateStatus(
      t,
      'fileExplorer.syncStatus.downloadingProgress',
      `Downloading ${percent}%`
    )
  }
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
  downloadedBytes,
  downloadTotalBytes,
  compact = false
}: SyncStatusBadgeProps): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!status) return null
  const label = getStatusLabel(status, t, downloadedBytes, downloadTotalBytes)
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

function ProgressCircle({ percent }: { percent: number }): React.JSX.Element {
  const radius = 8
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow-sm text-primary">
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="var(--color-background)"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="2"
      />
      <circle
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 9 9)"
      />
    </svg>
  )
}

export function SyncStatusIcon({
  status,
  downloadedBytes,
  downloadTotalBytes
}: {
  status?: SyncEntryStatus
  downloadedBytes?: number
  downloadTotalBytes?: number
}): React.JSX.Element | null {
  const { t } = useTranslation()
  if (!status) return null
  const label = getStatusLabel(status, t, downloadedBytes, downloadTotalBytes)
  const className = 'drop-shadow-sm'
  const percent = getDownloadPercent(downloadedBytes, downloadTotalBytes)
  const icon =
    status === 'available-offline' ? (
      <CheckCircle2 size={18} className={`${className} fill-success text-white`} />
    ) : status === 'failed' || status === 'insufficient-storage' ? (
      <XCircle size={18} className={`${className} fill-danger text-white`} />
    ) : status === 'downloading' && percent !== null ? (
      <ProgressCircle percent={percent} />
    ) : status === 'queued' || status === 'downloading' ? (
      <Loader2 size={18} className={`${className} animate-spin text-primary`} />
    ) : status === 'remote-only' ? (
      <Cloud size={18} className={`${className} text-primary`} />
    ) : status === 'outdated' ? (
      <RefreshCw size={18} className={`${className} text-warning`} />
    ) : (
      <AlertTriangle size={18} className={`${className} text-default-500`} />
    )

  return (
    <span title={label} aria-label={label} className="inline-flex">
      {icon}
    </span>
  )
}
