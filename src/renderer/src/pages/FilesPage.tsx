import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@heroui/react/toast'
import { FileExplorerShell, useFileContextMenu } from '@renderer/components/Control/FileExplorer'
import FileBrowser from '@renderer/components/Control/FileExplorer/FileBrowser'
import FileExplorerFAB from '@renderer/components/Control/FileExplorer/FileExplorerFAB'
import { FolderModal } from '@renderer/components/Control/Folder/FolderModal'
import {
  deleteFolderFromStore,
  removeFileItemFromStore,
  useFileExplorerStore,
  FILE_EXPLORER_ROOT_ID
} from '@renderer/stores/file-explorer'
import { getUploadMediaPlatform, uploadFiles, uploadFolderFiles } from '@renderer/lib/upload-utils'
import { connectLocalSyncFolder } from '@renderer/lib/local-sync-import'
import { isElectron } from '@renderer/lib/env'
import {
  computeExpiresAt,
  inferDuration,
  isFileItem,
  type FolderDuration,
  type FolderRecord
} from '@shared/types/folder'
import type { ClipboardState } from '@renderer/components/Control/FileExplorer'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import MediaPresenter from '@renderer/components/Control/FileExplorer/Presenter/MediaPresenter'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { getMediaFileAcceptAttribute } from '@renderer/lib/media-capabilities'
import {
  hasNameConflict,
  resolveUniqueFileName,
  resolveUniqueName,
  validateDisplayName
} from '@renderer/lib/file-naming'
import { isFolderReadOnlyBySyncLink } from '@renderer/lib/sync-readonly'

