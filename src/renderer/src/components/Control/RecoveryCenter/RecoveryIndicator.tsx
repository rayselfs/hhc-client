import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { collectRecoveryIssues } from '@renderer/lib/recovery-center'
import { countFailedOrBlockedMediaJobs, subscribeMediaJobs } from '@renderer/lib/media-work-db'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'
import { SYNC_ENTRY_CHANGED_EVENT } from '@renderer/lib/sync-db'
import { RESOURCE_CLEANUP_JOURNAL_CHANGED_EVENT } from '@renderer/lib/resource-cleanup-journal'

export default function RecoveryIndicator(): React.JSX.Element | null {
  const { t } = useTranslation()
  const [counts, setCounts] = useState({ jobs: 0, other: 0 })
  const dismissedIssueIds = useRecoveryCenterStore((state) => state.dismissedIssueIds)

  useEffect(() => {
    let cancelled = false
    let fullRefreshGeneration = 0
    let jobRefreshGeneration = 0
    const dismissedJobIds = dismissedIssueIds.flatMap((id) =>
      id.startsWith('job-failed:') ? [id.slice('job-failed:'.length)] : []
    )
    const refreshAll = (): void => {
      const fullGeneration = ++fullRefreshGeneration
      const jobGeneration = jobRefreshGeneration
      void collectRecoveryIssues().then((issues) => {
        if (cancelled || fullGeneration !== fullRefreshGeneration) return
        const visibleIssues = issues.filter(
          (issue) => issue.severity !== 'info' && !dismissedIssueIds.includes(issue.id)
        )
        setCounts((current) => ({
          jobs:
            jobGeneration === jobRefreshGeneration
              ? visibleIssues.filter((issue) => issue.kind === 'job-failed').length
              : current.jobs,
          other: visibleIssues.filter((issue) => issue.kind !== 'job-failed').length
        }))
      })
    }
    const refreshJobs = (): void => {
      const generation = ++jobRefreshGeneration
      void countFailedOrBlockedMediaJobs(dismissedJobIds).then((jobs) => {
        if (cancelled || generation !== jobRefreshGeneration) return
        setCounts((current) => ({ ...current, jobs }))
      })
    }
    refreshAll()
    const unsubscribe = subscribeMediaJobs(refreshJobs)
    window.addEventListener('focus', refreshAll)
    window.addEventListener(SYNC_ENTRY_CHANGED_EVENT, refreshAll)
    window.addEventListener(RESOURCE_CLEANUP_JOURNAL_CHANGED_EVENT, refreshAll)
    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('focus', refreshAll)
      window.removeEventListener(SYNC_ENTRY_CHANGED_EVENT, refreshAll)
      window.removeEventListener(RESOURCE_CLEANUP_JOURNAL_CHANGED_EVENT, refreshAll)
    }
  }, [dismissedIssueIds])

  const count = counts.jobs + counts.other

  if (count === 0) return null

  return (
    <span
      aria-label={t('recovery.indicatorLabel', { count })}
      className="inline-flex items-center gap-1 text-warning"
    >
      <AlertTriangle className="size-4" />
      {count}
    </span>
  )
}
