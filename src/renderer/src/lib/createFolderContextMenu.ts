import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import type { ContextMenuEntry } from '@renderer/contexts/ContextMenuContext'
import type { FolderItem, Folder } from '@shared/types/folder'
import { Copy, Scissors, Clipboard, Trash2, FolderPlus } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

type ClipboardMode = 'copy' | 'cut'

export interface ClipboardState {
  items: (FolderItem | Folder)[]
  mode: ClipboardMode
}

export interface FolderContextMenuConfig<TItem extends FolderItem> {
  extraItemActions?: (item: TItem) => ContextMenuEntry[]
  extraFolderActions?: (folder: Folder<TItem>) => ContextMenuEntry[]
  extraEmptyAreaActions?: () => ContextMenuEntry[]
  canPaste?: (item: FolderItem) => boolean
}

export interface ShowItemMenuOptions<TItem extends FolderItem> {
  item: TItem
  isAlreadySelected: boolean
  event: React.MouseEvent
  setSelected: (ids: Set<string>) => void
  onCopy: () => void
  onCut: () => void
  onDelete: () => void
}

export interface ShowFolderMenuOptions<TItem extends FolderItem> {
  folder: Folder<TItem>
  isAlreadySelected: boolean
  event: React.MouseEvent
  setSelected: (ids: Set<string>) => void
  clipboard: ClipboardState | null
  onCopy: () => void
  onCut: () => void
  onPaste: () => void
  onDelete: () => void
}

export interface ShowMultiSelectMenuOptions {
  selectedIds: Set<string>
  event: React.MouseEvent
  onCopy: () => void
  onCut: () => void
  onDelete: () => void
}

export interface ShowEmptyAreaMenuOptions {
  event: React.MouseEvent
  clipboard: ClipboardState | null
  onPaste: () => void
  onNewFolder: () => void
}

export interface UseFolderContextMenu<TItem extends FolderItem> {
  showItemMenu: (options: ShowItemMenuOptions<TItem>) => void
  showFolderMenu: (options: ShowFolderMenuOptions<TItem>) => void
  showMultiSelectMenu: (options: ShowMultiSelectMenuOptions) => void
  showEmptyAreaMenu: (options: ShowEmptyAreaMenuOptions) => void
}

export function createFolderContextMenu<TItem extends FolderItem>(
  config?: FolderContextMenuConfig<TItem>
): () => UseFolderContextMenu<TItem> {
  return function useFolderContextMenu(): UseFolderContextMenu<TItem> {
    const { t } = useTranslation()
    const { showMenu } = useContextMenu()

    const showItemMenu = ({
      item,
      isAlreadySelected,
      event,
      setSelected,
      onCopy,
      onCut,
      onDelete
    }: ShowItemMenuOptions<TItem>): void => {
      if (!isAlreadySelected) {
        setSelected(new Set([item.id]))
      }

      const baseItems: ContextMenuEntry[] = [
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

      const extra = config?.extraItemActions?.(item) ?? []
      showMenu([...baseItems, ...extra], event)
    }

    const showFolderMenu = ({
      folder,
      isAlreadySelected,
      event,
      setSelected,
      clipboard,
      onCopy,
      onCut,
      onPaste,
      onDelete
    }: ShowFolderMenuOptions<TItem>): void => {
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

      const baseItems: ContextMenuEntry[] = [
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

      const extra = config?.extraFolderActions?.(folder) ?? []
      showMenu([...baseItems, ...extra], event)
    }

    const showMultiSelectMenu = ({
      selectedIds,
      event,
      onCopy,
      onCut,
      onDelete
    }: ShowMultiSelectMenuOptions): void => {
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

      showMenu(items, event)
    }

    const showEmptyAreaMenu = ({
      event,
      clipboard,
      onPaste,
      onNewFolder
    }: ShowEmptyAreaMenuOptions): void => {
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

      const baseItems: ContextMenuEntry[] = [
        ...pasteItems,
        {
          id: 'new-folder',
          label: t('bible.custom.contextMenu.newFolder'),
          icon: React.createElement(FolderPlus, { size: 14 }),
          onAction: onNewFolder
        }
      ]

      const extra = config?.extraEmptyAreaActions?.() ?? []
      showMenu([...baseItems, ...extra], event)
    }

    return { showItemMenu, showFolderMenu, showMultiSelectMenu, showEmptyAreaMenu }
  }
}
