import React, { useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Star, StarOff } from 'lucide-react'
import { GridView, ListView, type GridViewItem } from '@renderer/components/Control/FileExplorer/views'
import {
  useFileExplorerStore,
  useFileExplorerSearch,
  useFavoritesExplorerSettings
} from '@renderer/stores/file-explorer'
import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import type { SortField } from '@renderer/stores/file-explorer'

function compareByField(a: GridViewItem, b: GridViewItem, field: SortField, dir: 'asc' | 'desc'): number {
  const sign = dir === 'asc' ? 1 : -1
  switch (field) {
    case 'name':
      return sign * a.name.localeCompare(b.name)
    case 'createdAt':
      return sign * ((a.createdAt ?? 0) - (b.createdAt ?? 0))
    case 'size':
      return sign * ((a.size ?? 0) - (b.size ?? 0))
    case 'kind':
      return sign * a.name.localeCompare(b.name)
  }
}

export default function FavoritesPage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const foldersArray = useFileExplorerStore((state) => state._foldersArray)
  const navigateToFolder = useFileExplorerStore((state) => state.navigateToFolder)
  const toggleFavorite = useFileExplorerStore((state) => state.toggleFavorite)
  const setSearchQuery = useFileExplorerSearch((state) => state.setSearchQuery)
  const viewMode = useFavoritesExplorerSettings((state) => state.viewMode)
  const sortField = useFavoritesExplorerSettings((state) => state.sortField)
  const sortDir = useFavoritesExplorerSettings((state) => state.sortDir)
  const setSortDir = useFavoritesExplorerSettings((state) => state.setSortDir)
  const setSortFieldAndDir = useFavoritesExplorerSettings((state) => state.setSortFieldAndDir)
  const colWidths = useFavoritesExplorerSettings((state) => state.colWidths)
  const setColWidths = useFavoritesExplorerSettings((state) => state.setColWidths)
  const { showMenu } = useContextMenu()

  useEffect(() => {
    void useFileExplorerStore.getState().initialize()
  }, [])

  const items: GridViewItem[] = useMemo(() => {
    const favoritedFolders = foldersArray.filter((f) => f.isFavorited)
    const gridItems: GridViewItem[] = favoritedFolders.map((f) => ({
      id: f.id,
      name: f.name,
      isFolder: true,
      createdAt: f.createdAt,
      isSelected: false,
      isFavorited: true
    }))
    if (sortDir !== 'none') {
      gridItems.sort((a, b) => compareByField(a, b, sortField, sortDir))
    } else {
      gridItems.sort((a, b) => a.name.localeCompare(b.name))
    }
    return gridItems
  }, [foldersArray, sortField, sortDir])

  const handleDoubleClick = useCallback(
    async (folderId: string): Promise<void> => {
      setSearchQuery('')
      await navigateToFolder(folderId)
      navigate('/files')
    },
    [navigateToFolder, navigate, setSearchQuery]
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

  const handleSortChange = useCallback(
    (field: SortField): void => {
      if (sortDir === 'none' || field !== sortField) {
        setSortFieldAndDir(field, 'asc')
      } else if (sortDir === 'asc') {
        setSortDir('desc')
      } else {
        setSortDir('asc')
      }
    },
    [sortField, sortDir, setSortDir, setSortFieldAndDir]
  )

  const handleItemDoubleClick = useCallback(
    (id: string, e: React.MouseEvent): void => {
      e.stopPropagation()
      void handleDoubleClick(id)
    },
    [handleDoubleClick]
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
      {viewMode === 'list' ? (
        <ListView
          items={items}
          sortField={sortField}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          colWidths={colWidths}
          onColWidthChange={(col, w) => setColWidths({ [col]: w })}
          onItemClick={() => {}}
          onItemDoubleClick={handleItemDoubleClick}
          onItemContextMenu={handleContextMenu}
        />
      ) : (
        <GridView
          items={items}
          viewMode={viewMode}
          onItemClick={() => {}}
          onItemDoubleClick={handleItemDoubleClick}
          onItemContextMenu={handleContextMenu}
          onItemFavoriteToggle={toggleFavorite}
        />
      )}
    </div>
  )
}
