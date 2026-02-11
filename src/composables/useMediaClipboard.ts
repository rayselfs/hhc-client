import { v4 as uuidv4 } from 'uuid'

import { FOLDER_DB_CONFIG } from '@/config/db'
import { useFileSystem } from '@/composables/useFileSystem'
import { useIndexedDB } from '@/composables/useIndexedDB'
import type { FileItem, Folder, ClipboardItem } from '@/types/folder'
import { FolderDBStore, MediaFolder } from '@/types/enum'

interface UseMediaClipboardOptions {
  getCurrentFolders: () => Folder<FileItem>[]
  getCurrentItems: () => FileItem[]
  currentFolderPath: () => string[]
  clipboard: () => ClipboardItem<FileItem>[]
  copyToClipboard: (items: ClipboardItem<FileItem>[]) => void
  cutToClipboard: (items: ClipboardItem<FileItem>[]) => void
  pasteItem: (
    item: FileItem | Folder<FileItem>,
    targetFolderId: string,
    type: 'file' | 'folder',
  ) => void
  moveItemAction: (item: FileItem, targetFolderId: string, sourceFolderId: string) => void
  moveFolderAction: (
    folder: Folder<FileItem>,
    targetFolderId: string,
    sourceFolderId: string,
  ) => void
  clearClipboard: () => void
  updateFolder: (id: string, updates: { name?: string }) => void
  updateItem: (id: string, parentId: string, updates: { name?: string }) => void
  getUniqueName: (originalName: string, type: 'folder' | 'file') => string
}

