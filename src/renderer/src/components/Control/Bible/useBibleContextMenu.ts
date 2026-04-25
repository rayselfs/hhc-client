import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import type { ContextMenuEntry } from '@renderer/contexts/ContextMenuContext'
import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { formatVerseReferenceForCopy } from '@renderer/lib/bible-utils'
import type { VerseItem } from '@shared/types/folder'
import { Copy, Trash2, FolderPlus } from 'lucide-react'
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

  // TODO: used by future HistoryTab context menu
  const showHistoryMenu = (item: VerseItem, e: React.MouseEvent): void => {
    const formattedText = getFormattedReference(item, t, i18n.language)

    const items: ContextMenuEntry[] = [
      {
        id: 'copy',
        label: t('bible.contextMenu.copyText'),
        icon: React.createElement(Copy, { size: 14 }),
        onAction: () => {
          navigator.clipboard.writeText(formattedText)
        }
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
