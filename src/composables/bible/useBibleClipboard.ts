import { type Ref, type ComputedRef } from 'vue'
import type { VerseItem, Folder, ClipboardItem } from '@/types/common'
import { isVerseItem, isFolder } from '@/utils/typeGuards'
import { BibleFolder } from '@/types/enum'

interface TabRef {
  copySelectedItems: () => void
}

interface UseBibleClipboardOptions {
  selectedItem: Ref<{
    type: 'verse' | 'folder' | 'history'
    item: VerseItem | Folder<VerseItem>
  } | null>
  activeTabSelection: Ref<Set<string>>
  multiFunctionTab: Ref<string>
  customFolderTabRef: Ref<TabRef | null>
  historyTabRef: Ref<TabRef | null>
  currentFolder: ComputedRef<Folder<VerseItem>>
  clipboard: Ref<ClipboardItem<VerseItem>[]>
  closeItemContextMenu: () => void
  copyToClipboard: (items: ClipboardItem<VerseItem>[]) => void
  hasClipboardItems: () => boolean
  moveItemAction: (item: VerseItem, targetFolderId: string, sourceFolderId: string) => Promise<void>
  pasteItem: (
    item: VerseItem | Folder<VerseItem>,
    targetFolderId: string,
    itemType: 'verse' | 'file' | 'folder',
  ) => Promise<void>
  moveFolderAction: (
    folder: Folder<VerseItem>,
    targetFolderId: string,
    sourceFolderId: string,
    skipSave?: boolean,
  ) => Promise<boolean>
  updateFolder: (folderId: string, updates: Partial<Folder<VerseItem>>) => Promise<void>
  clearClipboard: () => void
  getCurrentFolders: ComputedRef<Folder<VerseItem>[]>
}

export function useBibleClipboard(options: UseBibleClipboardOptions) {
  const {
    selectedItem,
    activeTabSelection,
    multiFunctionTab,
    customFolderTabRef,
    historyTabRef,
    currentFolder,
    clipboard,
    closeItemContextMenu,
    copyToClipboard,
    hasClipboardItems,
    moveItemAction,
    pasteItem,
    moveFolderAction,
    updateFolder,
    clearClipboard,
    getCurrentFolders,
  } = options

  const isNameExists = (name: string) => {
    return getCurrentFolders.value.some((f: Folder<VerseItem>) => f.name === name)
  }

  const getUniqueName = (originalName: string) => {
    let finalName = originalName
    let counter = 2

    while (isNameExists(finalName)) {
      finalName = `${originalName} ${counter}`
      counter++
    }

    return finalName
  }

  const copyItem = () => {
    if (!selectedItem.value) return

    const isSelected = activeTabSelection.value.has(selectedItem.value.item.id)
    if (isSelected) {
      if (multiFunctionTab.value === 'custom' && customFolderTabRef.value) {
        customFolderTabRef.value.copySelectedItems()
        closeItemContextMenu()
        return
      } else if (multiFunctionTab.value === 'history' && historyTabRef.value) {
        historyTabRef.value.copySelectedItems()
        closeItemContextMenu()
        return
      }
    }

    const item = selectedItem.value.item

    const type = isFolder(item) ? 'folder' : 'verse'
    const sourceFolderId =
      selectedItem.value.type === 'history'
        ? BibleFolder.ROOT_ID
        : currentFolder.value?.id || BibleFolder.ROOT_ID

    copyToClipboard([
      {
        type: type,
        data: item,
        action: 'copy',
        sourceFolderId,
      },
    ])
    closeItemContextMenu()
  }

  const pasteItemHandler = async () => {
    if (!hasClipboardItems()) return

    const targetFolderId =
      currentFolder.value.id === BibleFolder.ROOT_ID ? BibleFolder.ROOT_ID : currentFolder.value.id

    let movedCount = 0

    for (const item of clipboard.value) {
      const data = item.data

      if (item.type === 'file' || item.type === 'verse') {
        if (isVerseItem(data)) {
          if (item.action === 'cut') {
            await moveItemAction(data as VerseItem, targetFolderId, item.sourceFolderId)
            movedCount++
          } else {
            pasteItem(data as VerseItem, targetFolderId, 'verse')
          }
        }
      } else if (item.type === 'folder') {
        const folder = data as Folder<VerseItem>
        const isValidFolder =
          (folder.items && folder.items.length > 0 && isVerseItem(folder.items[0])) ||
          !folder.items ||
          folder.items.length === 0

        if (isValidFolder) {
          if (item.action === 'cut') {
            const folderData = data as Folder<VerseItem>
            const uniqueName = getUniqueName(folderData.name)

            if (uniqueName !== folderData.name) {
              await updateFolder(folderData.id, { name: uniqueName })
            }

            await moveFolderAction(
              data as Folder<VerseItem>,
              targetFolderId,
              item.sourceFolderId,
              false,
            )
            movedCount++
          } else {
            const folderData = data as Folder<VerseItem>
            const uniqueName = getUniqueName(folderData.name)

            const folderToPaste = { ...folderData, name: uniqueName }

            pasteItem(folderToPaste, targetFolderId, 'folder')
          }
        }
      }
    }

    if (movedCount > 0) {
      clearClipboard()
    }

    closeItemContextMenu()
  }

  return {
    copyItem,
    pasteItemHandler,
  }
}
