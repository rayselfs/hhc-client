import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import type { ContextMenuEntry } from '@renderer/contexts/ContextMenuContext'
import type { FolderRecord, FolderItem } from '@shared/types/folder'
import {
  Copy,
  Scissors,
  Clipboard,
  Trash2,
  FolderPlus,
  Pencil,
  Settings2,
  Upload,
  Folder
} from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

type ClipboardMode = 'copy' | 'cut'

export interface ClipboardState {
  itemIds: Set<string>
  mode: ClipboardMode
}

export interface FolderContextMenuConfig {
  i18nPrefix?: string
  extraItemActions?: (itemId: string, t: (key: string) => string) => ContextMenuEntry[]
  extraFolderActions?: (folder: FolderRecord, t: (key: string) => string) => ContextMenuEntry[]
  extraEmptyAreaActions?: () => ContextMenuEntry[]
}

export interface ShowItemMenuOptions {
  item: FolderItem
  isAlreadySelected: boolean
  event: React.MouseEvent
  setSelected: (ids: Set<string>) => void
  onCopy: (targetIds: Set<string>) => void
  onCut: (targetIds: Set<string>) => void
  onDelete: (targetIds: Set<string>) => void
  onEdit?: (item: FolderItem) => void
  onEditDetails?: (item: FolderItem) => void
}

export interface ShowFolderMenuOptions {
  folder: FolderRecord
  isAlreadySelected: boolean
  event: React.MouseEvent
  setSelected: (ids: Set<string>) => void
  clipboard: ClipboardState | null
  onCopy: (targetIds: Set<string>) => void
  onCut: (targetIds: Set<string>) => void
  onPaste: () => void
  onDelete: (targetIds: Set<string>) => void
  onEdit?: (folder: FolderRecord) => void
}

export interface ShowMultiSelectMenuOptions {
  selectedIds: Set<string>
  event: React.MouseEvent
  onCopy: (targetIds: Set<string>) => void
  onCut: (targetIds: Set<string>) => void
  onDelete: (targetIds: Set<string>) => void
}

export interface ShowEmptyAreaMenuOptions {
  event: React.MouseEvent
  clipboard: ClipboardState | null
  onPaste: () => void
  onNewFolder: () => void
  onUploadFiles?: () => void
  onUploadFolder?: () => void
}

export interface UseFolderContextMenu {
  showItemMenu: (options: ShowItemMenuOptions) => void
  showFolderMenu: (options: ShowFolderMenuOptions) => void
  showMultiSelectMenu: (options: ShowMultiSelectMenuOptions) => void
  showEmptyAreaMenu: (options: ShowEmptyAreaMenuOptions) => void
}

const DEFAULT_I18N_PREFIX = 'folder.contextMenu'

