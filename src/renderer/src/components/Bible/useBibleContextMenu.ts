import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import type { ContextMenuEntry } from '@renderer/contexts/ContextMenuContext'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useBibleHistoryStore } from '@renderer/stores/bible-history'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { useBibleStore } from '@renderer/stores/bible'
import { BIBLE_BOOKS } from '@shared/types/bible'
import { formatVerseReference } from '@renderer/lib/bible-utils'
import type { VerseItem } from '@shared/types/folder'
import { Monitor, Clock, FolderPlus, Copy, Trash2 } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'

export interface VerseMenuData {
  bookNumber: number
  chapter: number
  verse: number
  text: string
  bookName: string
}

export interface UseBibleContextMenu {
  showPreviewMenu: (verse: VerseMenuData, e: React.MouseEvent) => void
  showHistoryMenu: (item: VerseItem, e: React.MouseEvent) => void
  showFolderItemMenu: (item: VerseItem, folderId: string, e: React.MouseEvent) => void
}

function buildVerseItem(verse: VerseMenuData): VerseItem {
  const { bookNumber, chapter, verse: verseNum, text, bookName } = verse
  const bookConfig = BIBLE_BOOKS.find((b) => b.number === bookNumber)
  const bookCode = bookConfig?.code ?? ''

  const { selectedVersionId } = useBibleSettingsStore.getState()
  const { versions } = useBibleStore.getState()
  const versionMeta = versions.find((v) => v.id === selectedVersionId)

  return {
    id: `${selectedVersionId}-${bookNumber}-${chapter}-${verseNum}`,
    type: 'verse',
    folderId: '',
    bookCode,
    bookName,
    bookNumber,
    chapter,
    verseStart: verseNum,
    verseEnd: verseNum,
    text,
    versionCode: versionMeta?.code ?? '',
    versionName: versionMeta?.name ?? '',
    createdAt: Date.now()
  }
}

function getVerseProjectionData(
  item: VerseItem,
  fontSize: number,
  t: TFunction
): { reference: string; text: string; fontSize: number } {
  const reference = formatVerseReference(t, item.bookNumber, item.chapter, item.verseStart)
  return { reference, text: item.text, fontSize }
}

export function useBibleContextMenu(): UseBibleContextMenu {
  const { t } = useTranslation()
  const { showMenu } = useContextMenu()
  const { claimProjection, project } = useProjection()

  const showPreviewMenu = (verse: VerseMenuData, e: React.MouseEvent): void => {
    const reference = formatVerseReference(t, verse.bookNumber, verse.chapter, verse.verse)
    const formattedText = `${reference} ${verse.text}`
    const { fontSize } = useBibleSettingsStore.getState()

    const items: ContextMenuEntry[] = [
      {
        id: 'project',
        label: '投影',
        icon: React.createElement(Monitor, { size: 14 }),
        onAction: () => {
          claimProjection('bible', { unblank: true })
          project('bible:verse', { reference, text: verse.text, fontSize })
        }
      },
      {
        id: 'add-history',
        label: '加入歷史',
        icon: React.createElement(Clock, { size: 14 }),
        onAction: () => {
          const item = buildVerseItem(verse)
          useBibleHistoryStore.getState().addToHistory(item)
        }
      },
      {
        id: 'add-folder',
        label: '加入資料夾',
        icon: React.createElement(FolderPlus, { size: 14 }),
        onAction: () => {
          const item = buildVerseItem(verse)
          useBibleFolderStore.getState().addItem(item)
        }
      },
      {
        id: 'copy',
        label: '複製經文',
        icon: React.createElement(Copy, { size: 14 }),
        onAction: () => {
          navigator.clipboard.writeText(formattedText)
        }
      }
    ]

    showMenu(items, e)
  }

  const showHistoryMenu = (item: VerseItem, e: React.MouseEvent): void => {
    const { fontSize } = useBibleSettingsStore.getState()
    const projData = getVerseProjectionData(item, fontSize, t)
    const formattedText = `${projData.reference} ${item.text}`

    const items: ContextMenuEntry[] = [
      {
        id: 'project',
        label: '投影',
        icon: React.createElement(Monitor, { size: 14 }),
        onAction: () => {
          claimProjection('bible', { unblank: true })
          project('bible:verse', projData)
        }
      },
      {
        id: 'copy',
        label: '複製經文',
        icon: React.createElement(Copy, { size: 14 }),
        onAction: () => {
          navigator.clipboard.writeText(formattedText)
        }
      },
      'separator',
      {
        id: 'remove-history',
        label: '從歷史移除',
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
    const { fontSize } = useBibleSettingsStore.getState()
    const projData = getVerseProjectionData(item, fontSize, t)
    const formattedText = `${projData.reference} ${item.text}`

    const items: ContextMenuEntry[] = [
      {
        id: 'project',
        label: '投影',
        icon: React.createElement(Monitor, { size: 14 }),
        onAction: () => {
          claimProjection('bible', { unblank: true })
          project('bible:verse', projData)
        }
      },
      {
        id: 'copy',
        label: '複製經文',
        icon: React.createElement(Copy, { size: 14 }),
        onAction: () => {
          navigator.clipboard.writeText(formattedText)
        }
      },
      'separator',
      {
        id: 'remove-folder',
        label: '從資料夾移除',
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
