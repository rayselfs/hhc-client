import React from 'react'
import { LayoutGrid, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

export default function MediaToolbar(): React.JSX.Element {
  const { t } = useTranslation()
  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)
  const currentMimeType = useMediaProjectionStore((s) => s.currentItem()?.mimeType ?? '')
  const pdfViewMode = useMediaProjectionStore((s) => s.typeStates['pdf']?.viewMode ?? 'slide')
  const { toggleGrid, resetZoom, setZoomLevel } = useMediaProjectionStore.getState()

  const zoomDisabled = currentMimeType === 'application/pdf' && pdfViewMode === 'scroll'

  return (
    <div className="flex items-center gap-1 px-4 py-2 shrink-0">
      <Button
        isIconOnly
        variant="ghost"
        onPress={() => toggleGrid()}
        aria-label={t('presenter.grid')}
        className="w-12 h-12 rounded-full"
      >
        <LayoutGrid className="w-6 h-6" />
      </Button>
      <Button
        isIconOnly
        variant={zoomLevel > 1 ? 'tertiary' : 'ghost'}
        isDisabled={zoomDisabled}
        onPress={() => (zoomLevel > 1 ? resetZoom() : setZoomLevel(1.2))}
        aria-label={t('presenter.zoom')}
        className="w-12 h-12 rounded-full"
      >
        {zoomLevel > 1 ? <ZoomOut className="w-6 h-6" /> : <ZoomIn className="w-6 h-6" />}
      </Button>
    </div>
  )
}
