import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { collectRecoveryIssues } from '@renderer/lib/recovery-center'
import { countFailedOrBlockedMediaJobs, subscribeMediaJobs } from '@renderer/lib/media-work-db'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'
import { RECOVERY_SOURCE_CHANGED_EVENT } from '@renderer/lib/recovery-source-events'

export default function RecoveryIndicator(): React.JSX.Element | null {
  const { t } = useTranslation()
  const [counts, setCounts] = useState({ jobs: 0, other: 0, unavailable: false })
  const dismissedIssueIds = useRecoveryCenterStore((state) => state.dismissedIssueIds)

  useEffect(() => {
    let cancelled = false
    let fullRefreshGeneration = 0
    let jobRefreshGeneration = 0
    const dismissedJobIds = dismissedIssueIds.flatMap((id) =>
      id.startsWith('job-failed:') ? [id.slice('job-failed:'.length)] : []
    )
    const refreshAll = (event?: Event): void => {
      const generation = ++fullRefreshGeneration
      const jobGeneration = jobRefreshGeneration
      void collectRecoveryIssues(event)
        .then((issues) => {
          if (cancelled || generation !== fullRefreshGeneration) return
          const visibleIssues = issues.filter(
            (issue) => issue.severity !== 'info' && !dismissedIssueIds.includes(issue.id)
          )
          setCounts((current) => ({
            jobs:
              jobGeneration === jobRefreshGeneration
                ? visibleIssues.filter((issue) => issue.kind === 'job-failed').length
                : current.jobs,
            other: visibleIssues.filter((issue) => issue.kind !== 'job-failed').length,
            unavailable: false
          }))
        })
        .catch(() => {
          if (cancelled || generation !== fullRefreshGeneration) return
          setCounts({ jobs: 0, other: 0, unavailable: true })
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
    window.addEventListener(RECOVERY_SOURCE_CHANGED_EVENT, refreshAll)
    return () => {
      cancelled = true
      fullRefreshGeneration++
      unsubscribe()
      window.removeEventListener('focus', refreshAll)
      window.removeEventListener(RECOVERY_SOURCE_CHANGED_EVENT, refreshAll)
    }
  }, [dismissedIssueIds])

  const count = counts.jobs + counts.other

  if (counts.unavailable) {
    return (
      <span
        role="status"
        aria-label={t('recovery.unavailable')}
        className="inline-flex text-warning"
      >
        <AlertTriangle className="size-4" />
      </span>
    )
  }
  if (count === 0) return null

  return (
    <span
      role="status"
      aria-label={t('recovery.indicatorLabel', { count })}
      className="inline-flex items-center gap-1 text-warning"
    >
      <AlertTriangle className="size-4" />
      {count}
    </span>
  )
}
