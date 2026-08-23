import { useCallback, useEffect, useRef } from 'react'
import { toast } from '@heroui/react/toast'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import MediaPresenter from '@renderer/components/Control/FileExplorer/Presenter/MediaPresenter'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { closeProjectionAndMediaSession } from '@renderer/lib/projection-actions'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

export default function MediaWorkspacePage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { stopProjection } = useProjection()
  const isPresenting = useMediaProjectionStore((state) => state.isPresenting)
  const endLiveSession = useMediaProjectionStore((state) => state.endLiveSession)
  const isClosingRef = useRef(false)

  useEffect(() => {
    if (!isPresenting) navigate('/files', { replace: true })
  }, [isPresenting, navigate])

  const handleExit = useCallback(async (): Promise<void> => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    try {
      await closeProjectionAndMediaSession({ closeProjection: stopProjection, endLiveSession })
    } catch {
      toast.danger(t('toast.projectionCloseFailed'))
    } finally {
      isClosingRef.current = false
    }
  }, [endLiveSession, stopProjection, t])

  return <MediaPresenter onExit={() => void handleExit()} />
}
