import type { FileItemRecord } from '@shared/types/folder'

export const PPTX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export function isPresentationMimeType(mimeType: string | undefined): boolean {
  return mimeType === PPTX_MIME_TYPE
}

export function isPresentationItem(item: FileItemRecord | undefined | null): boolean {
  return Boolean(
    item && isPresentationMimeType(item.mimeType) && !item.url.startsWith('unsupported:')
  )
}

export function getPresentationWorkspacePath(itemId: string): string {
  return `/presentations/${encodeURIComponent(itemId)}`
}
