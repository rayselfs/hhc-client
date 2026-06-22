import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import type { ContextMenuEntry } from '@renderer/contexts/ContextMenuContext'
import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useServicePlaylistStore } from '@renderer/stores/service-playlist'
import { useBibleLiveQueueStore } from '@renderer/stores/bible-live-queue'
import { buildBibleServiceCueInput } from '@renderer/lib/bible-service-cue'
import { formatVerseReferenceForCopy, formatVerseReferenceShort } from '@renderer/lib/bible-utils'
import type { VerseItem } from '@shared/types/folder'
import { Copy, Trash2, FolderPlus, ListPlus, ListTodo } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

export interface VerseMenuData {
  bookNumber: number
  chapter: number
  verse: number
  text: string
}

export interface UseBibleContextMenu {
  showPreviewMenu: (verse: VerseMenuData, e: React.MouseEvent) => void
  showHistoryMenu: (item: VerseItem, e: React.MouseEvent) => void
  showFolderItemMenu: (item: VerseItem, folderId: string, e: React.MouseEvent) => void
}

export function buildVerseItem(verse: VerseMenuData): Omit<VerseItem, 'expiresAt' | 'sortIndex'> {
  const { bookNumber, chapter, verse: verseNum, text } = verse
  const { selectedVersionId } = useBibleSettingsStore.getState()

  return {
    id: crypto.randomUUID(),
    type: 'verse',
    parentId: '',
    versionId: selectedVersionId,
    bookNumber,
    chapter,
    verse: verseNum,
    text,
    createdAt: Date.now()
  }
}

function getFormattedReference(item: VerseItem, t: TFunction, locale: string): string {
  return formatVerseReferenceForCopy(
    t,
    item.bookNumber,
    item.chapter,
    item.verse,
    item.text,
    locale
  )
}

function addVerseToQueue(
  t: TFunction,
  verse: VerseMenuData,
  versionId = useBibleSettingsStore.getState().selectedVersionId
): void {
  useBibleLiveQueueStore.getState().addItem({
    versionId,
    bookNumber: verse.bookNumber,
    chapter: verse.chapter,
    verse: verse.verse,
    text: verse.text,
    reference: formatVerseReferenceShort(t, verse.bookNumber, verse.chapter, verse.verse)
  })
}

export function useBibleContextMenu(): UseBibleContextMenu {
  const { t, i18n } = useTranslation()
  const { showMenu } = useContextMenu()

  const showPreviewMenu = (verse: VerseMenuData, e: React.MouseEvent): void => {
    const formattedText = formatVerseReferenceForCopy(
      t,
      verse.bookNumber,
      verse.chapter,
      verse.verse,
      verse.text,
      i18n.language
    )

    const items: ContextMenuEntry[] = [
      {
        id: 'add-to-service',
        label: t('bible.contextMenu.addToService'),
        icon: React.createElement(ListPlus, { size: 14 }),
        onAction: () => {
          useServicePlaylistStore.getState().addCue(
            buildBibleServiceCueInput(t, {
              bookNumber: verse.bookNumber,
              chapter: verse.chapter,
              verse: verse.verse
            })
          )
        }
      },
      {
        id: 'add-to-queue',
        label: t('bible.contextMenu.addToQueue'),
        icon: React.createElement(ListTodo, { size: 14 }),
        onAction: () => addVerseToQueue(t, verse)
      },
      {
        id: 'copy',
        label: t('bible.contextMenu.copyText'),
        icon: React.createElement(Copy, { size: 14 }),
        onAction: () => {
          navigator.clipboard.writeText(formattedText)
        }
      }
    ]

    showMenu(items, e)
  }

  const showHistoryMenu = (item: VerseItem, e: React.MouseEvent): void => {
    const items: ContextMenuEntry[] = [
      {
        id: 'add-to-service',
        label: t('bible.contextMenu.addToService'),
        icon: React.createElement(ListPlus, { size: 14 }),
        onAction: () => {
          useServicePlaylistStore.getState().addCue(
            buildBibleServiceCueInput(t, {
              bookNumber: item.bookNumber,
              chapter: item.chapter,
              verse: item.verse
            })
          )
        }
      },
      {
        id: 'add-to-queue',
        label: t('bible.contextMenu.addToQueue'),
        icon: React.createElement(ListTodo, { size: 14 }),
        onAction: () =>
          addVerseToQueue(
            t,
            {
              bookNumber: item.bookNumber,
              chapter: item.chapter,
              verse: item.verse,
              text: item.text
            },
            item.versionId
          )
      },
      {
        id: 'add-to-folder',
        label: t('bible.contextMenu.addToFolder'),
        icon: React.createElement(FolderPlus, { size: 14 }),
        onAction: () => {
          const newItem = buildVerseItem({
            bookNumber: item.bookNumber,
            chapter: item.chapter,
            verse: item.verse,
            text: item.text
          })
          useBibleFolderStore.getState().addItem(newItem)
        }
      },
      'separator',
      {
        id: 'remove-history',
        label: t('bible.contextMenu.removeFromHistory'),
        icon: React.createElement(Trash2, { size: 14 }),
        variant: 'danger',
        onAction: () => {
          useBibleHistoryStore.getState().removeFromHistory(item.id)
        }
      }
    ]

    showMenu(items, e)
  }

  const showFolderItemMenu = (item: VerseItem, _folderId: string, e: React.MouseEvent): void => {
    const formattedText = getFormattedReference(item, t, i18n.language)

    const items: ContextMenuEntry[] = [
      {
        id: 'add-to-service',
        label: t('bible.contextMenu.addToService'),
        icon: React.createElement(ListPlus, { size: 14 }),
        onAction: () => {
          useServicePlaylistStore.getState().addCue(
            buildBibleServiceCueInput(t, {
              bookNumber: item.bookNumber,
              chapter: item.chapter,
              verse: item.verse
            })
          )
        }
      },
      {
        id: 'add-to-queue',
        label: t('bible.contextMenu.addToQueue'),
        icon: React.createElement(ListTodo, { size: 14 }),
        onAction: () =>
          addVerseToQueue(
            t,
            {
              bookNumber: item.bookNumber,
              chapter: item.chapter,
              verse: item.verse,
              text: item.text
            },
            item.versionId
          )
      },
      {
        id: 'copy',
        label: t('bible.contextMenu.copyText'),
        icon: React.createElement(Copy, { size: 14 }),
        onAction: () => {
          navigator.clipboard.writeText(formattedText)
        }
      },
      'separator',
      {
        id: 'remove-folder',
        label: t('bible.contextMenu.removeFromFolder'),
        icon: React.createElement(Trash2, { size: 14 }),
        variant: 'danger',
        onAction: () => {
          useBibleFolderStore.getState().removeItem(item.id)
        }
      }
    ]

    showMenu(items, e)
  }

  return { showPreviewMenu, showHistoryMenu, showFolderItemMenu }
}
