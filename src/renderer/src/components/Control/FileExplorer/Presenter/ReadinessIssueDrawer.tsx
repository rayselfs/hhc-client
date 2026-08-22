import { useMemo, useState } from 'react'
import { Button } from '@heroui/react/button'
import { AlertTriangle, ExternalLink, RotateCcw, SkipForward, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { listMediaJobs } from '@renderer/lib/media-work-db'
import { mediaJobQueue } from '@renderer/lib/media-job-queue'
import type {
  PresentationReadinessItem,
  PresentationReadinessReport
} from '@renderer/lib/presentation-readiness'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { isFileItem } from '@shared/types/folder'

interface ReadinessIssueDrawerProps {
  report: PresentationReadinessReport
  onClose: () => void
}

export default function ReadinessIssueDrawer({
  report,
  onClose
}: ReadinessIssueDrawerProps): React.JSX.Element {
  const { t } = useTranslation()
  const items = useFileExplorerStore((state) => state.items)
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => new Set())
  const issues = useMemo(
    () =>
      report.items.filter((item) => item.status !== 'ready' && !acknowledgedIds.has(item.itemId)),
    [acknowledgedIds, report.items]
  )

  const retryPreparation = async (item: PresentationReadinessItem): Promise<void> => {
    const jobs = await listMediaJobs()
    const job = jobs
      .filter((candidate) => candidate.itemId === item.itemId)
      .sort((left, right) => right.updatedAt - left.updatedAt)[0]
    if (!job) {
      window.dispatchEvent(new CustomEvent('hhc:open-recovery-center'))
      return
    }
    if (['failed', 'blocked', 'paused'].includes(job.status)) {
      await mediaJobQueue.retry(job.id)
    } else if (job.status === 'queued') {
      await mediaJobQueue.setPriority(job.id, 100)
    }
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-[min(420px,100%)] flex-col border-l border-divider bg-content1 shadow-2xl">
      <div className="flex h-12 items-center border-b border-divider px-4">
        <AlertTriangle className="mr-2 size-4 text-warning" />
        <h2 className="font-semibold">
          {t('fileExplorer.presenter.readinessIssues', 'Readiness issues')}
        </h2>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="ml-auto"
          onPress={onClose}
          aria-label={t('common.close')}
        >
          <X size={16} />
        </Button>
      </div>
      <p className="border-b border-divider px-4 py-3 text-xs text-default-500">
        {t(
          'fileExplorer.presenter.readinessHelp',
          'These items remain in this session until you repair or explicitly skip them.'
        )}
      </p>
      {issues.length === 0 ? (
        <div className="p-6 text-sm text-default-500">
          {t('fileExplorer.presenter.noReadinessIssues', 'No unresolved readiness issues')}
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {issues.map((issue) => {
            const sourceItem = items[issue.itemId]
            const name = sourceItem && isFileItem(sourceItem) ? sourceItem.name : issue.itemId
            const repairable = issue.status === 'preparing' || issue.status === 'failed'
            return (
              <li key={issue.itemId} className="border-b border-divider p-4">
                <div className="truncate text-sm font-medium">{name}</div>
                <div className="mt-1 text-xs text-default-500">
                  {t(`fileExplorer.presenter.readinessStatus.${issue.status}`, issue.status)} ·{' '}
                  {issue.reason}
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onPress={() => {
                      if (repairable) {
                        void retryPreparation(issue)
                      } else {
                        window.dispatchEvent(new CustomEvent('hhc:open-recovery-center'))
                      }
                    }}
                  >
                    {repairable ? <RotateCcw size={14} /> : <ExternalLink size={14} />}
                    {repairable
                      ? t('fileExplorer.presenter.retryPreparation', 'Retry')
                      : t('fileExplorer.presenter.openRecovery', 'Open Recovery Center')}
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={() =>
                      setAcknowledgedIds((current) => new Set([...current, issue.itemId]))
                    }
                  >
                    <SkipForward size={14} />
                    {t('fileExplorer.presenter.skipItem', 'Skip')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
