import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { collectRecoveryIssues, runRecoveryAction } from '@renderer/lib/recovery-center'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'
import type {
  RecoveryFilter,
  RecoveryIssue,
  RecoveryTranslationKey
} from '@renderer/types/recovery-center'

const FILTERS: RecoveryFilter[] = ['all', 'media', 'sync', 'storage', 'projection']
const FILTER_LABEL_KEYS: Record<RecoveryFilter, RecoveryTranslationKey> = {
  all: 'recovery.filters.all',
  media: 'recovery.filters.media',
  sync: 'recovery.filters.sync',
  storage: 'recovery.filters.storage',
  projection: 'recovery.filters.projection'
}

function matchesFilter(issue: RecoveryIssue, filter: RecoveryFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'media') {
    return ['job-failed', 'media-missing', 'asset-failed'].includes(issue.kind)
  }
  if (filter === 'sync') return issue.kind.startsWith('sync-')
  if (filter === 'storage') return issue.kind === 'storage-integrity'
  return issue.kind === 'projection-health'
}

export default function RecoveryCenterPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const [issues, setIssues] = useState<RecoveryIssue[]>([])
  const dismissedIssueIds = useRecoveryCenterStore((state) => state.dismissedIssueIds)
  const dismissIssue = useRecoveryCenterStore((state) => state.dismissIssue)
  const pruneDismissedIssues = useRecoveryCenterStore((state) => state.pruneDismissedIssues)
  const filter = useRecoveryCenterStore((state) => state.filter)
  const setFilter = useRecoveryCenterStore((state) => state.setFilter)

  const refresh = useCallback(async (): Promise<void> => {
    const nextIssues = await collectRecoveryIssues()
    setIssues(nextIssues)
    pruneDismissedIssues(nextIssues.map((issue) => issue.id))
  }, [pruneDismissedIssues])

  useEffect(() => {
    let cancelled = false
    void collectRecoveryIssues().then((nextIssues) => {
      if (cancelled) return
      setIssues(nextIssues)
      pruneDismissedIssues(nextIssues.map((issue) => issue.id))
    })
    return () => {
      cancelled = true
    }
  }, [pruneDismissedIssues])

  const visibleIssues = useMemo(
    () =>
      issues.filter(
        (issue) => !dismissedIssueIds.includes(issue.id) && matchesFilter(issue, filter)
      ),
    [issues, dismissedIssueIds, filter]
  )

  return (
    <section className="space-y-4 p-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === item ? 'bg-accent text-accent-foreground' : 'bg-default-100'
            }`}
            onClick={() => setFilter(item)}
          >
            {t(FILTER_LABEL_KEYS[item])}
          </button>
        ))}
      </div>

      {visibleIssues.length === 0 ? (
        <p className="text-sm text-muted">{t('recovery.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {visibleIssues.map((issue) => (
            <li key={issue.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 text-warning" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{t(issue.titleKey)}</h3>
                  <p className="text-xs text-muted">{t(issue.detailKey)}</p>
                  <div className="mt-3 flex gap-2">
                    {issue.actions.slice(0, 1).map((action) => (
                      <button
                        key={action.type}
                        type="button"
                        className="rounded-md bg-accent px-2 py-1 text-xs text-accent-foreground"
                        onClick={() =>
                          void runRecoveryAction(action.type, issue.sourceId).then(refresh)
                        }
                      >
                        {t(action.labelKey)}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="rounded-md border border-border px-2 py-1 text-xs"
                      onClick={() => dismissIssue(issue.id)}
                    >
                      {t('recovery.dismiss')}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
