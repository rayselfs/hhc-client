import { useNavigate } from 'react-router-dom'
import MediaPresenter from '@renderer/components/Control/FileExplorer/Presenter/MediaPresenter'

export default function MediaWorkspacePage(): React.JSX.Element {
  const navigate = useNavigate()

  return <MediaPresenter onExit={() => navigate('/files')} />
}
