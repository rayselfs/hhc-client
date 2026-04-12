export interface FolderItem {
  id: string
  type: 'verse' | 'file'
  createdAt: number
  sortIndex?: number
}

export interface VerseItem extends FolderItem {
  type: 'verse'
  folderId: string
  bookCode: string
  bookName: string
  bookNumber: number
  chapter: number
  verseStart: number
  verseEnd: number
  text: string
  versionCode: string
  versionName: string
}

export interface FileItem extends FolderItem {
  type: 'file'
  folderId: string
  name: string
  url: string
  size: number
  mimeType: string
}

export interface Folder<TItem extends FolderItem = FolderItem> {
  id: string
  name: string
  parentId: string | null
  items: TItem[]
  folders: Folder<TItem>[]
  createdAt: number
  sortIndex?: number
}

export interface FolderStoreConfig {
  rootId: string
  rootName: string
  dbName: string
}

export function isVerseItem(item: FolderItem): item is VerseItem {
  return item.type === 'verse'
}

export function isFileItem(item: FolderItem): item is FileItem {
  return item.type === 'file'
}

export function isFolder<T extends FolderItem>(node: unknown): node is Folder<T> {
  return (
    typeof node === 'object' &&
    node !== null &&
    'folders' in node &&
    'items' in node &&
    'name' in node
  )
}
