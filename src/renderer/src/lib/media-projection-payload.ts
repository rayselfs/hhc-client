import { getBlobId } from '@renderer/lib/blob-identity'
import { loadEditablePresentation } from '@renderer/lib/editable-presentation'
import { getMediaType, type MediaTypeStateMap } from '@renderer/lib/presentability'
import type { PresentationSnapshot } from '@renderer/lib/presentation-readiness'
import { isEditablePresentationMimeType } from '@renderer/lib/presentation-media'
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

export async function buildFileProjectionPayloadWithEditableSlide(
  input: BuildFileProjectionPayloadInput
): Promise<ProjectionPayload<'file:show'> | null> {
  const payload = buildFileProjectionPayload(input)
  const item = input.playlist[input.currentIndex]
  if (!payload || !item || !isEditablePresentationMimeType(item.mimeType)) return payload

  const document = await loadEditablePresentation(item)
  const slideIndex = payload.presentation?.slideIndex ?? 0
  const slideId = document.slideOrder[Math.min(slideIndex, Math.max(0, document.slideOrder.length - 1))]
  const slide = slideId ? document.slides[slideId] : undefined
  if (!slide) return payload

  const assets: Record<string, (typeof document.assets)[string]> = {}
  for (const elementId of slide.elementOrder) {
    const element = slide.elements[elementId]
    if (element?.type !== 'image') continue
    const asset = document.assets[element.assetId]
    if (asset) assets[asset.id] = asset
  }

  return {
    ...payload,
    presentation: { slideIndex, slideCount: document.slideOrder.length },
    editablePresentation: {
      width: document.width,
      height: document.height,
      slide,
      assets
    }
  }
}
