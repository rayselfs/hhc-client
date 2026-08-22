import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { collectRecoveryIssues, runRecoveryAction } from '@renderer/lib/recovery-center'
import { useRecoveryCenterStore } from '@renderer/stores/recovery-center'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { RECOVERY_SOURCE_CHANGED_EVENT } from '@renderer/lib/recovery-source-events'
import type {
  RecoveryFilter,
  RecoveryIssue,
  RecoveryTranslationKey
} from '@renderer/types/recovery-center'

const FILTERS: RecoveryFilter[] = ['all', 'media', 'sync', 'storage']
const FILTER_LABEL_KEYS: Record<RecoveryFilter, RecoveryTranslationKey> = {
  all: 'recovery.filters.all',
  media: 'recovery.filters.media',
  sync: 'recovery.filters.sync',
  storage: 'recovery.filters.storage'
}

function matchesFilter(issue: RecoveryIssue, filter: RecoveryFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'media') {
    return ['job-failed', 'media-missing', 'asset-failed'].includes(issue.kind)
  }
  if (filter === 'sync') return issue.kind.startsWith('sync-')
  return ['storage-integrity', 'resource-cleanup-failed'].includes(issue.kind)
}

export default function RecoveryCenterPanel(): React.JSX.Element {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const [issues, setIssues] = useState<RecoveryIssue[]>([])
  const [unavailable, setUnavailable] = useState(false)
  const dismissedIssueIds = useRecoveryCenterStore((state) => state.dismissedIssueIds)
  const dismissIssue = useRecoveryCenterStore((state) => state.dismissIssue)
  const pruneDismissedIssues = useRecoveryCenterStore((state) => state.pruneDismissedIssues)
  const filter = useRecoveryCenterStore((state) => state.filter)
  const setFilter = useRecoveryCenterStore((state) => state.setFilter)
  const refreshGeneration = useRef(0)

  const refresh = useCallback(
    async (event?: Event): Promise<void> => {
      const generation = ++refreshGeneration.current
      try {
        const nextIssues = await collectRecoveryIssues(event)
        if (generation !== refreshGeneration.current) return
        setIssues(nextIssues)
        setUnavailable(false)
        pruneDismissedIssues(nextIssues.map((issue) => issue.id))
      } catch {
        if (generation !== refreshGeneration.current) return
        setIssues([])
        setUnavailable(true)
      }
    },
    [pruneDismissedIssues]
  )

  useEffect(() => {
    const generationRef = refreshGeneration
    const generation = ++generationRef.current
    queueMicrotask(() => {
      if (generation === generationRef.current) void refresh()
    })
    return () => {
      generationRef.current++
    }
  }, [refresh])

  useEffect(() => {
    const handleRefresh = (event: Event): void => void refresh(event)
    window.addEventListener(RECOVERY_SOURCE_CHANGED_EVENT, handleRefresh)
    return () => {
      window.removeEventListener(RECOVERY_SOURCE_CHANGED_EVENT, handleRefresh)
    }
  }, [refresh])

  const visibleIssues = useMemo(
    () =>
      issues.filter(
        (issue) => !dismissedIssueIds.includes(issue.id) && matchesFilter(issue, filter)
      ),
    [issues, dismissedIssueIds, filter]
  )

  const runAction = async (
    issue: RecoveryIssue,
    action: RecoveryIssue['actions'][number]
  ): Promise<void> => {
    if (
      action.destructive &&
      !(await confirm({
        status: 'danger',
        title: t('recovery.cancelJobConfirmTitle'),
        description: t('recovery.cancelJobConfirmDescription'),
        confirmLabel: t(action.labelKey),
        cancelLabel: t('common.cancel')
      }))
    ) {
      return
    }
    await runRecoveryAction(action.type, issue.sourceId)
    await refresh(new Event(RECOVERY_SOURCE_CHANGED_EVENT))
  }

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

      {unavailable ? (
        <p className="text-sm text-danger">{t('recovery.unavailable')}</p>
      ) : visibleIssues.length === 0 ? (
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
                    {issue.actions.map((action) => (
                      <button
                        key={action.type}
                        type="button"
                        className={`rounded-md px-2 py-1 text-xs ${
                          action.destructive
                            ? 'bg-danger text-danger-foreground'
                            : 'bg-accent text-accent-foreground'
                        }`}
                        onClick={() => void runAction(issue, action)}
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
