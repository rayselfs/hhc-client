import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { collectRecoveryIssues } from '@renderer/lib/recovery-center'
import { subscribeMediaJobs } from '@renderer/lib/media-work-db'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'

export default function RecoveryIndicator(): React.JSX.Element | null {
  const [count, setCount] = useState(0)
  const dismissedIssueIds = useRecoveryCenterStore((state) => state.dismissedIssueIds)

  useEffect(() => {
    let cancelled = false
    const refresh = (): void => {
      void collectRecoveryIssues().then((issues) => {
        if (!cancelled) {
          setCount(
            issues.filter(
              (issue) => issue.severity !== 'info' && !dismissedIssueIds.includes(issue.id)
            ).length
          )
        }
      })
    }
    refresh()
    const unsubscribe = subscribeMediaJobs(refresh)
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      unsubscribe()
      window.removeEventListener('focus', refresh)
    }
  }, [dismissedIssueIds])

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
