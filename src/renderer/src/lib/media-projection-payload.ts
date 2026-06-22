import { getBlobId } from '@renderer/lib/blob-identity'
import type { PresentationSnapshot } from '@renderer/lib/presentation-readiness'
import type { ProjectionPayload } from '@shared/projection-messages'
import type { FileItemRecord } from '@shared/types/folder'

export interface BuildFileProjectionPayloadInput {
  playlist: FileItemRecord[]
  currentIndex: number
  snapshot?: PresentationSnapshot | null
}

export function buildFileProjectionPayload({
  playlist,
  currentIndex,
  snapshot
}: BuildFileProjectionPayloadInput): ProjectionPayload<'file:show'> | null {
  const item = playlist[currentIndex]
  if (!item) return null

  const snapshotEntry = snapshot?.entries.find((entry) => entry.itemId === item.id)
  const blobId = snapshotEntry?.blobId ?? getBlobId(item)

  return {
    itemId: item.id,
    blobId,
    fileName: item.name,
    mimeType: item.mimeType,
    playlist: playlist.map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType
    })),
    currentIndex,
    playbackMode: snapshotEntry?.playbackMode,
    seekable: snapshotEntry?.seekable,
    durationMs: snapshotEntry?.durationMs
  }
}
