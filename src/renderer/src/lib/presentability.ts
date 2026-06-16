import type { AnyItemRecord, FileItemRecord } from '@shared/types/folder'
import { isFileItem } from '@shared/types/folder'
import { getMediaSupport, resolveMediaCapability } from './media-capabilities'

export type MediaTypeStateMap = {
  image: Record<string, never>
  video: { hasStarted?: boolean; isPlaying?: boolean; isEnded?: boolean }
  pdf: { viewMode: 'slide' | 'scroll'; thumbsCollapsed?: boolean }
}

export type MediaType = keyof MediaTypeStateMap

export function isPresentable(mimeType: string): boolean {
  const capability = resolveMediaCapability({ mimeType })
  return capability !== null && getMediaSupport(capability, 'web') === 'native'
}

export function getMediaType(mimeType: string): MediaType | null {
  const capability = resolveMediaCapability({ mimeType })
  if (!capability || getMediaSupport(capability, 'web') !== 'native') return null
  return capability.kind === 'document' ? null : capability.kind
}

export function getPresentableItems(items: AnyItemRecord[]): FileItemRecord[] {
  return items.filter(
    (item): item is FileItemRecord => isFileItem(item) && isPresentable(item.mimeType)
  )
}
