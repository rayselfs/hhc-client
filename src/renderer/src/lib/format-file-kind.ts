const MIME_TO_KIND: Record<string, string> = {
  'image/png': 'PNG Image',
  'image/jpeg': 'JPEG Image',
  'image/jpg': 'JPEG Image',
  'image/gif': 'GIF Image',
  'image/webp': 'WebP Image',
  'image/svg+xml': 'SVG Image',
  'image/bmp': 'BMP Image',
  'image/tiff': 'TIFF Image',
  'image/heic': 'HEIC Image',
  'image/heif': 'HEIF Image',
  'video/mp4': 'MPEG-4 Video',
  'video/quicktime': 'QuickTime Video',
  'video/webm': 'WebM Video',
  'video/x-msvideo': 'AVI Video',
  'video/avi': 'AVI Video',
  'video/x-matroska': 'MKV Video',
  'video/mpeg': 'MPEG Video',
  'video/ogg': 'OGG Video',
  'application/pdf': 'PDF Document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'PowerPoint Presentation',
  'application/vnd.ms-powerpoint': 'PowerPoint Presentation',
  'application/vnd.apple.keynote': 'Keynote Presentation',
  'application/vnd.oasis.opendocument.presentation': 'Presentation'
}

export function formatFileKind(mimeType: string | undefined, isFolder: boolean): string {
  if (isFolder) return 'Folder'
  if (!mimeType) return 'File'

  const known = MIME_TO_KIND[mimeType]
  if (known) return known

  const [type, subtype] = mimeType.split('/')
  if (type === 'image') {
    const ext = (subtype ?? '').toUpperCase()
    return ext ? `${ext} Image` : 'Image'
  }
  if (type === 'video') {
    const ext = (subtype ?? '').toUpperCase()
    return ext ? `${ext} Video` : 'Video'
  }
  if (type === 'audio') {
    const ext = (subtype ?? '').toUpperCase()
    return ext ? `${ext} Audio` : 'Audio'
  }

  const first = type.charAt(0).toUpperCase() + type.slice(1)
  return first || 'File'
}
