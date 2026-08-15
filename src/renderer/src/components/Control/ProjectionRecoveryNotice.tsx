import { Alert, Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useProjection } from '@renderer/contexts/ProjectionContext'

const FAILURE_KEYS = {
  'popup-blocked': 'popupBlocked',
  'ready-timeout': 'readyTimeout',
  'renderer-crash': 'rendererCrash'
} as const

export default function ProjectionRecoveryNotice(): React.JSX.Element | null {
  const { t } = useTranslation()
  const { recovery, vlcFailure, retryProjection } = useProjection()

  if (!vlcFailure && recovery.status !== 'recovering' && recovery.status !== 'failed') return null

  const isFailed = Boolean(vlcFailure) || recovery.status === 'failed'
  const failureKey = recovery.failure ? FAILURE_KEYS[recovery.failure.reason] : 'rendererCrash'
  const titleKey = isFailed ? failureKey : 'recovering'
  const canRetry = vlcFailure?.recoverable ?? isFailed

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <Alert
        status={isFailed ? 'danger' : 'accent'}
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-full max-w-2xl shadow-lg"
      >
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>{t(`projection.recovery.${titleKey}Title`)}</Alert.Title>
          <Alert.Description>
            {vlcFailure?.message ?? t(`projection.recovery.${titleKey}Description`)}
          </Alert.Description>
        </Alert.Content>
        {canRetry && (
          <Button
            size="sm"
            variant="danger"
            onPress={() => {
              void retryProjection()
            }}
          >
            {t('projection.recovery.retry')}
          </Button>
        )}
      </Alert>
    </div>
  )
}