export default function FilesPage(): React.JSX.Element {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const isPresenting = useMediaProjectionStore((s) => s.isPresenting)
  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const foldersById = useFileExplorerStore((state) => state.folders)
  const getChildFolders = useFileExplorerStore((state) => state.getChildFolders)
  const addFolder = useFileExplorerStore((state) => state.addFolder)
  const moveItem = useFileExplorerStore((state) => state.moveItem)
  const copyItem = useFileExplorerStore((state) => state.copyItem)
  const moveFolder = useFileExplorerStore((state) => state.moveFolder)
  const updateFolder = useFileExplorerStore((state) => state.updateFolder)
  const { showItemMenu, showFolderMenu, showMultiSelectMenu, showEmptyAreaMenu } =
    useFileContextMenu()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false)
  const [createFolderName, setCreateFolderName] = useState('')
  const [createFolderDuration, setCreateFolderDuration] = useState<FolderDuration>('1day')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [renameItemRequestId, setRenameItemRequestId] = useState<string | null>(null)
  const [editModalName, setEditModalName] = useState('')
  const [editModalDuration, setEditModalDuration] = useState<FolderDuration>('1day')
  const [editingIsFavorited, setEditingIsFavorited] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const itemCount = useFileExplorerStore(
    useCallback(
      (state) =>
        (state._itemsByParent[currentFolderId]?.filter((item) => !item.deletedAt).length ?? 0) +
        (state._childFoldersByParent[currentFolderId]?.filter((folder) => !folder.deletedAt)
          .length ?? 0),
      [currentFolderId]
    )
  )
  const selectedCount = selectedIds.size
  const fileAccept = getMediaFileAcceptAttribute(getUploadMediaPlatform())
  const canAddLocalSyncFolder = isElectron()
  const isCurrentFolderReadOnly = useMemo(
    () => isFolderReadOnlyBySyncLink(currentFolderId, foldersById),
    [currentFolderId, foldersById]
  )

  const areIdsReadOnly = useCallback((ids: Set<string>): boolean => {
    const state = useFileExplorerStore.getState()
    for (const id of ids) {
      const folder = state.folders[id]
      if (folder && isFolderReadOnlyBySyncLink(folder.id, state.folders)) return true
      const item = state.items[id]
      if (item && isFolderReadOnlyBySyncLink(item.parentId, state.folders)) return true
    }
    return false
  }, [])

  useEffect(() => {
    const el = folderInputRef.current
    if (el) {
      el.setAttribute('webkitdirectory', '')
      el.setAttribute('directory', '')
    }
  }, [])

  const handleUploadFiles = useCallback((): void => {
    if (isCurrentFolderReadOnly) return
    fileInputRef.current?.click()
  }, [isCurrentFolderReadOnly])

  const handleUploadFolder = useCallback((): void => {
    if (isCurrentFolderReadOnly) return
    folderInputRef.current?.click()
  }, [isCurrentFolderReadOnly])

  const handleAddLocalSyncFolder = useCallback(async (): Promise<void> => {
    try {
      const summary = await connectLocalSyncFolder()
      if (!summary) return
      toast.success(
        t('fileExplorer.syncSources.localSyncConnected', {
          name: summary.connection.displayName,
          count: summary.itemCount
        })
      )
    } catch (error) {
      console.warn('[local-sync] Failed to connect folder', error)
      toast.danger(t('fileExplorer.syncSources.localSyncConnectFailed'))
    }
  }, [t])

  const handleAddOneDrive = useCallback((): void => {
    toast.warning(t('fileExplorer.syncSources.oneDriveComingSoon'))
  }, [t])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const files = Array.from(e.target.files ?? [])
      if (files.length === 0) return
      if (isCurrentFolderReadOnly) return
      await uploadFiles(files, currentFolderId)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [currentFolderId, isCurrentFolderReadOnly]
  )

  const handleFolderChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
      const allFiles = Array.from(e.target.files ?? [])
      if (allFiles.length === 0) return
      if (isCurrentFolderReadOnly) return
      await uploadFolderFiles(allFiles, currentFolderId, addFolder)
      if (folderInputRef.current) folderInputRef.current.value = ''
    },
    [currentFolderId, addFolder, isCurrentFolderReadOnly]
  )

  const handleSelectionChange = useCallback((nextSelectedIds: Set<string>): void => {
    setSelectedIds(nextSelectedIds)
  }, [])

  const handleCopy = useCallback((targetIds: Set<string>): void => {
    if (targetIds.size === 0) return
    setClipboard({ itemIds: new Set(targetIds), mode: 'copy' })
  }, [])

  const handleCut = useCallback(
    (targetIds: Set<string>): void => {
      if (targetIds.size === 0) return
      if (areIdsReadOnly(targetIds)) return
      setClipboard({ itemIds: new Set(targetIds), mode: 'cut' })
    },
    [areIdsReadOnly]
  )

  const handleEscape = useCallback((): void => {
    if (clipboard?.mode === 'cut') {
      setClipboard(null)
    }
  }, [clipboard])

  const handleDelete = useCallback(
    async (targetIds: Set<string>): Promise<void> => {
      if (targetIds.size === 0) return
      if (areIdsReadOnly(targetIds)) return
      const confirmed = await confirm({
        title: t('folder.deleteSelectedTitle', {
          count: targetIds.size,
          defaultValue: `Delete ${targetIds.size} item(s)?`
        }),
        description: t('folder.deleteItemDescription', 'This action cannot be undone.'),
        status: 'danger'
      })
      if (!confirmed) return
      for (const id of targetIds) {
        const state = useFileExplorerStore.getState()
        if (state.folders[id]) {
          deleteFolderFromStore(id)
        } else {
          removeFileItemFromStore(id)
        }
      }
      setSelectedIds(new Set())
    },
    [confirm, t, areIdsReadOnly]
  )

  const handlePaste = useCallback(async (): Promise<void> => {
    if (!clipboard) return
    if (isCurrentFolderReadOnly) return

    async function copyFolderRecursive(
      sourceId: string,
      targetParentId: string,
      folderName: string,
      expiresAt: number | null | undefined
    ): Promise<void> {
      const newFolderId = addFolder(folderName, targetParentId, expiresAt)
      await useFileExplorerStore.getState().ensureItemsLoaded(sourceId)
      const s = useFileExplorerStore.getState()
      for (const item of s.getItems(sourceId)) {
        const newId = await copyItem(item.id, newFolderId)
        if (!newId) continue
      }
      for (const sub of s.getChildFolders(sourceId)) {
        await copyFolderRecursive(sub.id, newFolderId, sub.name, sub.expiresAt)
      }
    }

    const state = useFileExplorerStore.getState()
    const usedFolderNames = new Set(state.getChildFolders(currentFolderId).map((f) => f.name))
    const usedItemNames = new Set(
      state
        .getItems(currentFolderId)
        .filter(isFileItem)
        .map((i) => i.name)
    )

    for (const id of clipboard.itemIds) {
      if (state.folders[id]) {
        if (clipboard.mode === 'copy') {
          const uniqueName = resolveUniqueName(state.folders[id].name, [...usedFolderNames])
          usedFolderNames.add(uniqueName)
          await copyFolderRecursive(id, currentFolderId, uniqueName, state.folders[id].expiresAt)
        } else {
          moveFolder(id, currentFolderId)
        }
      } else if (state.items[id]) {
        const item = state.items[id]
        if (!isFileItem(item)) continue
        if (clipboard.mode === 'copy') {
          const uniqueName = resolveUniqueFileName(item.name, [...usedItemNames])
          usedItemNames.add(uniqueName)
          const newId = await copyItem(id, currentFolderId)
          if (!newId) continue
          if (uniqueName !== item.name) {
            useFileExplorerStore.getState().updateItem?.(newId, { name: uniqueName })
          }
        } else {
          moveItem(id, currentFolderId)
        }
      }
    }

    if (clipboard.mode === 'cut') setClipboard(null)
    setSelectedIds(new Set())
  }, [
    clipboard,
    currentFolderId,
    addFolder,
    copyItem,
    moveFolder,
    moveItem,
    isCurrentFolderReadOnly
  ])

  const openEditModal = useCallback((id: string): void => {
    const state = useFileExplorerStore.getState()
    const target = state.folders[id]
    if (!target) return
    if (isFolderReadOnlyBySyncLink(target.id, state.folders)) return
    setEditingId(id)
    setEditModalName(target.name)
    setEditModalDuration(inferDuration(target.expiresAt, target.createdAt ?? Date.now()))
    setEditingIsFavorited(target.isFavorited ?? false)
    setIsEditModalOpen(true)
  }, [])

  const handleEditSubmit = useCallback((): void => {
    if (!editingId) return
    const name = editModalName.trim()
    if (!validateDisplayName(name)) {
      toast.danger(t('fileExplorer.invalidName', 'Invalid name'))
      return
    }
    const state = useFileExplorerStore.getState()
    const folder = state.folders[editingId]
    if (folder) {
      if (isFolderReadOnlyBySyncLink(folder.id, state.folders)) return
      const siblingNames = state
        .getChildFolders(folder.parentId ?? FILE_EXPLORER_ROOT_ID)
        .map((entry) => entry.name)
      if (hasNameConflict(name, siblingNames, { excludeName: folder.name })) {
        toast.danger(
          t('fileExplorer.folderAlreadyExists', 'A folder with this name already exists')
        )
        return
      }
      updateFolder(editingId, { name, expiresAt: computeExpiresAt(editModalDuration) })
    }
    setIsEditModalOpen(false)
    setEditingId(null)
  }, [editingId, editModalName, editModalDuration, updateFolder, t])

  const handleItemContextMenu = useCallback(
    (itemId: string, event: React.MouseEvent): void => {
      const state = useFileExplorerStore.getState()
      const item = state.items[itemId]
      if (!item) return

      const isAlreadySelected = selectedIds.has(itemId)
      if (selectedIds.size > 1 && isAlreadySelected) {
        const isReadOnly = areIdsReadOnly(selectedIds)
        showMultiSelectMenu({
          selectedIds,
          event,
          onCopy: handleCopy,
          onCut: handleCut,
          onDelete: handleDelete,
          isReadOnly
        })
        return
      }

      const isReadOnly = isFolderReadOnlyBySyncLink(item.parentId, state.folders)
      showItemMenu({
        item,
        isAlreadySelected,
        event,
        setSelected: setSelectedIds,
        onCopy: handleCopy,
        onCut: handleCut,
        onDelete: handleDelete,
        onEdit: (targetItem) => setRenameItemRequestId(targetItem.id),
        isReadOnly
      })
    },
    [
      selectedIds,
      showMultiSelectMenu,
      showItemMenu,
      handleCopy,
      handleCut,
      handleDelete,
      areIdsReadOnly
    ]
  )

  const handleFolderContextMenu = useCallback(
    (folderId: string, event: React.MouseEvent): void => {
      const folder = useFileExplorerStore.getState().folders[folderId]
      if (!folder) return

      const isAlreadySelected = selectedIds.has(folderId)
      if (selectedIds.size > 1 && isAlreadySelected) {
        const isReadOnly = areIdsReadOnly(selectedIds)
        showMultiSelectMenu({
          selectedIds,
          event,
          onCopy: handleCopy,
          onCut: handleCut,
          onDelete: handleDelete,
          isReadOnly
        })
        return
      }

      const isReadOnly = isFolderReadOnlyBySyncLink(
        folder.id,
        useFileExplorerStore.getState().folders
      )
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
        onEdit: (targetFolder) => openEditModal(targetFolder.id),
        isReadOnly
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
      openEditModal,
      areIdsReadOnly
    ]
  )

  const openCreateFolderModal = useCallback((): void => {
    if (isCurrentFolderReadOnly) return
    const existingNames = getChildFolders(currentFolderId).map((f) => f.name)
    const base = t('folder.untitledFolder')
    setCreateFolderName(resolveUniqueName(base, existingNames))
    setCreateFolderDuration('1day')
    setIsCreateFolderModalOpen(true)
  }, [getChildFolders, currentFolderId, t, isCurrentFolderReadOnly])

  const handleCreateFolderSubmit = useCallback((): void => {
    const name = createFolderName.trim()
    if (isCurrentFolderReadOnly) return
    if (!validateDisplayName(name)) {
      toast.danger(t('fileExplorer.invalidName', 'Invalid name'))
      return
    }
    const siblingNames = getChildFolders(currentFolderId).map((folder) => folder.name)
    if (hasNameConflict(name, siblingNames)) {
      toast.danger(t('fileExplorer.folderAlreadyExists', 'A folder with this name already exists'))
      return
    }
    addFolder(name, currentFolderId, computeExpiresAt(createFolderDuration))
    setIsCreateFolderModalOpen(false)
  }, [
    createFolderName,
    createFolderDuration,
    addFolder,
    currentFolderId,
    getChildFolders,
    t,
    isCurrentFolderReadOnly
  ])

  const handleEmptyAreaContextMenu = useCallback(
    (event: React.MouseEvent): void => {
      showEmptyAreaMenu({
        event,
        clipboard,
        onPaste: handlePaste,
        onNewFolder: openCreateFolderModal,
        onUploadFiles: handleUploadFiles,
        onUploadFolder: handleUploadFolder,
        onAddLocalSyncFolder: canAddLocalSyncFolder
          ? () => void handleAddLocalSyncFolder()
          : undefined,
        onAddOneDrive: handleAddOneDrive,
        isReadOnly: isCurrentFolderReadOnly
      })
    },
    [
      clipboard,
      showEmptyAreaMenu,
      handlePaste,
      openCreateFolderModal,
      handleUploadFiles,
      handleUploadFolder,
      canAddLocalSyncFolder,
      handleAddLocalSyncFolder,
      handleAddOneDrive,
      isCurrentFolderReadOnly
    ]
  )

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={fileAccept}
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept={fileAccept}
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
          onPaste={() => void handlePaste()}
          clipboard={clipboard}
          onEscape={handleEscape}
          renameItemRequestId={renameItemRequestId}
          onRenameItemRequestHandled={() => setRenameItemRequestId(null)}
          isCurrentFolderReadOnly={isCurrentFolderReadOnly}
        />
      </FileExplorerShell>
      <FileExplorerFAB
        onUploadFiles={handleUploadFiles}
        onUploadFolder={handleUploadFolder}
        onAddLocalSyncFolder={
          canAddLocalSyncFolder ? () => void handleAddLocalSyncFolder() : undefined
        }
        onAddOneDrive={handleAddOneDrive}
        isReadOnly={isCurrentFolderReadOnly}
      />
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
      <FolderModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingId(null)
        }}
        onSubmit={handleEditSubmit}
        editingFolder={editingId ? ({ id: editingId, name: editModalName } as FolderRecord) : null}
        folderName={editModalName}
        onFolderNameChange={setEditModalName}
        folderDuration={editModalDuration}
        onFolderDurationChange={setEditModalDuration}
        isRetentionLocked={editingIsFavorited}
      />
      {isPresenting && <MediaPresenter />}
    </>
  )
}
