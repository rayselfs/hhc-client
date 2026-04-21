import React, { useCallback } from 'react'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { formatVerseReferenceShort } from '@renderer/lib/bible-utils'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import type { VerseItemRecord, FolderRecord, AnyItemRecord } from '@shared/types/folder'
import { isVerseItem, isFolderRecord } from '@shared/types/folder'
import { useChildFolders, useItems } from '@renderer/stores/selectors/folder'
import { Button } from '@heroui/react'
import { Folder as FolderIcon, X, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useFolderContextMenu } from '@renderer/components/Control/Folder/useFolderContextMenu'
import {
  FolderBrowser,
  type FolderBrowserHandlers
} from '@renderer/components/Control/Folder/FolderBrowser'

interface CustomFolderTabProps {
  isModalOpen?: boolean
  onModalOpenChange?: (open: boolean) => void
}

function getVerseReference(item: VerseItemRecord, t: TFunction): string {
  return formatVerseReferenceShort(t, item.bookNumber, item.chapter, item.verse)
}

export function CustomFolderTab({
  isModalOpen = false,
  onModalOpenChange = () => {}
}: CustomFolderTabProps): React.JSX.Element {
  const { currentFolderId } = useBibleFolderStore()
  const { navigateTo } = useBibleStore.getState()
  const { claimProjection, project } = useProjection()
  const { t } = useTranslation()

  const contextMenu = useFolderContextMenu()
  const folders = useChildFolders(currentFolderId)
  const verses = useItems(currentFolderId)

  const handleVerseDoubleClick = useCallback(
    (item: VerseItemRecord) => {
      const { content, versions } = useBibleStore.getState()
      const { selectedVersionId, setSelectedVersionId } = useBibleSettingsStore.getState()

      const targetVersionId =
        item.versionId && versions.some((v) => v.id === item.versionId)
          ? item.versionId
          : selectedVersionId
      if (targetVersionId !== selectedVersionId) {
        setSelectedVersionId(targetVersionId)
      }

      navigateTo({ bookNumber: item.bookNumber, chapter: item.chapter, verse: item.verse })
      const books = content?.get(targetVersionId)
      const book = books?.find((b) => b.number === item.bookNumber)
      const chapter = book?.chapters.find((c) => c.number === item.chapter)
      if (!chapter) return
      claimProjection('bible', { unblank: true })
      project(
        'bible:chapter',
        {
          bookNumber: item.bookNumber,
          chapter: item.chapter,
          chapterVerses: chapter.verses.map((v) => ({ number: v.number, text: v.text })),
          currentVerse: item.verse
        },
        { autoOpen: true }
      )
    },
    [navigateTo, claimProjection, project]
  )

  const getItemReference = useCallback(
    (item: AnyItemRecord): string => {
      return isVerseItem(item) ? getVerseReference(item, t) : item.id
    },
    [t]
  )

  const renderFolderContent = useCallback(
    (
      folder: FolderRecord,
      isSelected: boolean,
      _isDragging: boolean,
      folderDropTargetId: string | null,
      handlers: FolderBrowserHandlers
    ): React.ReactNode => {
      const isFolderDropTarget = folderDropTargetId === folder.id

      return (
        <div
          role="option"
          tabIndex={-1}
          aria-selected={isSelected}
          onClick={(e) => handlers.handleItemClick(folder.id, e)}
          onDoubleClick={() => handlers.navigateToFolder(folder.id)}
          onContextMenu={(e) => handlers.handleContextMenuForFolder(folder, e)}
          onKeyDown={(e) =>
            (e.key === 'Enter' || e.key === ' ') &&
            handlers.handleItemClick(folder.id, e as unknown as React.MouseEvent)
          }
          className={[
            'flex items-center justify-between rounded-3xl p-3 group select-none transition-colors',
            isSelected
              ? 'bg-accent text-accent-foreground'
              : isFolderDropTarget
                ? 'bg-accent-soft ring-2 ring-accent/50 ring-dashed'
                : ''
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="flex items-center gap-2 min-w-0 w-full">
            <FolderIcon
              className={`w-4 h-4 shrink-0 ${isSelected ? 'text-accent-foreground' : 'text-muted'}`}
            />
            <span className="font-medium truncate flex-1">{folder.name}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer hover:bg-transparent!"
            onPress={() => handlers.handleDeleteFolder(folder.id, folder.name)}
            aria-label={t('bible.custom.deleteFolderTitle', {
              name: folder.name,
              defaultValue: `Delete ${folder.name}`
            })}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )
    },
    [t]
  )

  const renderItemContent = useCallback(
    (
      item: AnyItemRecord,
      isSelected: boolean,
      _isDragging: boolean,
      handlers: FolderBrowserHandlers
    ): React.ReactNode => {
      const reference = isVerseItem(item) ? getVerseReference(item, t) : item.id

      return (
        <div
          role="option"
          tabIndex={-1}
          aria-selected={isSelected}
          onClick={(e) => handlers.handleItemClick(item.id, e)}
          onDoubleClick={() => isVerseItem(item) && handleVerseDoubleClick(item)}
          onContextMenu={(e) => handlers.handleContextMenuForItem(item, e)}
          onKeyDown={(e) =>
            (e.key === 'Enter' || e.key === ' ') &&
            handlers.handleItemClick(item.id, e as unknown as React.MouseEvent)
          }
          className={[
            'flex items-center justify-between rounded-3xl p-3 group select-none transition-colors',
            isSelected ? 'bg-accent text-accent-foreground' : ''
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="flex items-center gap-1 w-full min-w-0">
            <div className="flex items-center gap-2 text-left min-w-0 w-full">
              <div className="min-w-0">
                <div className={`truncate ${isSelected ? 'text-accent-foreground' : 'text-muted'}`}>
                  {reference}
                </div>
                <div className="text-lg whitespace-normal">
                  {isVerseItem(item) ? item.text : ''}
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer hover:bg-transparent!"
            onPress={() => handlers.handleDeleteItem(item)}
            aria-label={t('bible.custom.deleteItemTitle', {
              reference,
              defaultValue: `Delete ${reference}`
            })}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )
    },
    [t, handleVerseDoubleClick]
  )

  const renderDragOverlay = useCallback(
    (item: FolderRecord | AnyItemRecord, draggedCount: number): React.ReactNode => {
      return (
        <div className="relative w-fit">
          {draggedCount >= 2 && (
            <>
              <div className="absolute inset-0 translate-x-1 translate-y-1 rounded-full bg-accent/60 shadow" />
              <div className="absolute inset-0 translate-x-0.5 translate-y-0.5 rounded-full bg-accent/80 shadow" />
            </>
          )}
          <div className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-accent text-accent-foreground shadow-lg text-sm">
            {isFolderRecord(item) ? (
              <>
                <FolderIcon className="w-3.5 h-3.5" />
                <span>{item.name}</span>
              </>
            ) : isVerseItem(item) ? (
              <>
                <BookOpen className="w-3.5 h-3.5" />
                <span>{getVerseReference(item, t)}</span>
              </>
            ) : null}
          </div>
          {draggedCount >= 2 && (
            <span className="absolute -top-2 -right-2 min-w-5 h-5 flex items-center justify-center rounded-full bg-danger text-danger-foreground text-xs font-semibold px-1">
              {draggedCount}
            </span>
          )}
        </div>
      )
    },
    [t]
  )

  return (
    <FolderBrowser
      store={useBibleFolderStore}
      folders={folders}
      items={verses}
      contextMenu={contextMenu}
      renderFolderContent={renderFolderContent}
      renderItemContent={renderItemContent}
      renderDragOverlay={renderDragOverlay}
      getItemReference={getItemReference}
      isModalOpen={isModalOpen}
      onModalOpenChange={onModalOpenChange}
      i18nPrefix="bible.custom"
      untitledFolderKey="bible.custom.untitledFolder"
      emptyMessage={t('bible.folder_empty', 'Folder is empty')}
    />
  )
}
