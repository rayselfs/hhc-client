import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FileExplorerShell,
  FileUpload,
  SearchBar,
  useFileContextMenu
} from '@renderer/components/Control/FileExplorer'
import FileBrowser from '@renderer/components/Control/FileExplorer/FileBrowser'
import { removeFileItemFromStore, useFileExplorerStore } from '@renderer/stores/file-explorer'
import type { AnyItemRecord } from '@shared/types/folder'
import type { ClipboardState } from '@renderer/components/Control/FileExplorer'

export default function FilesPage(): React.JSX.Element {
  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const itemsArray = useFileExplorerStore((state) => state._itemsArray)
  const getChildFolders = useFileExplorerStore((state) => state.getChildFolders)
  const addFolder = useFileExplorerStore((state) => state.addFolder)
  const deleteFolder = useFileExplorerStore((state) => state.deleteFolder)
  const moveItem = useFileExplorerStore((state) => state.moveItem)
  const moveFolder = useFileExplorerStore((state) => state.moveFolder)
  const addItem = useFileExplorerStore((state) => state.addItem)
  const updateFolder = useFileExplorerStore((state) => state.updateFolder)
  const updateItem = useFileExplorerStore((state) => state.updateItem)
  const { showItemMenu, showFolderMenu, showMultiSelectMenu, showEmptyAreaMenu } =
    useFileContextMenu()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const itemCount = useMemo(
    () => itemsArray.filter((item: AnyItemRecord) => item.parentId === currentFolderId).length,
    [itemsArray, currentFolderId]
  )
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

  const startRename = useCallback((id: string, name: string): void => {
    setRenamingId(id)
    setRenameValue(name)
  }, [])

  const cancelRename = useCallback((): void => {
    setRenamingId(null)
    setRenameValue('')
  }, [])

  const submitRename = useCallback((): void => {
    if (!renamingId) return
    const nextName = renameValue.trim()
    if (nextName === '') return

    const state = useFileExplorerStore.getState()
    if (state.folders[renamingId]) {
      updateFolder(renamingId, { name: nextName })
    } else if (state.items[renamingId]?.type === 'file' && updateItem) {
      updateItem(renamingId, { name: nextName })
    }

    cancelRename()
  }, [renamingId, renameValue, updateFolder, updateItem, cancelRename])

  const handleDelete = useCallback(
    (targetIds: Set<string>): void => {
      for (const id of targetIds) {
        const state = useFileExplorerStore.getState()
        if (state.folders[id]) {
          deleteFolder(id)
        } else {
          void removeFileItemFromStore(id)
        }
      }
      setSelectedIds(new Set())
    },
    [deleteFolder]
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
          const item = state.items[id]
          const itemData = {
            ...item,
            id: undefined,
            sortIndex: undefined,
            createdAt: undefined
          }
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
        onDelete: handleDelete,
        onEdit: (targetItem) => {
          const fileItem = useFileExplorerStore.getState().items[targetItem.id]
          if (fileItem?.type === 'file') startRename(fileItem.id, fileItem.name)
        }
      })
    },
    [
      selectedIds,
      showMultiSelectMenu,
      showItemMenu,
      handleCopy,
      handleCut,
      handleDelete,
      startRename
    ]
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
        onDelete: handleDelete,
        onEdit: (targetFolder) => startRename(targetFolder.id, targetFolder.name)
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
      handleDelete,
      startRename
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
            onCopy={handleCopy}
            onCut={handleCut}
            onPaste={handlePaste}
          />
        </div>
      </div>
      {renamingId && (
        <div className="absolute inset-0 z-50 flex items-start justify-center bg-background/20 pt-24 backdrop-blur-sm">
          <form
            className="w-80 rounded-lg border border-border bg-content1 p-3 shadow-xl"
            onSubmit={(event) => {
              event.preventDefault()
              submitRename()
            }}
          >
            <label
              className="mb-2 block text-xs font-medium text-default-500"
              htmlFor="file-rename-input"
            >
              Rename
            </label>
            <input
              id="file-rename-input"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') cancelRename()
              }}
              className="w-full rounded-md border border-default-200 bg-default-100 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
          </form>
        </div>
      )}
    </FileExplorerShell>
  )
}
