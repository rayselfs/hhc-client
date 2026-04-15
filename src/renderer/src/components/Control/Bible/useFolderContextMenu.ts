import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import type { ContextMenuEntry } from '@renderer/contexts/ContextMenuContext'
import type { VerseItem, Folder, FolderItem } from '@shared/types/folder'
import { Copy, Scissors, Clipboard, Trash2, FolderPlus } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

type ClipboardMode = 'copy' | 'cut'

export interface ClipboardState {
  items: (FolderItem | Folder)[]
  mode: ClipboardMode
}

export interface UseFolderContextMenu {
  showItemMenu: (
    item: VerseItem,
    isAlreadySelected: boolean,
    e: React.MouseEvent,
    setSelected: (ids: Set<string>) => void,
    onCopy: () => void,
    onCut: () => void,
    onDelete: () => void
  ) => void
  showFolderMenu: (
    folder: Folder,
    isAlreadySelected: boolean,
    e: React.MouseEvent,
    setSelected: (ids: Set<string>) => void,
    clipboard: ClipboardState | null,
    onCopy: () => void,
    onCut: () => void,
    onPaste: () => void,
    onDelete: () => void
  ) => void
  showMultiSelectMenu: (
    selectedIds: Set<string>,
    e: React.MouseEvent,
    onCopy: () => void,
    onCut: () => void,
    onDelete: () => void
  ) => void
  showEmptyAreaMenu: (
    e: React.MouseEvent,
    clipboard: ClipboardState | null,
    onPaste: () => void,
    onNewFolder: () => void
  ) => void
}

export function useFolderContextMenu(): UseFolderContextMenu {
  const { t } = useTranslation()
  const { showMenu } = useContextMenu()

  const showItemMenu = (
    item: VerseItem,
    isAlreadySelected: boolean,
    e: React.MouseEvent,
    setSelected: (ids: Set<string>) => void,
    onCopy: () => void,
    onCut: () => void,
    onDelete: () => void
  ): void => {
    if (!isAlreadySelected) {
      setSelected(new Set([item.id]))
    }

    const items: ContextMenuEntry[] = [
      {
        id: 'copy',
        label: t('bible.custom.contextMenu.copy'),
        icon: React.createElement(Copy, { size: 14 }),
        onAction: onCopy
      },
      {
        id: 'cut',
        label: t('bible.custom.contextMenu.cut'),
        icon: React.createElement(Scissors, { size: 14 }),
        onAction: onCut
      },
      'separator',
      {
        id: 'delete',
        label: t('bible.custom.contextMenu.delete'),
        icon: React.createElement(Trash2, { size: 14 }),
        variant: 'danger',
        onAction: onDelete
      }
    ]

    showMenu(items, e)
  }

  const showFolderMenu = (
    folder: Folder,
    isAlreadySelected: boolean,
    e: React.MouseEvent,
    setSelected: (ids: Set<string>) => void,
    clipboard: ClipboardState | null,
    onCopy: () => void,
    onCut: () => void,
    onPaste: () => void,
    onDelete: () => void
  ): void => {
    if (!isAlreadySelected) {
      setSelected(new Set([folder.id]))
    }

    const pasteItems: ContextMenuEntry[] = clipboard
      ? [
          {
            id: 'paste',
            label: t('bible.custom.contextMenu.paste'),
            icon: React.createElement(Clipboard, { size: 14 }),
            onAction: onPaste
          }
        ]
      : []

    const items: ContextMenuEntry[] = [
      {
        id: 'copy',
        label: t('bible.custom.contextMenu.copy'),
        icon: React.createElement(Copy, { size: 14 }),
        onAction: onCopy
      },
      {
        id: 'cut',
        label: t('bible.custom.contextMenu.cut'),
        icon: React.createElement(Scissors, { size: 14 }),
        onAction: onCut
      },
      ...pasteItems,
      'separator',
      {
        id: 'delete',
        label: t('bible.custom.contextMenu.delete'),
        icon: React.createElement(Trash2, { size: 14 }),
        variant: 'danger',
        onAction: onDelete
      }
    ]

    showMenu(items, e)
  }

  const showMultiSelectMenu = (
    selectedIds: Set<string>,
    e: React.MouseEvent,
    onCopy: () => void,
    onCut: () => void,
    onDelete: () => void
  ): void => {
    const count = selectedIds.size

    const items: ContextMenuEntry[] = [
      {
        id: 'copy',
        label: t('bible.custom.contextMenu.copyCount', { count }),
        icon: React.createElement(Copy, { size: 14 }),
        onAction: onCopy
      },
      {
        id: 'cut',
        label: t('bible.custom.contextMenu.cutCount', { count }),
        icon: React.createElement(Scissors, { size: 14 }),
        onAction: onCut
      },
      'separator',
      {
        id: 'delete',
        label: t('bible.custom.contextMenu.deleteCount', { count }),
        icon: React.createElement(Trash2, { size: 14 }),
        variant: 'danger',
        onAction: onDelete
      }
    ]

    showMenu(items, e)
  }

  const showEmptyAreaMenu = (
    e: React.MouseEvent,
    clipboard: ClipboardState | null,
    onPaste: () => void,
    onNewFolder: () => void
  ): void => {
    const pasteItems: ContextMenuEntry[] = clipboard
      ? [
          {
            id: 'paste',
            label: t('bible.custom.contextMenu.paste'),
            icon: React.createElement(Clipboard, { size: 14 }),
            onAction: onPaste
          },
          'separator'
        ]
      : []

    const items: ContextMenuEntry[] = [
      ...pasteItems,
      {
        id: 'new-folder',
        label: t('bible.custom.contextMenu.newFolder'),
        icon: React.createElement(FolderPlus, { size: 14 }),
        onAction: onNewFolder
      }
    ]

    showMenu(items, e)
  }

  return { showItemMenu, showFolderMenu, showMultiSelectMenu, showEmptyAreaMenu }
}
