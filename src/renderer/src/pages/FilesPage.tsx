import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
import { uploadFiles, uploadFolderFiles } from '@renderer/lib/upload-utils'
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

function resolveUniqueName(baseName: string, existingNames: string[]): string {
  if (!existingNames.includes(baseName)) return baseName
  let n = 2
  while (existingNames.includes(`${baseName} ${n}`)) n++
  return `${baseName} ${n}`
}

function resolveUniqueFileName(name: string, existingNames: string[]): string {
  if (!existingNames.includes(name)) return name
  const lastDot = name.lastIndexOf('.')
  const base = lastDot > 0 ? name.slice(0, lastDot) : name
  const ext = lastDot > 0 ? name.slice(lastDot) : ''
  let n = 2
  while (existingNames.includes(`${base} ${n}${ext}`)) n++
  return `${base} ${n}${ext}`
}

export default function FilesPage(): React.JSX.Element {
  const { t } = useTranslation()
  const confirm = useConfirm()
  const isPresenting = useMediaProjectionStore((s) => s.isPresenting)
  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const getChildFolders = useFileExplorerStore((state) => state.getChildFolders)
  const addFolder = useFileExplorerStore((state) => state.addFolder)
  const moveItem = useFileExplorerStore((state) => state.moveItem)
  const copyItem = useFileExplorerStore((state) => state.copyItem)
  const moveFolder = useFileExplorerStore((state) => state.moveFolder)
  const updateFolder = useFileExplorerStore((state) => state.updateFolder)
  const updateItem = useFileExplorerStore((state) => state.updateItem)
  const { showItemMenu, showFolderMenu, showMultiSelectMenu, showEmptyAreaMenu } =
    useFileContextMenu()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false)
  const [createFolderName, setCreateFolderName] = useState('')
  const [createFolderDuration, setCreateFolderDuration] = useState<FolderDuration>('1day')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editModalName, setEditModalName] = useState('')
  const [editingExtension, setEditingExtension] = useState('')
  const [editModalDuration, setEditModalDuration] = useState<FolderDuration>('1day')
  const [editingIsFavorited, setEditingIsFavorited] = useState(false)
  const [editingHideDuration, setEditingHideDuration] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const itemCount = useFileExplorerStore(
    useCallback(
      (state) =>
        (state._itemsByParent[currentFolderId]?.length ?? 0) +
        (state._childFoldersByParent[currentFolderId]?.length ?? 0),
      [currentFolderId]
    )
  )
  const selectedCount = selectedIds.size

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

  const handleEscape = useCallback((): void => {
    if (clipboard?.mode === 'cut') {
      setClipboard(null)
    }
  }, [clipboard])

  const handleDelete = useCallback(
    async (targetIds: Set<string>): Promise<void> => {
      if (targetIds.size === 0) return
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
    [confirm, t]
  )

  const handlePaste = useCallback(async (): Promise<void> => {
    if (!clipboard) return

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
  }, [clipboard, currentFolderId, addFolder, copyItem, moveFolder, moveItem])

  const openEditModal = useCallback((id: string): void => {
    const state = useFileExplorerStore.getState()
    const target = state.folders[id] ?? state.items[id]
    if (!target) return
    const isFileItemInSubfolder =
      !state.folders[id] && !!state.items[id] && state.items[id].parentId !== FILE_EXPLORER_ROOT_ID
    setEditingId(id)
    if (!state.folders[id] && state.items[id]) {
      const lastDot = target.name.lastIndexOf('.')
      if (lastDot > 0) {
        setEditModalName(target.name.slice(0, lastDot))
        setEditingExtension(target.name.slice(lastDot))
      } else {
        setEditModalName(target.name)
        setEditingExtension('')
      }
    } else {
      setEditModalName(target.name)
      setEditingExtension('')
    }
    setEditModalDuration(inferDuration(target.expiresAt, target.createdAt ?? Date.now()))
    setEditingIsFavorited(state.folders[id]?.isFavorited ?? false)
    setEditingHideDuration(isFileItemInSubfolder)
    setIsEditModalOpen(true)
  }, [])

  const handleEditSubmit = useCallback((): void => {
    if (!editingId) return
    const name = editModalName.trim()
    if (!name) return
    const state = useFileExplorerStore.getState()
    if (state.folders[editingId]) {
      updateFolder(editingId, { name, expiresAt: computeExpiresAt(editModalDuration) })
    } else if (state.items[editingId]) {
      const isRoot = state.items[editingId].parentId === FILE_EXPLORER_ROOT_ID
      updateItem?.(editingId, {
        name: name + editingExtension,
        expiresAt: isRoot ? computeExpiresAt(editModalDuration) : null
      })
    }
    setIsEditModalOpen(false)
    setEditingId(null)
  }, [editingId, editModalName, editingExtension, editModalDuration, updateFolder, updateItem])

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
        onEdit: (targetItem) => openEditModal(targetItem.id)
      })
    },
    [
      selectedIds,
      showMultiSelectMenu,
      showItemMenu,
      handleCopy,
      handleCut,
      handleDelete,
      openEditModal
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
        onEdit: (targetFolder) => openEditModal(targetFolder.id)
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
      openEditModal
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
    [
      clipboard,
      showEmptyAreaMenu,
      handlePaste,
      openCreateFolderModal,
      handleUploadFiles,
      handleUploadFolder
    ]
  )

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={getMediaFileAcceptAttribute()}
        className="hidden"
        onChange={(e) => void handleFileChange(e)}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        accept={getMediaFileAcceptAttribute()}
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
        />
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
      <FolderModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setEditingId(null)
        }}
        onSubmit={handleEditSubmit}
        editingFolder={
          editingId
            ? ((useFileExplorerStore.getState().folders[editingId] as FolderRecord | undefined) ??
              ({ id: editingId, name: editModalName } as FolderRecord))
            : null
        }
        folderName={editModalName}
        onFolderNameChange={setEditModalName}
        folderDuration={editModalDuration}
        onFolderDurationChange={setEditModalDuration}
        isRetentionLocked={editingIsFavorited}
        hideDuration={editingHideDuration}
      />
      {isPresenting && <MediaPresenter />}
    </>
  )
}
