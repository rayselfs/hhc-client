import type { TFunction } from 'i18next'

const MIME_TO_KIND: Record<string, string> = {
  'image/png': 'fileKind.pngImage',
  'image/jpeg': 'fileKind.jpegImage',
  'image/jpg': 'fileKind.jpegImage',
  'image/gif': 'fileKind.gifImage',
  'image/webp': 'fileKind.webpImage',
  'image/svg+xml': 'fileKind.svgImage',
  'image/bmp': 'fileKind.bmpImage',
  'image/tiff': 'fileKind.tiffImage',
  'image/heic': 'fileKind.heicImage',
  'image/heif': 'fileKind.heifImage',
  'video/mp4': 'fileKind.mp4Video',
  'video/quicktime': 'fileKind.quicktimeVideo',
  'video/webm': 'fileKind.webmVideo',
  'video/x-msvideo': 'fileKind.aviVideo',
  'video/avi': 'fileKind.aviVideo',
  'video/x-matroska': 'fileKind.mkvVideo',
  'video/mpeg': 'fileKind.mpegVideo',
  'video/ogg': 'fileKind.oggVideo',
  'application/pdf': 'fileKind.pdfDocument',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'fileKind.powerpointPresentation',
  'application/vnd.ms-powerpoint': 'fileKind.powerpointPresentation',
  'application/vnd.apple.keynote': 'fileKind.keynotePresentation',
  'application/vnd.oasis.opendocument.presentation': 'fileKind.presentation'
}

const MIME_KIND_FALLBACK: Record<string, string> = {
  'fileKind.pngImage': 'PNG Image',
  'fileKind.jpegImage': 'JPEG Image',
  'fileKind.gifImage': 'GIF Image',
  'fileKind.webpImage': 'WebP Image',
  'fileKind.svgImage': 'SVG Image',
  'fileKind.bmpImage': 'BMP Image',
  'fileKind.tiffImage': 'TIFF Image',
  'fileKind.heicImage': 'HEIC Image',
  'fileKind.heifImage': 'HEIF Image',
  'fileKind.mp4Video': 'MP4 Video',
  'fileKind.quicktimeVideo': 'QuickTime Video',
  'fileKind.webmVideo': 'WebM Video',
  'fileKind.aviVideo': 'AVI Video',
  'fileKind.mkvVideo': 'MKV Video',
  'fileKind.mpegVideo': 'MPEG Video',
  'fileKind.oggVideo': 'OGG Video',
  'fileKind.pdfDocument': 'PDF Document',
  'fileKind.powerpointPresentation': 'PowerPoint Presentation',
  'fileKind.keynotePresentation': 'Keynote Presentation',
  'fileKind.presentation': 'Presentation'
}

export function formatFileKind(
  mimeType: string | undefined,
  isFolder: boolean,
  t?: TFunction<'translation', undefined>
): string {
  if (isFolder) return t?.('fileKind.folder', { defaultValue: 'Folder' }) ?? 'Folder'
  if (!mimeType) return t?.('fileKind.file', { defaultValue: 'File' }) ?? 'File'

  const known = MIME_TO_KIND[mimeType]
  if (known)
    return t?.(known, { defaultValue: MIME_KIND_FALLBACK[known] }) ?? MIME_KIND_FALLBACK[known]

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