export function useMediaClipboard(
  options: UseMediaClipboardOptions,
  selectedItems: { value: Set<string>; clear: () => void },
) {
  const fileSystem = useFileSystem()
  const db = useIndexedDB(FOLDER_DB_CONFIG)

  const duplicateThumbnailBlob = async (
    originalItemId: string,
    newItemId: string,
  ): Promise<boolean> => {
    try {
      const originalThumbnail = await db.get<{ id: string; blob: Blob; createdAt?: number }>(
        FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME,
        originalItemId,
      )
      if (!originalThumbnail || !originalThumbnail.blob) return false

      await db.put(FolderDBStore.FOLDER_DB_THUMBNAILS_STORE_NAME, {
        id: newItemId,
        blob: originalThumbnail.blob,
        createdAt: Date.now(),
      })
      return true
    } catch (error) {
      console.warn('Failed to duplicate thumbnail blob:', error)
      return false
    }
  }

  const duplicatePhysicalFiles = async (
    item: FileItem | Folder<FileItem>,
  ): Promise<FileItem | Folder<FileItem> | null> => {
    if ('items' in item) {
      const newItems: FileItem[] = []
      const newFolders: Folder<FileItem>[] = []

      for (const subItem of item.items) {
        const duplicatedSubItem = await duplicatePhysicalFiles(subItem)
        if (duplicatedSubItem) newItems.push(duplicatedSubItem as FileItem)
      }

      for (const subFolder of item.folders) {
        const duplicatedSubFolder = await duplicatePhysicalFiles(subFolder)
        if (duplicatedSubFolder) newFolders.push(duplicatedSubFolder as Folder<FileItem>)
      }

      return {
        ...item,
        items: newItems,
        folders: newFolders,
      }
    } else {
      const fileItem = item as FileItem
      if (!fileSystem.canEdit(fileItem)) return { ...fileItem }

      const result = await fileSystem.copyFile(fileItem)
      if (result.success && result.data) {
        const newItemId = uuidv4()
        const newMetadata = {
          ...fileItem.metadata,
          thumbnailUrl: fileItem.metadata.thumbnailUrl,
        }
        if (fileItem.metadata.thumbnailBlobId) {
          const success = await duplicateThumbnailBlob(fileItem.id, newItemId)
          if (success) newMetadata.thumbnailBlobId = newItemId
        }
        return {
          ...fileItem,
          id: newItemId,
          url: result.data.fileUrl,
          metadata: newMetadata,
        }
      }
      return { ...fileItem, id: uuidv4(), metadata: { ...fileItem.metadata } }
    }
  }

  const handleCopy = () => {
    if (selectedItems.value.size === 0) return

    const items: ClipboardItem<FileItem>[] = []
    const currentPath = options.currentFolderPath()
    const sourceFolderId =
      currentPath.length > 0 && currentPath[currentPath.length - 1] === MediaFolder.ROOT_ID
        ? MediaFolder.ROOT_ID
        : currentPath[currentPath.length - 1] || MediaFolder.ROOT_ID

    selectedItems.value.forEach((id) => {
      const folder = options.getCurrentFolders().find((f) => f.id === id)
      if (folder) {
        items.push({
          type: 'folder',
          data: folder,
          action: 'copy',
          sourceFolderId,
        })
      } else {
        const item = options.getCurrentItems().find((i) => i.id === id)
        if (item) {
          items.push({
            type: 'file',
            data: item,
            action: 'copy',
            sourceFolderId,
          })
        }
      }
    })
    options.copyToClipboard(items)
    selectedItems.clear()
  }

  const handleCut = () => {
    if (selectedItems.value.size === 0) return

    const items: ClipboardItem<FileItem>[] = []
    const currentPath = options.currentFolderPath()
    const sourceFolderId =
      currentPath.length > 0 && currentPath[currentPath.length - 1] === MediaFolder.ROOT_ID
        ? MediaFolder.ROOT_ID
        : currentPath[currentPath.length - 1] || MediaFolder.ROOT_ID

    selectedItems.value.forEach((id) => {
      const folder = options.getCurrentFolders().find((f) => f.id === id)
      if (folder) {
        items.push({
          type: 'folder',
          data: folder,
          action: 'cut',
          sourceFolderId,
        })
      } else {
        const item = options.getCurrentItems().find((i) => i.id === id)
        if (item) {
          items.push({
            type: 'file',
            data: item,
            action: 'cut',
            sourceFolderId,
          })
        }
      }
    })
    options.cutToClipboard(items)
    selectedItems.clear()
  }

  const handlePaste = async () => {
    const clipboard = options.clipboard()
    if (clipboard.length === 0) return

    const currentPath = options.currentFolderPath()
    const targetFolderId =
      currentPath.length > 0 && currentPath[currentPath.length - 1] === MediaFolder.ROOT_ID
        ? MediaFolder.ROOT_ID
        : currentPath[currentPath.length - 1] || MediaFolder.ROOT_ID

    for (const clipboardItem of clipboard) {
      if (clipboardItem.action === 'copy') {
        const type = clipboardItem.type === 'file' ? 'file' : 'folder'
        const itemData = clipboardItem.data as FileItem | Folder<FileItem>
        const uniqueName = options.getUniqueName(itemData.name, type)

        const itemToPaste = await duplicatePhysicalFiles(
          clipboardItem.data as FileItem | Folder<FileItem>,
        )
        if (itemToPaste) {
          itemToPaste.name = uniqueName
          options.pasteItem(
            itemToPaste,
            targetFolderId,
            clipboardItem.type === 'file' ? 'file' : 'folder',
          )
        }
      } else if (clipboardItem.action === 'cut') {
        const type = clipboardItem.type === 'file' ? 'file' : 'folder'
        if (clipboardItem.sourceFolderId !== targetFolderId) {
          const itemData = clipboardItem.data as FileItem | Folder<FileItem>
          const uniqueName = options.getUniqueName(itemData.name, type)

          if (uniqueName !== itemData.name) {
            if (type === 'folder') {
              options.updateFolder(itemData.id, { name: uniqueName })
            } else {
              options.updateItem(itemData.id, clipboardItem.sourceFolderId, {
                name: uniqueName,
              })
            }
          }
        }
        if (clipboardItem.type === 'file') {
          options.moveItemAction(
            clipboardItem.data as FileItem,
            targetFolderId,
            clipboardItem.sourceFolderId,
          )
        } else {
          options.moveFolderAction(
            clipboardItem.data as Folder<FileItem>,
            targetFolderId,
            clipboardItem.sourceFolderId,
          )
        }
      }
    }
    if (clipboard.length > 0 && clipboard[0]?.action === 'cut') {
      options.clearClipboard()
    }
  }

  const handlePasteIntoFolder = async (targetFolderId: string) => {
    const clipboard = options.clipboard()
    if (clipboard.length === 0) return

    for (const clipboardItem of clipboard) {
      if (clipboardItem.action === 'copy') {
        const type = clipboardItem.type === 'file' ? 'file' : 'folder'
        const itemData = clipboardItem.data as FileItem | Folder<FileItem>
        const uniqueName = options.getUniqueName(itemData.name, type)
        const itemToPaste = await duplicatePhysicalFiles(
          clipboardItem.data as FileItem | Folder<FileItem>,
        )
        if (itemToPaste) {
          itemToPaste.name = uniqueName
          options.pasteItem(
            itemToPaste,
            targetFolderId,
            clipboardItem.type === 'file' ? 'file' : 'folder',
          )
        }
      } else if (clipboardItem.action === 'cut') {
        if (clipboardItem.type === 'file') {
          options.moveItemAction(
            clipboardItem.data as FileItem,
            targetFolderId,
            clipboardItem.sourceFolderId,
          )
        } else {
          options.moveFolderAction(
            clipboardItem.data as Folder<FileItem>,
            targetFolderId,
            clipboardItem.sourceFolderId,
          )
        }
      }
    }
    if (clipboard.length > 0 && clipboard[0]?.action === 'cut') {
      options.clearClipboard()
    }
  }

  return {
    handleCopy,
    handleCut,
    handlePaste,
    handlePasteIntoFolder,
  }
}
