import type { AnyItemRecord, FileItemRecord } from '@shared/types/folder'
import { isFileItem } from '@shared/types/folder'
import {
  getMediaSupport,
  resolveMediaCapability,
  type MediaPlatform,
  type MediaSupportMode
} from './media-capabilities'
import { isElectron } from './env'

export type MediaTypeStateMap = {
  image: Record<string, never>
  video: {
    hasStarted?: boolean
    isPlaying?: boolean
    isEnded?: boolean
    currentTime?: number
    duration?: number
  }
  pdf: { viewMode: 'slide' | 'scroll'; thumbsCollapsed?: boolean }
  presentation: { slideIndex: number; slideCount?: number }
}

export type MediaType = keyof MediaTypeStateMap

function getPresentabilityPlatform(): MediaPlatform {
  return isElectron() ? 'electron' : 'web'
}

function canPresentSupport(support: MediaSupportMode): boolean {
  return support === 'native' || support === 'desktop-engine'
}

function projectionMediaType(kind: string): MediaType | null {
  if (kind === 'audio') return 'video'
  if (kind === 'image' || kind === 'video' || kind === 'pdf' || kind === 'presentation') return kind
  return null
}

export function isPresentable(mimeType: string, platform = getPresentabilityPlatform()): boolean {
  const capability = resolveMediaCapability({ mimeType })
  return (
    capability !== null &&
    projectionMediaType(capability.kind) !== null &&
    canPresentSupport(getMediaSupport(capability, platform))
  )
}

export function getMediaType(
  mimeType: string,
  platform = getPresentabilityPlatform()
): MediaType | null {
  const capability = resolveMediaCapability({ mimeType })
  if (
    !capability ||
    !projectionMediaType(capability.kind) ||
    !canPresentSupport(getMediaSupport(capability, platform))
  ) {
    return null
  }
  return projectionMediaType(capability.kind)
}

export function getPresentableItems(
  items: AnyItemRecord[],
  platform = getPresentabilityPlatform()
): FileItemRecord[] {
  return items.filter(
    (item): item is FileItemRecord =>
      isFileItem(item) &&
      !item.url.startsWith('unsupported:') &&
      isPresentable(item.mimeType, platform)
  )
}
