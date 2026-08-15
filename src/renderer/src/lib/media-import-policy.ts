import { isIgnoredSystemPath } from '@shared/file-ignore-policy'
import {
  getFileExtension,
  getMediaSupport,
  MEDIA_CAPABILITIES,
  type MediaCapability,
  type MediaKind,
  type MediaPlatform,
  type MediaSupportMode
} from './media-capabilities'

export type MediaImportDecision =
  | {
      action: 'accept'
      kind: MediaKind
      mimeType: string
      support: MediaSupportMode
    }
  | {
      action: 'platform-unsupported'
      kind: MediaKind
      mimeType: string
      support: 'unsupported'
    }
  | {
      action: 'skip'
      reason: 'system-file' | 'app-unsupported'
      mimeType: string
      extension: string
    }

interface MediaImportInput {
  name: string
  mimeType?: string
  path?: string
}

function normalizeMimeType(mimeType: string | undefined): string {
  return mimeType?.split(';', 1)[0].trim().toLowerCase() ?? ''
}

function findExplicitCapability(input: MediaImportInput): MediaCapability | null {
  const extension = getFileExtension(input.name)
  const mimeType = normalizeMimeType(input.mimeType)

  const byExtension = MEDIA_CAPABILITIES.find((capability) =>
    capability.extensions.includes(extension)
  )
  if (byExtension) return byExtension

  if (!mimeType) return null
  return (
    MEDIA_CAPABILITIES.find((capability) =>
      [capability.canonicalMimeType, ...(capability.aliases ?? [])].some(
        (candidate) => normalizeMimeType(candidate) === mimeType
      )
    ) ?? null
  )
}

function isAppSupportedCapability(capability: MediaCapability): boolean {
  return capability.web !== 'unsupported' || capability.electron !== 'unsupported'
}

export function classifyMediaImport(
  input: MediaImportInput,
  platform: MediaPlatform
): MediaImportDecision {
  const extension = getFileExtension(input.name)
  const mimeType = normalizeMimeType(input.mimeType)

  if (isIgnoredSystemPath(input.path || input.name)) {
    return {
      action: 'skip',
      reason: 'system-file',
      mimeType: mimeType || 'application/octet-stream',
      extension
    }
  }

  const capability = findExplicitCapability(input)
  if (!capability || (!isAppSupportedCapability(capability) && capability.kind !== 'image')) {
    return {
      action: 'skip',
      reason: 'app-unsupported',
      mimeType: mimeType || 'application/octet-stream',
      extension
    }
  }

  const support = getMediaSupport(capability, platform)
  if (support === 'unsupported') {
    return {
      action: 'platform-unsupported',
      kind: capability.kind,
      mimeType: capability.canonicalMimeType,
      support
    }
  }

  return {
    action: 'accept',
    kind: capability.kind,
    mimeType: capability.canonicalMimeType,
    support
  }
}
