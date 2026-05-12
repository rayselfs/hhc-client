import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  FileExplorerShell,
  useFileContextMenu
} from '@renderer/components/Control/FileExplorer'
import FileBrowser from '@renderer/components/Control/FileExplorer/FileBrowser'
import FileExplorerFAB from '@renderer/components/Control/FileExplorer/FileExplorerFAB'
import { FolderModal } from '@renderer/components/Control/Folder/FolderModal'
import {
  deleteFolderFromStore,
  removeFileItemFromStore,
  useFileExplorerStore
} from '@renderer/stores/file-explorer'
import { uploadFiles, uploadFolderFiles } from '@renderer/lib/upload-utils'
import { computeExpiresAt, type AnyItemRecord, type FolderDuration } from '@shared/types/folder'
import type { ClipboardState } from '@renderer/components/Control/FileExplorer'

export default function FilesPage(): React.JSX.Element {
  const { t } = useTranslation()
  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const itemsArray = useFileExplorerStore((state) => state._itemsArray)
  const foldersArray = useFileExplorerStore((state) => state._foldersArray)
  const getChildFolders = useFileExplorerStore((state) => state.getChildFolders)
  const addFolder = useFileExplorerStore((state) => state.addFolder)
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
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false)
  const [createFolderName, setCreateFolderName] = useState('')
  const [createFolderDuration, setCreateFolderDuration] = useState<FolderDuration>('1day')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const itemCount = useMemo(
    () =>
      itemsArray.filter((item: AnyItemRecord) => item.parentId === currentFolderId).length +
      foldersArray.filter((folder) => folder.parentId === currentFolderId).length,
    [itemsArray, foldersArray, currentFolderId]
  )
  const selectedCount = selectedIds.size

  useEffect(() => {
    void useFileExplorerStore.getState().initialize()
  }, [])

  useEffect(() => {
    const el = folderInputRef.current
    if (el) {
      el.setAttribute('webkitdirectory', '')
      el.setAttribute('directory', '')
    }
  }, [])

  const handleUploadFiles = useCallback((): void => {
    fileInputRef.current?.click()
  }, [])

  const handleUploadFolder = useCallback((): void => {
    folderInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const files = Array.from(e.target.files ?? [])
      if (files.length === 0) return
      await uploadFiles(files, currentFolderId)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [currentFolderId]
  )

  const handleFolderChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const allFiles = Array.from(e.target.files ?? [])
      if (allFiles.length === 0) return
      await uploadFolderFiles(allFiles, currentFolderId, addFolder)
      if (folderInputRef.current) folderInputRef.current.value = ''
    },
    [currentFolderId, addFolder]
  )

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

  const handleDelete = useCallback((targetIds: Set<string>): void => {
    for (const id of targetIds) {
      const state = useFileExplorerStore.getState()
      if (state.folders[id]) {
        void deleteFolderFromStore(id)
      } else {
        void removeFileItemFromStore(id)
      }
    }
    setSelectedIds(new Set())
  }, [])

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

  const openCreateFolderModal = useCallback((): void => {
    const existingNames = getChildFolders(currentFolderId).map((f) => f.name)
    const base = t('folder.untitledFolder')
    let name = base
    let n = 2
    while (existingNames.includes(name)) {
      name = `${base} ${n}`
      n++
    }
    setCreateFolderName(name)
    setCreateFolderDuration('1day')
    setIsCreateFolderModalOpen(true)
  }, [getChildFolders, currentFolderId, t])

  const handleCreateFolderSubmit = useCallback((): void => {
    const name = createFolderName.trim()
    if (!name) return
    addFolder(name, currentFolderId, computeExpiresAt(createFolderDuration))
    setIsCreateFolderModalOpen(false)
  }, [createFolderName, createFolderDuration, addFolder, currentFolderId])

  const handleEmptyAreaContextMenu = useCallback(
    (event: React.MouseEvent): void => {
      showEmptyAreaMenu({
        event,
        clipboard,
        onPaste: handlePaste,
        onNewFolder: openCreateFolderModal,
        onUploadFiles: handleUploadFiles,
        onUploadFolder: handleUploadFolder
      })
    },
    [clipboard, showEmptyAreaMenu, handlePaste, openCreateFolderModal, handleUploadFiles, handleUploadFolder]
  )

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.pptx,.ppt,.key,.odp"
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => void handleFolderChange(e)}
      />
      <FileExplorerShell itemCount={itemCount} selectedCount={selectedCount}>
        <FileBrowser
          onItemContextMenu={handleItemContextMenu}
          onFolderContextMenu={handleFolderContextMenu}
          onEmptyAreaContextMenu={handleEmptyAreaContextMenu}
          onSelectionChange={handleSelectionChange}
          onCopy={handleCopy}
          onCut={handleCut}
          onPaste={handlePaste}
        />
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
      <FileExplorerFAB onUploadFiles={handleUploadFiles} onUploadFolder={handleUploadFolder} />
      <FolderModal
        isOpen={isCreateFolderModalOpen}
        onClose={() => setIsCreateFolderModalOpen(false)}
        onSubmit={handleCreateFolderSubmit}
        editingFolder={null}
        folderName={createFolderName}
        onFolderNameChange={setCreateFolderName}
        folderDuration={createFolderDuration}
        onFolderDurationChange={setCreateFolderDuration}
      />
    </>
  )
}
