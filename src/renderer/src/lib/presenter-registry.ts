import type React from 'react'
import type { FileItemRecord } from '@shared/types/folder'
import type { MediaType, MediaTypeStateMap } from './presentability'
import ImagePreview from '../components/Control/FileExplorer/Presenter/Preview/ImagePreview'
import VideoPreview from '../components/Control/FileExplorer/Presenter/Preview/VideoPreview'
import PdfPreview from '../components/Control/FileExplorer/Presenter/Preview/PdfPreview'

export interface PreviewComponentProps {
  item: FileItemRecord
}

export interface MediaTypeDescriptor<K extends MediaType = MediaType> {
  type: K
  matches: (mimeType: string) => boolean
  supportsZoomPan: boolean
  clickToAdvance: boolean
  PreviewComponent: React.ComponentType<PreviewComponentProps>
  initialTypeState: MediaTypeStateMap[K]
}

const PRESENTABLE_VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'])

const DESCRIPTORS: MediaTypeDescriptor[] = [
  {
    type: 'image',
    matches: (m) => m.startsWith('image/'),
    supportsZoomPan: true,
    clickToAdvance: true,
    PreviewComponent: ImagePreview,
    initialTypeState: {}
  },
  {
    type: 'video',
    matches: (m) => PRESENTABLE_VIDEO_MIMES.has(m),
    supportsZoomPan: false,
    clickToAdvance: false,
    PreviewComponent: VideoPreview,
    initialTypeState: {}
  },
  {
    type: 'pdf',
    matches: (m) => m === 'application/pdf',
    supportsZoomPan: true,
    clickToAdvance: false,
    PreviewComponent: PdfPreview,
    initialTypeState: { viewMode: 'slide' as const }
  }
]

export function getDescriptor(mimeType: string): MediaTypeDescriptor | null {
  return DESCRIPTORS.find((d) => d.matches(mimeType)) ?? null
}

export function getDescriptorByType<K extends MediaType>(type: K): MediaTypeDescriptor<K> | null {
  const found = DESCRIPTORS.find((d) => d.type === type)
  return (found as MediaTypeDescriptor<K> | undefined) ?? null
}
