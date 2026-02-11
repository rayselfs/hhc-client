import type { VerseItem, Folder, FolderItem, FileItem } from '@/types/folder'

/**
 * Type Guard: Check if item is VerseItem
 */
export const isVerseItem = (item: FolderItem | Folder<FolderItem> | unknown): item is VerseItem => {
  return (
    !!item &&
    typeof item === 'object' &&
    (item as VerseItem).type === 'verse' &&
    'bookNumber' in item
  )
}

/**
 * Type Guard: Check if item is FileItem
 */
export const isFileItem = (item: FolderItem | Folder<FolderItem> | unknown): item is FileItem => {
  return (
    !!item && typeof item === 'object' && (item as FileItem).type === 'file' && 'metadata' in item
  )
}

/**
 * Type Guard: Check if item is Folder
 */
export const isFolder = <T extends FolderItem>(
  item: T | Folder<T> | unknown,
): item is Folder<T> => {
  return !!item && typeof item === 'object' && 'items' in item && 'folders' in item
}

/**
 * Drag Data Type
 */
export interface DragData<T extends FolderItem = FolderItem> {
  type: 'verse' | 'file' | 'folder'
  items: (T | Folder<T>)[]
}

/**
 * Validate Drag Data Type Guard
 */
export const isValidDragData = <T extends FolderItem>(data: unknown): data is DragData<T> => {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>
  if (d.type !== 'verse' && d.type !== 'file' && d.type !== 'folder') return false

  // Check for items array
  if (!d.items || !Array.isArray(d.items) || d.items.length === 0) return false

  // Helper check for single item (first one)
  const firstItem = d.items[0] as FolderItem | Folder<FolderItem>
  if (!firstItem || typeof firstItem !== 'object') return false

  if (d.type === 'verse') {
    return isVerseItem(firstItem)
  } else if (d.type === 'file') {
    return isFileItem(firstItem)
  } else {
    return isFolder(firstItem)
  }
}
