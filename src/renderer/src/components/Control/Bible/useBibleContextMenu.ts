import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import type { ContextMenuEntry } from '@renderer/contexts/ContextMenuContext'
import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { formatVerseReference } from '@renderer/lib/bible-utils'
import type { VerseItem } from '@shared/types/folder'
import { Copy, Trash2 } from 'lucide-react'
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

export function buildVerseItem(verse: VerseMenuData): VerseItem {
  const { bookNumber, chapter, verse: verseNum, text } = verse
  const { selectedVersionId } = useBibleSettingsStore.getState()

  return {
    id: crypto.randomUUID(),
    type: 'verse',
    parentId: '',
    sortIndex: 0,
    versionId: selectedVersionId,
    bookNumber,
    chapter,
    verse: verseNum,
    text,
    createdAt: Date.now(),
    expiresAt: null
  }
}

function getFormattedReference(item: VerseItem, t: TFunction): string {
  return formatVerseReference(t, item.bookNumber, item.chapter, item.verse)
}

export function useBibleContextMenu(): UseBibleContextMenu {
  const { t } = useTranslation()
  const { showMenu } = useContextMenu()

  const showPreviewMenu = (verse: VerseMenuData, e: React.MouseEvent): void => {
    const reference = formatVerseReference(t, verse.bookNumber, verse.chapter, verse.verse)
    const formattedText = `${reference} ${verse.text}`

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
    const reference = getFormattedReference(item, t)
    const formattedText = `${reference} ${item.text}`

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
    const reference = getFormattedReference(item, t)
    const formattedText = `${reference} ${item.text}`

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
