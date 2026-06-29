import { useEffect, useRef, useState } from 'react'
import { Button } from '@heroui/react/button'
import { ButtonGroup } from '@heroui/react/button-group'
import { toast } from '@heroui/react/toast'
import { Home, Monitor, Undo2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { hasNameConflict, splitFileName, validateDisplayName } from '@renderer/lib/file-naming'
import { openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import {
  getPresentationWorkspacePath,
  isEditablePresentationMimeType,
  isPresentationItem
} from '@renderer/lib/presentation-media'
import { startMediaProjection, stopProjectionSession } from '@renderer/lib/projection-actions'
import {
  loadEditablePresentation,
  saveEditablePresentation
} from '@renderer/lib/editable-presentation'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import { isFileItem } from '@shared/types/folder'
import type { FileItemRecord } from '@shared/types/folder'

export default function PresentationWorkspaceHeader(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isProjectionOpen, stopProjection } = useProjection()
  const documents = usePresentationWorkspaceStore((state) => state.documents)
  const activeItemId = usePresentationWorkspaceStore((state) => state.activeItemId)
  const activeDocument = usePresentationWorkspaceStore((state) => state.getActiveDocument())
  const setActiveDocument = usePresentationWorkspaceStore((state) => state.setActiveDocument)
  const updateDocumentName = usePresentationWorkspaceStore((state) => state.updateDocumentName)
  const closeDocument = usePresentationWorkspaceStore((state) => state.closeDocument)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [undoState, setUndoState] = useState<{ itemId: string; canUndo: boolean } | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const canUndo = undoState?.itemId === activeItemId && undoState.canUndo

  useEffect(() => {
    const handleUndoState = (event: Event): void => {
      const detail = (event as CustomEvent<{ itemId: string; canUndo: boolean }>).detail
      if (!detail || detail.itemId !== activeItemId) return
      setUndoState(detail)
    }
    window.addEventListener('hhc:presentation-undo-state', handleUndoState)
    return () => window.removeEventListener('hhc:presentation-undo-state', handleUndoState)
  }, [activeItemId])

  useEffect(() => {
    if (!editingItemId) return
    editInputRef.current?.focus()
    editInputRef.current?.select()
  }, [editingItemId])

  const activateDocument = (itemId: string): void => {
    setActiveDocument(itemId)
    navigate(getPresentationWorkspacePath(itemId))
  }

  const closeTab = (itemId: string): void => {
    closeDocument(itemId)
    const nextActiveItemId = usePresentationWorkspaceStore.getState().activeItemId
    navigate(nextActiveItemId ? getPresentationWorkspacePath(nextActiveItemId) : '/files')
  }

  const startRename = (deck: { itemId: string; name: string }): void => {
    const { base } = splitFileName(deck.name)
    setEditingItemId(deck.itemId)
    setEditingName(base)
  }

  const cancelRename = (): void => {
    setEditingItemId(null)
    setEditingName('')
  }

  const renameDocument = async (itemId: string, nextBaseName: string): Promise<void> => {
    const trimmedBase = nextBaseName.trim()
    const currentDeck = documents.find((deck) => deck.itemId === itemId)
    if (!currentDeck) return
    if (!validateDisplayName(trimmedBase)) {
      toast.danger(t('fileExplorer.invalidName', 'Invalid name'))
      return
    }

    const { extension } = splitFileName(currentDeck.name)
    const nextName = `${trimmedBase}${extension}`
    if (nextName === currentDeck.name) {
      cancelRename()
      return
    }

    const db = await openFileExplorerDB()
    const item = await db.get('folder-items', itemId)
    if (!item || !isFileItem(item)) return

    const siblings = await db.getAllFromIndex('folder-items', 'by-parent', item.parentId)
    const siblingNames = siblings
      .filter(
        (entry): entry is FileItemRecord =>
          isFileItem(entry) && entry.id !== item.id && !entry.deletedAt
      )
      .map((entry) => entry.name)
    if (hasNameConflict(nextName, siblingNames)) {
      toast.danger(t('fileExplorer.fileAlreadyExists', 'A file with this name already exists'))
      return
    }

    const updatedItem: FileItemRecord = { ...item, name: nextName }
    await db.put('folder-items', updatedItem)
    useFileExplorerStore.getState().updateItem?.(itemId, { name: nextName })
    updateDocumentName(itemId, nextName)

    if (isEditablePresentationMimeType(item.mimeType)) {
      const document = await loadEditablePresentation(item)
      await saveEditablePresentation(updatedItem, { ...document, name: nextName })
    }
    cancelRename()
  }

  const presentActiveDocument = async (): Promise<void> => {
    if (!activeDocument) return

    const db = await openFileExplorerDB()
    const item = await db.get('folder-items', activeDocument.itemId)
    if (!item || !isFileItem(item) || !isPresentationItem(item)) return

    const slideIndex = usePresentationWorkspaceStore.getState().getActiveSlide(item.id)
    const report = await startMediaProjection(
      [item],
      0,
      { onNoProjectableFiles: () => toast.warning(t('fileExplorer.noProjectableFiles')) },
      { prioritizeStartItem: true }
    )
    if (report.summary.ready > 0) {
      useMediaProjectionStore.getState().setTypeState('presentation', {
        slideIndex,
        slideCount: activeDocument.slideCount
      })
    }
  }

  const handleProjectionAction = async (): Promise<void> => {
    if (!isProjectionOpen) {
      await presentActiveDocument()
      return
    }

    await stopProjectionSession({ stopProjection }).catch(() => {
      toast.danger(t('toast.projectionCloseFailed'))
    })
  }

  return (
    <header className="relative flex h-12 shrink-0 items-end gap-1 bg-content1/80 px-3">
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-divider" />
      <Button
        isIconOnly
        variant="ghost"
        className="relative z-10 mb-1"
        onPress={() => navigate('/files')}
        aria-label={t('presentationWorkspace.backToFiles')}
      >
        <Home size={18} />
      </Button>
      <Button
        isIconOnly
        variant="ghost"
        className="relative z-10 mb-1"
        isDisabled={!canUndo}
        onPress={() => {
          if (!activeItemId) return
          window.dispatchEvent(
            new CustomEvent('hhc:presentation-undo-request', {
              detail: { itemId: activeItemId }
            })
          )
        }}
        aria-label={t('presentationWorkspace.undo', 'Undo')}
      >
        <Undo2 size={18} />
      </Button>
      {documents.map((deck) => (
        <div
          key={deck.itemId}
          role="button"
          tabIndex={0}
          className={`relative flex h-10 max-w-56 items-center gap-2 rounded-t-xl border px-3 text-sm ${
            deck.itemId === activeItemId
              ? 'z-20 -mb-px border-divider border-b-background bg-background text-foreground shadow-sm'
              : 'z-10 mb-px border-transparent bg-content2 text-default-500 hover:text-foreground'
          }`}
          onClick={() => {
            if (editingItemId !== deck.itemId) activateDocument(deck.itemId)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              activateDocument(deck.itemId)
            }
          }}
        >
          {editingItemId === deck.itemId ? (
            <input
              ref={editInputRef}
              className="min-w-0 flex-1 rounded-md border border-primary/50 bg-background px-1 text-sm text-foreground outline-none"
              value={editingName}
              aria-label={t('fileExplorer.renameFile', 'Rename file')}
              onChange={(event) => setEditingName(event.currentTarget.value)}
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              onBlur={() => void renameDocument(deck.itemId, editingName)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelRename()
                  return
                }
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void renameDocument(deck.itemId, editingName)
                }
              }}
            />
          ) : (
            <span
              className="min-w-0 flex-1 truncate"
              onDoubleClick={(event) => {
                event.stopPropagation()
                startRename(deck)
              }}
            >
              {deck.name}
            </span>
          )}
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
      <div className="relative z-10 mb-1 ml-auto flex items-center">
        <ButtonGroup size="lg">
          <Button
            isIconOnly
            variant="outline"
            className={isProjectionOpen ? 'text-danger px-6' : 'text-default-foreground px-6'}
            onPress={() => void handleProjectionAction()}
            isDisabled={!isProjectionOpen && !activeDocument}
            aria-label={t(isProjectionOpen ? 'projection.stopButton' : 'projection.startButton')}
          >
            {isProjectionOpen ? <X className="size-4" /> : <Monitor className="size-4" />}
          </Button>
        </ButtonGroup>
      </div>
    </header>
  )
}
