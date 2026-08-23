import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MediaPresenter from '@renderer/components/Control/FileExplorer/Presenter/MediaPresenter'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

export default function MediaWorkspacePage(): React.JSX.Element {
  const navigate = useNavigate()
  const isPresenting = useMediaProjectionStore((state) => state.isPresenting)
  const endLiveSession = useMediaProjectionStore((state) => state.endLiveSession)

  useEffect(() => {
    if (!isPresenting) navigate('/files', { replace: true })
  }, [isPresenting, navigate])

  return <MediaPresenter onExit={endLiveSession} />
}
