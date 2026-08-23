import { Alert, Button, Spinner } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import type { FolderPersistenceStatus } from '@renderer/stores/folder'

type FolderPersistenceStatusProps = {
  status: FolderPersistenceStatus
  error: string | null
  isInitialized: boolean
  onRetryInitialization: () => Promise<void>
  onRetryPersistence: () => Promise<void>
  className?: string
}

export function FolderPersistenceStatus({
  status,
  error,
  isInitialized,
  onRetryInitialization,
  onRetryPersistence,
  className
}: FolderPersistenceStatusProps): React.JSX.Element | null {
  const { t } = useTranslation()

  if (status === 'ready' || status === 'saving') return null

  const isLoadFailure = status === 'degraded' && !isInitialized
  const isWriteFailure = status === 'degraded' && isInitialized
  const title = isLoadFailure
    ? t('folder.persistence.loadFailed')
    : isWriteFailure
      ? t('folder.persistence.saveFailed')
      : t('folder.persistence.loading')
  const description =
    status === 'degraded'
      ? error || t('folder.persistence.unknownError')
      : t('folder.persistence.loadingDescription')

  return (
    <Alert className={className} status={status === 'degraded' ? 'danger' : 'accent'}>
      <Alert.Indicator>
        {status === 'initializing' ? <Spinner size="sm" /> : undefined}
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        <Alert.Description>{description}</Alert.Description>
      </Alert.Content>
      {status === 'degraded' ? (
        <Button
          size="sm"
          variant="danger"
          onPress={() => void (isLoadFailure ? onRetryInitialization() : onRetryPersistence())}
        >
          {t('folder.persistence.retry')}
        </Button>
      ) : null}
    </Alert>
  )
}
