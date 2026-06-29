import { Button } from '@heroui/react/button'
import { FolderOpen, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { getPresentationWorkspacePath } from '@renderer/lib/presentation-media'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'

export default function PresentationWorkspaceHeader(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const documents = usePresentationWorkspaceStore((state) => state.documents)
  const activeItemId = usePresentationWorkspaceStore((state) => state.activeItemId)
  const setActiveDocument = usePresentationWorkspaceStore((state) => state.setActiveDocument)
  const closeDocument = usePresentationWorkspaceStore((state) => state.closeDocument)

  const activateDocument = (itemId: string): void => {
    setActiveDocument(itemId)
    navigate(getPresentationWorkspacePath(itemId))
  }

  const closeTab = (itemId: string): void => {
    closeDocument(itemId)
    const nextActiveItemId = usePresentationWorkspaceStore.getState().activeItemId
    navigate(nextActiveItemId ? getPresentationWorkspacePath(nextActiveItemId) : '/files')
  }

  return (
    <header className="flex h-12 shrink-0 items-end gap-1 border-b border-divider bg-content1/80 px-3">
      <Button
        isIconOnly
        size="sm"
        variant="tertiary"
        className="mb-1"
        onPress={() => navigate('/files')}
        aria-label={t('presentationWorkspace.backToFiles')}
      >
        <FolderOpen size={18} />
      </Button>
      {documents.map((deck) => (
        <div
          key={deck.itemId}
          role="button"
          tabIndex={0}
          className={`flex h-10 max-w-56 items-center gap-2 rounded-t-xl border px-3 text-sm ${
            deck.itemId === activeItemId
              ? 'border-divider border-b-background bg-background text-foreground'
              : 'border-transparent bg-content2 text-default-500 hover:text-foreground'
          }`}
          onClick={() => activateDocument(deck.itemId)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              activateDocument(deck.itemId)
            }
          }}
        >
          <span className="truncate">{deck.name}</span>
          <button
            type="button"
            className="rounded p-0.5 hover:bg-black/10"
            onClick={(event) => {
              event.stopPropagation()
              closeTab(deck.itemId)
            }}
            aria-label={t('presentationWorkspace.closeTab')}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </header>
  )
}
