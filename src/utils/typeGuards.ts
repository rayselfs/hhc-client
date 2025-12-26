import type { VerseItem, Folder, FolderItem, FileItem } from '@/types/common'

/**
 * Type Guard: Check if item is VerseItem
 */
export const isVerseItem = (item: FolderItem | Folder<FolderItem>): item is VerseItem => {
  return (item as VerseItem).type === 'verse' && 'bookNumber' in item
}

/**
 * Type Guard: Check if item is FileItem
 */
export const isFileItem = (item: FolderItem | Folder<FolderItem>): item is FileItem => {
  return (item as FileItem).type === 'file' && 'metadata' in item
}

/**
 * Type Guard: Check if item is Folder
 */
export const isFolder = <T extends FolderItem>(item: T | Folder<T>): item is Folder<T> => {
  return 'items' in item && 'folders' in item
}

/**
 * Drag Data Type
 */
export interface DragData<T extends FolderItem = FolderItem> {
  type: 'verse' | 'file' | 'folder'
  item: T | Folder<T>
}

/**
 * Validate Drag Data Type Guard
 */
export const isValidDragData = <T extends FolderItem>(data: unknown): data is DragData<T> => {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>
  if (d.type !== 'verse' && d.type !== 'file' && d.type !== 'folder') return false
  if (!d.item || typeof d.item !== 'object') return false

  if (d.type === 'verse') {
    return isVerseItem(d.item as FolderItem)
  } else if (d.type === 'file') {
    return isFileItem(d.item as FolderItem)
  } else {
    return isFolder(d.item as FolderItem) // Type assertion might need T
  }
}
