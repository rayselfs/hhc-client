import { getBlobId } from './blob-identity'
import { getFileSource, openFileExplorerDB } from './file-explorer-db'
import type { FileItemRecord } from '@shared/types/folder'

export type PresentationSource = Pick<FileItemRecord, 'id' | 'url' | 'mimeType'>

export async function readPresentationArrayBuffer(
  sourceItem: PresentationSource
): Promise<ArrayBuffer> {
  const db = await openFileExplorerDB()
  const source = await getFileSource(db, getBlobId(sourceItem), sourceItem.mimeType)
  if (!source) throw new Error('Presentation source is unavailable')
  try {
    const response = await fetch(source.url)
    if (!response.ok) throw new Error(`Failed to read presentation source: ${response.status}`)
    return response.arrayBuffer()
  } finally {
    source.revoke()
  }
}
