import type { FileItemRecord } from '@shared/types/folder'

export function getBlobId(item: Pick<FileItemRecord, 'id' | 'url'>): string {
  if (item.url.startsWith('blob:')) {
    const blobId = item.url.slice('blob:'.length)
    if (blobId) return blobId
  }
  return item.id
}
