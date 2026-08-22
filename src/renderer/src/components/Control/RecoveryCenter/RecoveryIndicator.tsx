import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { collectRecoveryIssues } from '@renderer/lib/recovery-center'
import { countFailedOrBlockedMediaJobs, subscribeMediaJobs } from '@renderer/lib/media-work-db'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'

export default function RecoveryIndicator(): React.JSX.Element | null {
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
    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('focus', refreshAll)
    }
  }, [dismissedIssueIds])

  const count = counts.jobs + counts.other

  if (count === 0) return null

  return (
    <span
      aria-label={`${count} recovery issues`}
      className="inline-flex items-center gap-1 text-warning"
    >
      <AlertTriangle className="size-4" />
      {count}
    </span>
  )
}
