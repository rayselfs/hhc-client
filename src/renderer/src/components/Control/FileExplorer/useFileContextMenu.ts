import React from 'react'
import { toast } from '@heroui/react/toast'
import { Play, Star, StarOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { createFolderContextMenu } from '@renderer/lib/createFolderContextMenu'
import type { UseFolderContextMenu } from '@renderer/lib/createFolderContextMenu'
import type { ContextMenuEntry } from '@renderer/contexts/ContextMenuContext'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { getPresentableItems, isPresentable } from '@renderer/lib/presentability'
import { presentPreviewItem, startMediaProjection } from '@renderer/lib/projection-actions'
import { isFileItem, type FolderItem, type FolderRecord } from '@shared/types/folder'

export type {
  ClipboardState,
  UseFolderContextMenu,
  ShowItemMenuOptions,
  ShowFolderMenuOptions,
  ShowMultiSelectMenuOptions,
  ShowEmptyAreaMenuOptions
} from '@renderer/lib/createFolderContextMenu'

const useBaseFileContextMenu = createFolderContextMenu({ i18nPrefix: 'fileExplorer.contextMenu' })

function project(
  items: Parameters<typeof getPresentableItems>[0],
  startIndex: number,
  t: (key: string) => string,
  navigate: (path: string) => void,
  prioritizeStartItem: boolean
): void {
  const presentableFiles = getPresentableItems(items)
  if (presentableFiles.length === 0) return

  if (prioritizeStartItem) {
    const item = presentableFiles[Math.max(startIndex, 0)]
    if (!item) return
    void presentPreviewItem({
      item,
      playlist: presentableFiles,
      start: (files, index, _, options) =>
        startMediaProjection(
          files,
          index,
          { onNoProjectableFiles: () => toast.warning(t('fileExplorer.noProjectableFiles')) },
          options
        ),
      navigate
    }).catch(() => undefined)
    return
  }

  void startMediaProjection(presentableFiles, Math.max(startIndex, 0), {
    onNoProjectableFiles: () => toast.warning(t('fileExplorer.noProjectableFiles'))
  })
    .then((report) => {
      if (report.summary.ready > 0) navigate('/media')
    })
    .catch(() => undefined)
}

function getItemProjectActions(
  item: FolderItem,
  t: (key: string) => string,
  navigate: (path: string) => void
): ContextMenuEntry[] {
  if (!isFileItem(item) || !isPresentable(item.mimeType)) return []

  return [
    'separator',
    {
      id: 'project',
      label: t('fileExplorer.contextMenu.project'),
      icon: React.createElement(Play, { size: 14 }),
      onAction: () => {
        const { currentFolderId, getItems } = useFileExplorerStore.getState()
        const items = getItems(currentFolderId)
        project(
          items,
          getPresentableItems(items).findIndex((entry) => entry.id === item.id),
          t,
          navigate,
          true
        )
      }
    }
  ]
}

function getFolderProjectActions(
  folder: FolderRecord,
  t: (key: string) => string,
  navigate: (path: string) => void
): ContextMenuEntry[] {
  const { toggleFavorite, getItems } = useFileExplorerStore.getState()
  const items = getItems(folder.id)
  const presentableFiles = getPresentableItems(items)
  const isFavorited = folder.isFavorited ?? false
  const actions: ContextMenuEntry[] = []

  if (presentableFiles.length > 0) {
    actions.push('separator', {
      id: 'project',
      label: t('fileExplorer.contextMenu.project'),
      icon: React.createElement(Play, { size: 14 }),
      onAction: () => project(items, 0, t, navigate, false)
    })
  }

  actions.push(...(actions.length === 0 ? ['separator' as const] : []), {
    id: isFavorited ? 'remove-favorite' : 'add-favorite',
    label: t(
      isFavorited
        ? 'fileExplorer.contextMenu.removeFavorite'
        : 'fileExplorer.contextMenu.addFavorite'
    ),
    icon: React.createElement(isFavorited ? StarOff : Star, { size: 14 }),
    onAction: () => toggleFavorite(folder.id)
  })

  return actions
}

export function useFileContextMenu(): UseFolderContextMenu {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const menu = useBaseFileContextMenu()
  const translate = (key: string): string => t(key as never) as string

  return {
    ...menu,
    showItemMenu: (options: Parameters<typeof menu.showItemMenu>[0]) => {
      menu.showItemMenu({
        ...options,
        extraActions: [
          ...getItemProjectActions(options.item, translate, navigate),
          ...(options.extraActions ?? [])
        ]
      })
    },
    showFolderMenu: (options: Parameters<typeof menu.showFolderMenu>[0]) => {
      menu.showFolderMenu({
        ...options,
        extraActions: [
          ...getFolderProjectActions(options.folder, translate, navigate),
          ...(options.extraActions ?? [])
        ]
      })
    }
  }
}
