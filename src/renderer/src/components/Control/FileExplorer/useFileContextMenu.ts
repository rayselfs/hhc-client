import React from 'react'
import { Star, StarOff } from 'lucide-react'
import { createFolderContextMenu } from '@renderer/lib/createFolderContextMenu'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'

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
  extraFolderActions: (folder, t) => {
    const { toggleFavorite } = useFileExplorerStore.getState()
    const isFavorited = folder.isFavorited ?? false
    return [
      'separator',
      {
        id: isFavorited ? 'remove-favorite' : 'add-favorite',
        label: t(
          isFavorited
            ? 'fileExplorer.contextMenu.removeFavorite'
            : 'fileExplorer.contextMenu.addFavorite'
        ),
        icon: React.createElement(isFavorited ? StarOff : Star, { size: 14 }),
        onAction: () => toggleFavorite(folder.id)
      }
    ]
  }
})
