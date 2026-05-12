import React, { useCallback, useEffect, useState } from 'react'
import {
  FileExplorerShell,
  FileUpload,
  SearchBar,
  useFileContextMenu
} from '@renderer/components/Control/FileExplorer'
import FileBrowser from '@renderer/components/Control/FileExplorer/FileBrowser'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import type { ClipboardState } from '@renderer/components/Control/FileExplorer'

export default function FilesPage(): React.JSX.Element {
  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const getItems = useFileExplorerStore((state) => state.getItems)
  const getChildFolders = useFileExplorerStore((state) => state.getChildFolders)
  const addFolder = useFileExplorerStore((state) => state.addFolder)
  const removeItem = useFileExplorerStore((state) => state.removeItem)
  const deleteFolder = useFileExplorerStore((state) => state.deleteFolder)
  const moveItem = useFileExplorerStore((state) => state.moveItem)
  const moveFolder = useFileExplorerStore((state) => state.moveFolder)
  const addItem = useFileExplorerStore((state) => state.addItem)
  const { showItemMenu, showFolderMenu, showMultiSelectMenu, showEmptyAreaMenu } =
    useFileContextMenu()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)

  const itemCount = getItems(currentFolderId).length
  const selectedCount = selectedIds.size

  useEffect(() => {
    void useFileExplorerStore.getState().initialize()
  }, [])

  const handleSelectionChange = useCallback((nextSelectedIds: Set<string>): void => {
    setSelectedIds(nextSelectedIds)
  }, [])

  const handleCopy = useCallback((targetIds: Set<string>): void => {
    if (targetIds.size === 0) return
    setClipboard({ itemIds: new Set(targetIds), mode: 'copy' })
  }, [])

  const handleCut = useCallback((targetIds: Set<string>): void => {
    if (targetIds.size === 0) return
    setClipboard({ itemIds: new Set(targetIds), mode: 'cut' })
  }, [])

  const handleDelete = useCallback(
    (targetIds: Set<string>): void => {
      for (const id of targetIds) {
        const state = useFileExplorerStore.getState()
        if (state.folders[id]) {
          deleteFolder(id)
        } else {
          removeItem(id)
        }
      }
      setSelectedIds(new Set())
    },
    [deleteFolder, removeItem]
  )

  const handlePaste = useCallback((): void => {
    if (!clipboard) return
    const state = useFileExplorerStore.getState()

    for (const id of clipboard.itemIds) {
      if (state.folders[id]) {
        if (clipboard.mode === 'copy') {
          addFolder(state.folders[id].name, currentFolderId, state.folders[id].expiresAt)
        } else {
          moveFolder(id, currentFolderId)
        }
      } else if (state.items[id]) {
        if (clipboard.mode === 'copy') {
          const { id: _id, sortIndex: _sortIndex, createdAt: _createdAt, ...itemData } = state.items[id]
          addItem({ ...itemData, parentId: currentFolderId })
        } else {
          moveItem(id, currentFolderId)
        }
      }
    }

    if (clipboard.mode === 'cut') setClipboard(null)
    setSelectedIds(new Set())
  }, [clipboard, currentFolderId, addFolder, addItem, moveFolder, moveItem])

  const handleItemContextMenu = useCallback(
    (itemId: string, event: React.MouseEvent): void => {
      const state = useFileExplorerStore.getState()
      const item = state.items[itemId]
      if (!item) return

      const isAlreadySelected = selectedIds.has(itemId)
      if (selectedIds.size > 1 && isAlreadySelected) {
        showMultiSelectMenu({
          selectedIds,
          event,
          onCopy: handleCopy,
          onCut: handleCut,
          onDelete: handleDelete
        })
        return
      }

      showItemMenu({
        item,
        isAlreadySelected,
        event,
        setSelected: setSelectedIds,
        onCopy: handleCopy,
        onCut: handleCut,
        onDelete: handleDelete
      })
    },
    [selectedIds, showMultiSelectMenu, showItemMenu, handleCopy, handleCut, handleDelete]
  )

  const handleFolderContextMenu = useCallback(
    (folderId: string, event: React.MouseEvent): void => {
      const folder = useFileExplorerStore.getState().folders[folderId]
      if (!folder) return

      const isAlreadySelected = selectedIds.has(folderId)
      if (selectedIds.size > 1 && isAlreadySelected) {
        showMultiSelectMenu({
          selectedIds,
          event,
          onCopy: handleCopy,
          onCut: handleCut,
          onDelete: handleDelete
        })
        return
      }

      showFolderMenu({
        folder,
        isAlreadySelected,
        event,
        setSelected: setSelectedIds,
        clipboard,
        onCopy: handleCopy,
        onCut: handleCut,
        onPaste: handlePaste,
        onDelete: handleDelete
      })
    },
    [
      selectedIds,
      clipboard,
      showMultiSelectMenu,
      showFolderMenu,
      handleCopy,
      handleCut,
      handlePaste,
      handleDelete
    ]
  )

  const handleEmptyAreaContextMenu = useCallback(
    (event: React.MouseEvent): void => {
      showEmptyAreaMenu({
        event,
        clipboard,
        onPaste: handlePaste,
        onNewFolder: () => {
          const existingNames = getChildFolders(currentFolderId).map((folder) => folder.name)
          const baseName = 'New Folder'
          let name = baseName
          let suffix = 2
          while (existingNames.includes(name)) {
            name = `${baseName} ${suffix}`
            suffix += 1
          }
          addFolder(name, currentFolderId)
        }
      })
    },
    [clipboard, currentFolderId, getChildFolders, addFolder, showEmptyAreaMenu, handlePaste]
  )

  return (
    <FileExplorerShell
      itemCount={itemCount}
      selectedCount={selectedCount}
      headerRight={<FileUpload currentFolderId={currentFolderId} />}
    >
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-border px-3 py-2">
          <SearchBar className="max-w-md" />
        </div>
        <div className="min-h-0 flex-1">
          <FileBrowser
            onItemContextMenu={handleItemContextMenu}
            onFolderContextMenu={handleFolderContextMenu}
            onEmptyAreaContextMenu={handleEmptyAreaContextMenu}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      </div>
    </FileExplorerShell>
  )
}