export function createFolderContextMenu(
  config?: FolderContextMenuConfig
): () => UseFolderContextMenu {
  return function useFolderContextMenu(): UseFolderContextMenu {
    const { t } = useTranslation()
    const { showMenu } = useContextMenu()
    const p = config?.i18nPrefix ?? DEFAULT_I18N_PREFIX

    const tKey = (key: string): string => (t as (k: string) => string)(`${p}.${key}`)

    const showItemMenu = ({
      item,
      isAlreadySelected,
      event,
      setSelected,
      onCopy,
      onCut,
      onDelete,
      onEdit,
      onEditDetails
    }: ShowItemMenuOptions): void => {
      if (!isAlreadySelected) {
        setSelected(new Set([item.id]))
      }

      const targetIds = new Set([item.id])
      const editItems: ContextMenuEntry[] = []
      if (onEdit) {
        editItems.push({
          id: 'rename',
          label: tKey('rename'),
          icon: React.createElement(Pencil, { size: 14 }),
          onAction: () => onEdit(item)
        })
      }
      if (onEditDetails) {
        editItems.push({
          id: 'edit-details',
          label: tKey('editDetails'),
          icon: React.createElement(Settings2, { size: 14 }),
          onAction: () => onEditDetails(item)
        })
      }
      if (editItems.length > 0) {
        editItems.push('separator')
      }
      const baseItems: ContextMenuEntry[] = [
        ...editItems,
        {
          id: 'copy',
          label: tKey('copy'),
          icon: React.createElement(Copy, { size: 14 }),
          onAction: () => onCopy(targetIds)
        },
        {
          id: 'cut',
          label: tKey('cut'),
          icon: React.createElement(Scissors, { size: 14 }),
          onAction: () => onCut(targetIds)
        },
        'separator',
        {
          id: 'delete',
          label: tKey('delete'),
          icon: React.createElement(Trash2, { size: 14 }),
          variant: 'danger',
          onAction: () => onDelete(targetIds)
        }
      ]

      const extra = config?.extraItemActions?.(item.id, t as (key: string) => string) ?? []
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
      onDelete,
      onEdit
    }: ShowFolderMenuOptions): void => {
      if (!isAlreadySelected) {
        setSelected(new Set([folder.id]))
      }

      const targetIds = new Set([folder.id])
      const pasteItems: ContextMenuEntry[] = clipboard
        ? [
            {
              id: 'paste',
              label: tKey('paste'),
              icon: React.createElement(Clipboard, { size: 14 }),
              onAction: onPaste
            }
          ]
        : []

      const editItems: ContextMenuEntry[] = onEdit
        ? [
            {
              id: 'edit',
              label: tKey('edit'),
              icon: React.createElement(Pencil, { size: 14 }),
              onAction: () => onEdit(folder)
            },
            'separator'
          ]
        : []

      const baseItems: ContextMenuEntry[] = [
        ...editItems,
        {
          id: 'copy',
          label: tKey('copy'),
          icon: React.createElement(Copy, { size: 14 }),
          onAction: () => onCopy(targetIds)
        },
        {
          id: 'cut',
          label: tKey('cut'),
          icon: React.createElement(Scissors, { size: 14 }),
          onAction: () => onCut(targetIds)
        },
        ...pasteItems,
        'separator',
        {
          id: 'delete',
          label: tKey('delete'),
          icon: React.createElement(Trash2, { size: 14 }),
          variant: 'danger',
          onAction: () => onDelete(targetIds)
        }
      ]

      const extra = config?.extraFolderActions?.(folder, t as (key: string) => string) ?? []
      showMenu([...baseItems, ...extra], event)
    }

    const showMultiSelectMenu = ({
      selectedIds,
      event,
      onCopy,
      onCut,
      onDelete
    }: ShowMultiSelectMenuOptions): void => {
      const items: ContextMenuEntry[] = [
        {
          id: 'copy',
          label: tKey('copy'),
          icon: React.createElement(Copy, { size: 14 }),
          onAction: () => onCopy(selectedIds)
        },
        {
          id: 'cut',
          label: tKey('cut'),
          icon: React.createElement(Scissors, { size: 14 }),
          onAction: () => onCut(selectedIds)
        },
        'separator',
        {
          id: 'delete',
          label: tKey('delete'),
          icon: React.createElement(Trash2, { size: 14 }),
          variant: 'danger',
          onAction: () => onDelete(selectedIds)
        }
      ]

      showMenu(items, event)
    }

    const showEmptyAreaMenu = ({
      event,
      clipboard,
      onPaste,
      onNewFolder,
      onUploadFiles,
      onUploadFolder
    }: ShowEmptyAreaMenuOptions): void => {
      const pasteItems: ContextMenuEntry[] = clipboard
        ? [
            {
              id: 'paste',
              label: tKey('paste'),
              icon: React.createElement(Clipboard, { size: 14 }),
              onAction: onPaste
            },
            'separator'
          ]
        : []

      const uploadItems: ContextMenuEntry[] =
        onUploadFiles || onUploadFolder
          ? [
              'separator',
              ...(onUploadFiles
                ? [
                    {
                      id: 'upload-files',
                      label: tKey('uploadFiles'),
                      icon: React.createElement(Upload, { size: 14 }),
                      onAction: onUploadFiles
                    } as ContextMenuEntry
                  ]
                : []),
              ...(onUploadFolder
                ? [
                    {
                      id: 'upload-folder',
                      label: tKey('uploadFolder'),
                      icon: React.createElement(Folder, { size: 14 }),
                      onAction: onUploadFolder
                    } as ContextMenuEntry
                  ]
                : [])
            ]
          : []

      const baseItems: ContextMenuEntry[] = [
        ...pasteItems,
        {
          id: 'new-folder',
          label: tKey('newFolder'),
          icon: React.createElement(FolderPlus, { size: 14 }),
          onAction: onNewFolder
        },
        ...uploadItems
      ]

      const extra = config?.extraEmptyAreaActions?.() ?? []
      showMenu([...baseItems, ...extra], event)
    }

    return { showItemMenu, showFolderMenu, showMultiSelectMenu, showEmptyAreaMenu }
  }
}
