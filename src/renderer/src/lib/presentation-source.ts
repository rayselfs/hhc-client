import { getBlobId } from './blob-identity'
import { getFileSource, openFileExplorerDB } from './file-explorer-db'
import type { FileItemRecord } from '@shared/types/folder'

export type PresentationSource = Pick<FileItemRecord, 'id' | 'url' | 'mimeType'>

function isTrustedEphemeralSourceUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol === 'hhc-media:' && url.hostname === 'lease') {
      return /^\/[0-9a-f-]{36}$/.test(url.pathname)
    }
    return (
      url.origin === 'https://www.alive.org.tw' &&
      url.pathname === '/api/assets/content' &&
      url.searchParams.size === 1 &&
      Boolean(url.searchParams.get('ticket'))
    )
  } catch {
    return false
  }
}

export async function readPresentationArrayBuffer(
  sourceItem: PresentationSource
): Promise<ArrayBuffer> {
  let sourceUrl = sourceItem.url
  let revoke = (): void => undefined
  const ephemeral = isTrustedEphemeralSourceUrl(sourceUrl)
  if (!ephemeral) {
    const db = await openFileExplorerDB()
    const source = await getFileSource(db, getBlobId(sourceItem), sourceItem.mimeType)
    if (!source) throw new Error('Presentation source is unavailable')
    sourceUrl = source.url
    revoke = source.revoke
  }
  try {
    const response = ephemeral
      ? await fetch(sourceUrl, { cache: 'no-store', referrerPolicy: 'no-referrer' })
      : await fetch(sourceUrl)
    if (!response.ok) throw new Error(`Failed to read presentation source: ${response.status}`)
    return response.arrayBuffer()
  } finally {
    revoke()
  }
}
