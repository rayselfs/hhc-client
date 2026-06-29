import { Image, Video, FileText, File, Folder, Presentation } from 'lucide-react'
import React from 'react'
import { resolveMediaCapability } from '@renderer/lib/media-capabilities'

export function getFileIcon(
  mimeType: string | undefined,
  isFolder?: boolean,
  size: number = 32
): React.JSX.Element {
  if (isFolder) {
    return <Folder size={size} />
  }

  const capability = resolveMediaCapability({ mimeType })
  if (capability?.kind === 'image') return <Image size={size} />
  if (capability?.kind === 'video') return <Video size={size} />
  if (capability?.kind === 'presentation') return <Presentation size={size} />
  if (capability?.kind === 'pdf' || capability?.kind === 'document') {
    return <FileText size={size} />
  }
  return <File size={size} />
}
