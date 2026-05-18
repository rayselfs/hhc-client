import type { AnyItemRecord, FileItemRecord } from '@shared/types/folder'
import { isFileItem } from '@shared/types/folder'

const PRESENTABLE_IMAGE_PREFIXES = ['image/']
const PRESENTABLE_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
const PRESENTABLE_OTHER_MIMES = ['application/pdf']

export type MediaType = 'image' | 'video' | 'pdf'

export function isPresentable(mimeType: string): boolean {
  return (
    PRESENTABLE_IMAGE_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) ||
    PRESENTABLE_VIDEO_MIMES.includes(mimeType) ||
    PRESENTABLE_OTHER_MIMES.includes(mimeType)
  )
}

export function getMediaType(mimeType: string): MediaType | null {
  if (PRESENTABLE_IMAGE_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) return 'image'
  if (PRESENTABLE_VIDEO_MIMES.includes(mimeType)) return 'video'
  if (mimeType === 'application/pdf') return 'pdf'
  return null
}

export function getPresentableItems(items: AnyItemRecord[]): FileItemRecord[] {
  return items.filter((item): item is FileItemRecord => isFileItem(item) && isPresentable(item.mimeType))
}
