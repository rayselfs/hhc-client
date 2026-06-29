import { useCallback } from 'react'
import PptxSlideSurface from '@renderer/components/Common/PptxSlideSurface'
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

  return (
    <PptxSlideSurface
      source={item}
      slideIndex={slideIndex}
      className="rounded-2xl"
      onReady={handleReady}
    />
  )
}
