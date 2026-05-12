import React, { useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Star, StarOff } from 'lucide-react'
import { GridView, type GridViewItem } from '@renderer/components/Control/FileExplorer/views'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useContextMenu } from '@renderer/contexts/ContextMenuContext'

export default function FavoritesPage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const foldersArray = useFileExplorerStore((state) => state._foldersArray)
  const navigateToFolder = useFileExplorerStore((state) => state.navigateToFolder)
  const toggleFavorite = useFileExplorerStore((state) => state.toggleFavorite)
  const { showMenu } = useContextMenu()

  useEffect(() => {
    void useFileExplorerStore.getState().initialize()
  }, [])

  const favoritedFolders = useMemo(
    () =>
      foldersArray
        .filter((f) => f.isFavorited)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [foldersArray]
  )

  const items: GridViewItem[] = useMemo(
    () =>
      favoritedFolders.map((f) => ({
        id: f.id,
        name: f.name,
        isFolder: true,
        createdAt: f.createdAt,
        isSelected: false,
        isFavorited: true
      })),
    [favoritedFolders]
  )

  const handleDoubleClick = useCallback(
    async (folderId: string): Promise<void> => {
      await navigateToFolder(folderId)
      navigate('/files')
    },
    [navigateToFolder, navigate]
  )

  const handleContextMenu = useCallback(
    (folderId: string, event: React.MouseEvent): void => {
      showMenu(
        [
          {
            id: 'remove-favorite',
            label: t('fileExplorer.contextMenu.removeFavorite'),
            icon: React.createElement(StarOff, { size: 14 }),
            onAction: () => toggleFavorite(folderId)
          }
        ],
        event
      )
    },
    [showMenu, t, toggleFavorite]
  )

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-center p-8">
        <Star size={48} className="text-default-300 mb-4" />
        <h3 className="text-lg font-medium text-foreground">{t('favorites.empty.title')}</h3>
        <p className="text-sm text-default-400 mt-1">{t('favorites.empty.description')}</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <GridView
        items={items}
        viewMode="medium-icon"
        onItemClick={() => {}}
        onItemDoubleClick={(id, e) => {
          e.stopPropagation()
          void handleDoubleClick(id)
        }}
        onItemContextMenu={handleContextMenu}
      />
    </div>
  )
}
