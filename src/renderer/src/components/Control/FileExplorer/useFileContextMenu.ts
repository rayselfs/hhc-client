import React from 'react'
import { Play, Star, StarOff } from 'lucide-react'
import { createFolderContextMenu } from '@renderer/lib/createFolderContextMenu'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { isPresentable, getPresentableItems } from '@renderer/lib/presentability'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { isFileItem } from '@shared/types/folder'

export type {
  ClipboardState,
  UseFolderContextMenu,
  ShowItemMenuOptions,
  ShowFolderMenuOptions,
  ShowMultiSelectMenuOptions,
  ShowEmptyAreaMenuOptions
} from '@renderer/lib/createFolderContextMenu'

export const useFileContextMenu = createFolderContextMenu({
  i18nPrefix: 'fileExplorer.contextMenu',
  extraItemActions: (itemId, t) => {
    const state = useFileExplorerStore.getState()
    const item = state.items[itemId]
    if (!item || !isFileItem(item) || !isPresentable(item.mimeType)) return []

    return [
      'separator',
      {
        id: 'project',
        label: t('fileExplorer.contextMenu.project'),
        icon: React.createElement(Play, { size: 14 }),
        onAction: () => {
          const { currentFolderId, getItems } = useFileExplorerStore.getState()
          const allItems = getItems(currentFolderId)
          const presentableFiles = getPresentableItems(allItems)
          const targetIndex = presentableFiles.findIndex((f) => f.id === itemId)
          if (presentableFiles.length > 0) {
            useMediaProjectionStore
              .getState()
              .startPresentation(presentableFiles, Math.max(targetIndex, 0))
          }
        }
      }
    ]
  },
  extraFolderActions: (folder, t) => {
    const { toggleFavorite, getItems } = useFileExplorerStore.getState()
    const isFavorited = folder.isFavorited ?? false
    const folderItems = getItems(folder.id)
    const presentableFiles = getPresentableItems(folderItems)
    const actions: Array<
      'separator' | { id: string; label: string; icon: React.ReactElement; onAction: () => void }
    > = []

    if (presentableFiles.length > 0) {
      actions.push('separator', {
        id: 'project',
        label: t('fileExplorer.contextMenu.project'),
        icon: React.createElement(Play, { size: 14 }),
        onAction: () => {
          useMediaProjectionStore.getState().startPresentation(presentableFiles, 0)
        }
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
})
