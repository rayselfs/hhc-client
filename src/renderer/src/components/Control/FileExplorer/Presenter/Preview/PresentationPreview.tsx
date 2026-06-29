import { useCallback, useEffect, useState } from 'react'
import { Spinner } from '@heroui/react/spinner'
import EditableSlideSurface from '@renderer/components/Common/EditableSlideSurface'
import PptxSlideSurface from '@renderer/components/Common/PptxSlideSurface'
import {
  loadEditablePresentation,
  type EditablePresentationDocument
} from '@renderer/lib/editable-presentation'
import { isEditablePresentationMimeType } from '@renderer/lib/presentation-media'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import type { PreviewComponentProps } from '@renderer/lib/presenter-registry'

export default function PresentationPreview({ item }: PreviewComponentProps): React.JSX.Element {
  const presentationState = useMediaProjectionStore((s) => s.typeStates.presentation)
  const slideIndex = presentationState?.slideIndex ?? 0

  const handleReady = useCallback((info: { slideCount: number }) => {
    const state = useMediaProjectionStore.getState()
    const current = state.typeStates.presentation ?? { slideIndex: 0 }
    state.setTypeState('presentation', {
      slideIndex: Math.min(current.slideIndex, Math.max(0, info.slideCount - 1)),
      slideCount: info.slideCount
    })
  }, [])

  if (isEditablePresentationMimeType(item.mimeType)) {
    return <EditablePresentationPreview item={item} slideIndex={slideIndex} onReady={handleReady} />
  }

  return (
    <PptxSlideSurface
      source={item}
      slideIndex={slideIndex}
      className="rounded-2xl"
      onReady={handleReady}
    />
  )
}

function EditablePresentationPreview({
  item,
  slideIndex,
  onReady
}: PreviewComponentProps & {
  slideIndex: number
  onReady: (info: { slideCount: number }) => void
}): React.JSX.Element {
  const [document, setDocument] = useState<EditablePresentationDocument | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadEditablePresentation(item).then((loadedDocument) => {
      if (cancelled) return
      setDocument(loadedDocument)
      onReady({ slideCount: loadedDocument.slideOrder.length })
    })
    return () => {
      cancelled = true
    }
  }, [item, onReady])

  const slideId =
    document?.slideOrder[Math.min(slideIndex, Math.max(0, document.slideOrder.length - 1))]
  if (!document || !slideId) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-2xl bg-black">
        <Spinner />
      </div>
    )
  }

  return <EditableSlideSurface document={document} slideId={slideId} className="rounded-2xl" />
}
