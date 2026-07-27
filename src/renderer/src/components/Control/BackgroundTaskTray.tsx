import { useMemo, useState } from 'react'
import { Button } from '@heroui/react/button'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CirclePause,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMediaJobs } from '@renderer/hooks/useMediaJobs'
import { mediaJobQueue } from '@renderer/lib/media-job-queue'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import type { MediaJobRecord } from '@renderer/lib/media-work-db'
import { isFileItem } from '@shared/types/folder'

const ACTIVE_STATUSES = new Set<MediaJobRecord['status']>(['queued', 'running'])
const ISSUE_STATUSES = new Set<MediaJobRecord['status']>(['blocked', 'failed', 'paused'])

export default function BackgroundTaskTray(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { jobs } = useMediaJobs()
  const [isOpen, setIsOpen] = useState(false)
  const items = useFileExplorerStore((state) => state.items)
  const visibleJobs = useMemo(() => jobs.slice(0, 30), [jobs])
  const activeCount = visibleJobs.filter((job) => ACTIVE_STATUSES.has(job.status)).length
  const issueCount = visibleJobs.filter((job) => ISSUE_STATUSES.has(job.status)).length

  if (visibleJobs.length === 0) return null

  return (
    <aside className="fixed bottom-3 right-3 z-50 w-[min(420px,calc(100vw-24px))] overflow-hidden rounded-xl border border-divider bg-content1 shadow-2xl">
      <button
        type="button"
        className="flex h-11 w-full items-center gap-2 px-3 text-left text-sm font-medium"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="background-task-list"
      >
        {activeCount > 0 ? (
          <LoaderCircle className="size-4 animate-spin text-primary" />
        ) : issueCount > 0 ? (
          <AlertTriangle className="size-4 text-warning" />
        ) : (
          <CheckCircle2 className="size-4 text-success" />
        )}
        <span>{t('mediaTasks.title', 'Background tasks')}</span>
        <span className="text-xs text-default-500">
          {activeCount > 0
            ? t('mediaTasks.activeCount', '{{count}} active', { count: activeCount })
            : issueCount > 0
              ? t('mediaTasks.issueCount', '{{count}} need attention', { count: issueCount })
              : t('mediaTasks.complete', 'Complete')}
        </span>
        {isOpen ? (
          <ChevronDown className="ml-auto size-4" />
        ) : (
          <ChevronUp className="ml-auto size-4" />
        )}
      </button>
      {isOpen && (
        <ul id="background-task-list" className="max-h-80 overflow-y-auto border-t border-divider">
          {visibleJobs.map((job) => {
            const item = job.itemId ? items[job.itemId] : undefined
            const itemName = item && isFileItem(item) ? item.name : undefined
            return (
              <li key={job.id} className="border-b border-divider/60 p-3 last:border-b-0">
                <div className="flex items-start gap-2">
                  <TaskStatusIcon status={job.status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {itemName ?? t(`mediaTasks.types.${job.type}`, job.type)}
                    </div>
                    <div className="text-xs text-default-500">
                      {t(`mediaTasks.status.${job.status}`, job.status)}
                      {job.errorCode ? ` · ${job.errorCode}` : ''}
                      {job.blockedReason ? ` · ${job.blockedReason}` : ''}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-default-100">
                      <div
                        className={`h-full transition-[width] ${
                          ISSUE_STATUSES.has(job.status) ? 'bg-warning' : 'bg-primary'
                        }`}
                        style={{ width: `${job.progress ?? 0}%` }}
                      />
                    </div>
                  </div>
                  <TaskActions job={job} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}

function TaskStatusIcon({ status }: { status: MediaJobRecord['status'] }): React.JSX.Element {
  if (status === 'running')
    return <LoaderCircle className="mt-0.5 size-4 animate-spin text-primary" />
  if (status === 'completed') return <CheckCircle2 className="mt-0.5 size-4 text-success" />
  if (status === 'paused') return <CirclePause className="mt-0.5 size-4 text-warning" />
  if (status === 'failed' || status === 'blocked')
    return <AlertTriangle className="mt-0.5 size-4 text-danger" />
  return <LoaderCircle className="mt-0.5 size-4 text-default-400" />
}

function TaskActions({ job }: { job: MediaJobRecord }): React.JSX.Element {
  if (job.status === 'failed' || job.status === 'blocked' || job.status === 'paused') {
    return (
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        onPress={() => void mediaJobQueue.retry(job.id)}
        aria-label="Retry task"
      >
        {job.status === 'paused' ? <Play size={14} /> : <RotateCcw size={14} />}
      </Button>
    )
  }
  if (job.status === 'queued' || job.status === 'running') {
    return (
      <div className="flex">
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={() => void mediaJobQueue.pause(job.id)}
          aria-label="Pause task"
        >
          <Pause size={14} />
        </Button>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={() => void mediaJobQueue.cancel(job.id)}
          aria-label="Cancel task"
        >
          <X size={14} />
        </Button>
      </div>
    )
  }
  return <span className="w-8" />
}
