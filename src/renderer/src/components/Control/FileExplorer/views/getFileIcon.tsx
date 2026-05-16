import { Image, Video, FileText, File, Folder } from 'lucide-react'
import React from 'react'

export function getFileIcon(
  mimeType: string | undefined,
  isFolder?: boolean,
  size: number = 32
): React.JSX.Element {
  if (isFolder) {
    return <Folder size={size} />
  }

  if (!mimeType) {
    return <File size={size} />
  }

  if (mimeType.startsWith('image/')) {
    return <Image size={size} />
  }

  if (mimeType.startsWith('video/')) {
    return <Video size={size} />
  }

  if (mimeType === 'application/pdf' || mimeType.startsWith('application/vnd.')) {
    return <FileText size={size} />
  }

  return <File size={size} />
}
