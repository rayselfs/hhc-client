import React from 'react'
import { useTranslation } from 'react-i18next'
import type { FileItemRecord } from '@shared/types/folder'
import { getMediaType } from '@renderer/lib/presentability'

interface NextItemPreviewProps {
  item: FileItemRecord
  previewCache?: Record<string, string>
}

export default function NextItemPreview({
  item,
  previewCache
}: NextItemPreviewProps): React.JSX.Element | null {
  const { t } = useTranslation()
  const mediaType = getMediaType(item.mimeType)
  const thumbnailUrl = previewCache?.[item.id]

  if (!mediaType) return null

  if (!thumbnailUrl) {
    return (
      <span className="absolute inset-0 flex items-center justify-center text-white/30 text-xs">
        {t('presenter.loading')}
      </span>
    )
  }

  return (
    <img
      src={thumbnailUrl}
      alt={item.name}
      className="absolute inset-0 w-full h-full object-contain"
    />
  )
}
