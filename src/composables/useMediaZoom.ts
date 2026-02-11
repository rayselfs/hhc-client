import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import { useMediaProjectionStore } from '@/stores/mediaProjection'
import { useProjectionManager } from '@/composables/useProjectionManager'
import { MessageType } from '@/types/projection'
import type { FileItem } from '@/types/folder'

interface UseMediaZoomOptions {
  previewContainer: Ref<HTMLElement | null>
  currentItem: Ref<FileItem | undefined | null> | ComputedRef<FileItem | undefined | null>
}

export function useMediaZoom({ previewContainer, currentItem }: UseMediaZoomOptions) {
  const store = useMediaProjectionStore()
  const { sendProjectionMessage } = useProjectionManager()

  const showZoomControls = ref(false)
  const isDragging = ref(false)

  // Zoom state from store
  const zoomLevel = computed(() => store.zoomLevel)
  const pan = computed(() => store.pan)

  // Zoom controls
  const toggleZoom = (minus = false) => {
    if (showZoomControls.value) {
      showZoomControls.value = false
      store.setZoom(1)
      store.setPan(0, 0)
    } else {
      showZoomControls.value = true
      store.setZoom(minus ? 0.8 : 1.2)
      store.setPan(0, 0)
    }
  }

  const resetZoom = () => store.setPan(0, 0)
  const zoomIn = () => store.setZoom(Math.min(5, zoomLevel.value + 0.1))
  const zoomOut = () => store.setZoom(Math.max(0.1, zoomLevel.value - 0.1))

  // Cursor style
  const cursorStyle = computed(() => {
    if (!showZoomControls.value) return 'default'
    return isDragging.value ? 'grabbing' : 'grab'
  })

  // Pan drag logic
  const startPanDrag = (e: MouseEvent) => {
    if (!previewContainer.value || !showZoomControls.value) return
    e.preventDefault()
    isDragging.value = true
    const startX = e.clientX,
      startY = e.clientY
    const initialPan = { ...pan.value }
    const rect = previewContainer.value.getBoundingClientRect()

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX,
        deltaY = moveEvent.clientY - startY
      const isPdf = currentItem.value?.metadata.fileType === 'pdf'
      const factor = isPdf ? 1 : -1
      store.setPan(
        initialPan.x + (deltaX / rect.width) * factor,
        initialPan.y + (deltaY / rect.height) * factor,
      )
    }

    const handleMouseUp = () => {
      isDragging.value = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  // Sync zoom/pan with projection
  watch(zoomLevel, (val) =>
    sendProjectionMessage(MessageType.MEDIA_CONTROL, { type: 'image', action: 'zoom', value: val }),
  )
  watch(pan, (val) =>
    sendProjectionMessage(MessageType.MEDIA_CONTROL, {
      type: 'image',
      action: 'pan',
      value: { x: val.x, y: val.y },
    }),
  )

  return {
    showZoomControls,
    isDragging,
    zoomLevel,
    pan,
    cursorStyle,
    toggleZoom,
    resetZoom,
    zoomIn,
    zoomOut,
    startPanDrag,
  }
}
