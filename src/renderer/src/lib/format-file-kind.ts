import type { TFunction } from 'i18next'
import { resolveMediaCapability } from './media-capabilities'

export function formatFileKind(
  mimeType: string | undefined,
  isFolder: boolean,
  t?: TFunction<'translation', undefined>
): string {
  if (isFolder) return t?.('fileKind.folder', { defaultValue: 'Folder' }) ?? 'Folder'
  if (!mimeType) return t?.('fileKind.file', { defaultValue: 'File' }) ?? 'File'

  const capability = resolveMediaCapability({ mimeType })
  if (capability?.kindLabelKey && capability.kindLabelFallback) {
    return (
      t?.(capability.kindLabelKey, { defaultValue: capability.kindLabelFallback }) ??
      capability.kindLabelFallback
    )
  }

  const [type, subtype] = mimeType.split('/')
  if (type === 'image') {
    const ext = (subtype ?? '').toUpperCase()
    const fallback = ext ? `${ext} Image` : 'Image'
    return t?.('fileKind.imageFile', { ext, defaultValue: fallback }) ?? fallback
  }
  if (type === 'video') {
    const ext = (subtype ?? '').toUpperCase()
    const fallback = ext ? `${ext} Video` : 'Video'
    return t?.('fileKind.videoFile', { ext, defaultValue: fallback }) ?? fallback
  }
  if (type === 'audio') {
    const ext = (subtype ?? '').toUpperCase()
    const fallback = ext ? `${ext} Audio` : 'Audio'
    return t?.('fileKind.audioFile', { ext, defaultValue: fallback }) ?? fallback
  }

  const first = type.charAt(0).toUpperCase() + type.slice(1)
  return first || 'File'
}
