import type { VerseItem, Folder } from '@/types/common'

/**
 * 類型守衛：檢查是否為 VerseItem
 */
export const isVerseItem = (item: VerseItem | Folder<VerseItem>): item is VerseItem => {
  return 'verse' in item && 'bookNumber' in item && 'chapter' in item
}

/**
 * 類型守衛：檢查是否為 Folder
 */
export const isFolder = <T extends VerseItem>(
  item: VerseItem | Folder<T>,
): item is Folder<T> => {
  return 'folders' in item && 'items' in item && !('verse' in item)
}

/**
 * 拖放數據類型
 */
export interface DragData<T extends VerseItem = VerseItem> {
  type: 'verse' | 'folder'
  item: VerseItem | Folder<T>
}

/**
 * 驗證拖放數據的類型守衛
 */
export const isValidDragData = <T extends VerseItem>(
  data: unknown,
): data is DragData<T> => {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>
  if (d.type !== 'verse' && d.type !== 'folder') return false
  if (!d.item || typeof d.item !== 'object') return false

  if (d.type === 'verse') {
    return isVerseItem(d.item as VerseItem | Folder<T>)
  } else {
    return isFolder(d.item as VerseItem | Folder<T>)
  }
}


