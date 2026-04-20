export interface FolderItem {
  id: string
  type: 'verse' | 'file'
  createdAt: number
  sortIndex?: number
  expiresAt?: number | null
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
  expiresAt?: number | null
}

export interface FolderStoreConfig {
  rootId: string
  rootName: string
  dbName: string
}

export type FolderDuration = '1day' | '1week' | '1month' | 'permanent'

export const FOLDER_DURATION_MS: Record<Exclude<FolderDuration, 'permanent'>, number> = {
  '1day': 86_400_000,
  '1week': 604_800_000,
  '1month': 2_592_000_000
}

export function computeExpiresAt(duration: FolderDuration): number | null {
  if (duration === 'permanent') return null
  return Date.now() + FOLDER_DURATION_MS[duration]
}

export function inferDuration(
  expiresAt: number | null | undefined,
  createdAt: number
): FolderDuration {
  if (expiresAt == null) return 'permanent'
  const diff = expiresAt - createdAt
  const entries = Object.entries(FOLDER_DURATION_MS) as [
    Exclude<FolderDuration, 'permanent'>,
    number
  ][]
  let closest: FolderDuration = '1day'
  let minDiff = Infinity
  for (const [key, ms] of entries) {
    const d = Math.abs(diff - ms)
    if (d < minDiff) {
      minDiff = d
      closest = key
    }
  }
  return closest
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
