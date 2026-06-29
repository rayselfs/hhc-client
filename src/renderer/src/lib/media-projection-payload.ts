import { getBlobId } from '@renderer/lib/blob-identity'
import { getMediaType, type MediaTypeStateMap } from '@renderer/lib/presentability'
import type { PresentationSnapshot } from '@renderer/lib/presentation-readiness'
import type { ProjectionPayload } from '@shared/projection-messages'
import type { FileItemRecord } from '@shared/types/folder'

export interface BuildFileProjectionPayloadInput {
  playlist: FileItemRecord[]
  currentIndex: number
  snapshot?: PresentationSnapshot | null
  typeStates?: Partial<{ [K in keyof MediaTypeStateMap]: MediaTypeStateMap[K] }>
}

export function buildFileProjectionPayload({
  playlist,
  currentIndex,
  snapshot,
  typeStates
}: BuildFileProjectionPayloadInput): ProjectionPayload<'file:show'> | null {
  const item = playlist[currentIndex]
  if (!item) return null

  const snapshotEntry = snapshot?.entries.find((entry) => entry.itemId === item.id)
  const blobId = snapshotEntry?.blobId ?? getBlobId(item)
  const presentation =
    getMediaType(item.mimeType) === 'presentation'
      ? (typeStates?.presentation ?? { slideIndex: 0 })
      : undefined

  const payload: ProjectionPayload<'file:show'> = {
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
  if (presentation) payload.presentation = presentation
  return payload
}
