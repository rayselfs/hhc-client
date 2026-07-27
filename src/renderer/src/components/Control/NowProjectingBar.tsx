import { Button, Card } from '@heroui/react'
import { CircleAlert, CircleDot, MonitorUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import {
  deriveNowProjectingStatus,
  type NowProjectingStatus
} from '@renderer/lib/projection-session-summary'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

const STATUS_CLASS: Record<NowProjectingStatus, string> = {
  closed: 'text-muted',
  opening: 'text-warning',
  connected: 'text-accent',
  projecting: 'text-success',
  degraded: 'text-warning',
  failed: 'text-danger'
}

export async function closeProjectionAndMediaSession({
  closeProjection,
  endLiveSession
}: {
  closeProjection: () => Promise<void>
  endLiveSession: () => void
}): Promise<void> {
  await closeProjection()
  endLiveSession()
}

export default function NowProjectingBar(): React.JSX.Element | null {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const {
    isProjectionOpen,
    recovery,
    sessionSummary,
    retryProjection,
    blackoutProjection,
    closeProjection,
    getProjectionSnapshot
  } = useProjection()
  const lastReadinessReport = useMediaProjectionStore((state) => state.lastReadinessReport)
  const endLiveSession = useMediaProjectionStore((state) => state.endLiveSession)
  const skippedMediaCount =
    sessionSummary.owner === 'media' && lastReadinessReport
      ? lastReadinessReport.summary.preparing +
        lastReadinessReport.summary.unsupported +
        lastReadinessReport.summary.missing +
        lastReadinessReport.summary.failed
      : 0
  const status = deriveNowProjectingStatus({
    recovery,
    isProjectionOpen,
    hasSnapshot: getProjectionSnapshot() !== null,
    isBlackout: sessionSummary.isBlackout,
    skippedMediaCount
  })

  if (status === 'closed') return null

  const owner = sessionSummary.owner ?? 'timer'
  const ownerLabel = t(`nowProjecting.owners.${owner}`, owner)
  const contentLabel = sessionSummary.label ?? ownerLabel
  const statusLabel = t(`nowProjecting.statuses.${status}`, status)

  return (
    <Card
      role="status"
      aria-live="polite"
      variant="secondary"
      className="mx-3 mt-2 flex-row items-center gap-3 rounded-xl px-3 py-2"
      data-testid="now-projecting-bar"
    >
      <div className={`shrink-0 ${STATUS_CLASS[status]}`}>
        {status === 'failed' || status === 'degraded' ? (
          <CircleAlert className="size-5" aria-hidden="true" />
        ) : status === 'projecting' ? (
          <MonitorUp className="size-5" aria-hidden="true" />
        ) : (
          <CircleDot className="size-5" aria-hidden="true" />
        )}
      </div>
      <Card.Content className="min-w-0 flex-1 p-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={`shrink-0 text-sm font-semibold ${STATUS_CLASS[status]}`}>
            {statusLabel}
          </span>
          <span className="hidden shrink-0 text-xs text-muted sm:inline">{ownerLabel}</span>
          <span className="truncate text-sm">{contentLabel}</span>
        </div>
      </Card.Content>
      <Card.Footer className="ml-auto flex shrink-0 flex-wrap justify-end gap-1 p-0">
        {sessionSummary.owner === 'media' && (
          <Button
            size="sm"
            variant="tertiary"
            data-testid="now-projecting-return-media"
            onPress={() => void navigate('/media')}
            aria-label={t('nowProjecting.actions.returnToMedia', 'Return to Media Workspace')}
          >
            <span className="hidden lg:inline">
              {t('nowProjecting.actions.returnToMedia', 'Return to Media Workspace')}
            </span>
            <span className="lg:hidden">{t('nav.media', 'Media')}</span>
          </Button>
        )}
        {status === 'failed' && (
          <Button size="sm" variant="secondary" onPress={() => void retryProjection()}>
            {t('nowProjecting.actions.retry', 'Retry')}
          </Button>
        )}
        {sessionSummary.isBlackout ? (
          <Button
            size="sm"
            variant="secondary"
            data-testid="now-projecting-resume"
            onPress={() => void blackoutProjection(false)}
          >
            {t('nowProjecting.actions.resume', 'Resume Content')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            data-testid="now-projecting-stop"
            onPress={() => void blackoutProjection(true)}
          >
            {t('nowProjecting.actions.stop', 'Stop Content')}
          </Button>
        )}
        <Button
          size="sm"
          variant="danger"
          data-testid="now-projecting-close"
          onPress={() => void closeProjectionAndMediaSession({ closeProjection, endLiveSession })}
        >
          {t('nowProjecting.actions.close', 'Close Projection')}
        </Button>
      </Card.Footer>
    </Card>
  )
}
