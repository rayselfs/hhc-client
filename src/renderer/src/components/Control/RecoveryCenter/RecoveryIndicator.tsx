import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { collectRecoveryIssues } from '@renderer/lib/recovery-center'

export default function RecoveryIndicator(): React.JSX.Element | null {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    void collectRecoveryIssues().then((issues) => {
      if (!cancelled) setCount(issues.filter((issue) => issue.severity !== 'info').length)
    })
    return () => {
      cancelled = true
    }
  }, [])

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
