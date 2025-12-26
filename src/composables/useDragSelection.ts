import { ref, computed } from 'vue'
import type { Ref } from 'vue'

interface DragSelectionOptions {
  containerRef: Ref<HTMLElement | null>
  selectedIds: Ref<Set<string>>
}

export const useDragSelection = (options: DragSelectionOptions) => {
  const { containerRef, selectedIds } = options
  const initialSelection = ref<Set<string>>(new Set())

  const isDragging = ref(false)
  const startX = ref(0)
  const startY = ref(0)
  const currentX = ref(0)
  const currentY = ref(0)

  const selectionBox = computed(() => {
    if (!isDragging.value) return null

    const left = Math.min(startX.value, currentX.value)
    const top = Math.min(startY.value, currentY.value)
    const width = Math.abs(currentX.value - startX.value)
    const height = Math.abs(currentY.value - startY.value)

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    }
  })

  const onMouseDown = (event: MouseEvent) => {
    // Only left click
    if (event.button !== 0) return

    // Verify target is container or empty space
    const target = event.target as HTMLElement
    // Allow clicking on selection box itself (pointer-events: none usually handles this, but just in case)
    if (
      target.closest('[data-id]') ||
      target.closest('.v-btn') ||
      target.closest('.v-list-item') ||
      target.closest('.v-menu')
    ) {
      return
    }

    isDragging.value = true
    startX.value = event.clientX
    startY.value = event.clientY
    currentX.value = event.clientX
    currentY.value = event.clientY

    // Capture initial selection for additive logic
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      initialSelection.value = new Set(selectedIds.value)
    } else {
      initialSelection.value = new Set()
      selectedIds.value = new Set()
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    document.body.style.userSelect = 'none'
  }

  const onMouseMove = (event: MouseEvent) => {
    if (!isDragging.value) return

    currentX.value = event.clientX
    currentY.value = event.clientY

    updateSelection(event.shiftKey || event.ctrlKey || event.metaKey)
  }

  const onMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.userSelect = ''
  }

  const updateSelection = (isAdditive: boolean) => {
    const boxLeft = Math.min(startX.value, currentX.value)
    const boxTop = Math.min(startY.value, currentY.value)
    const boxRight = Math.max(startX.value, currentX.value)
    const boxBottom = Math.max(startY.value, currentY.value)

    const newSelected = new Set<string>()

    // Start with initial selection if additive
    if (isAdditive) {
      initialSelection.value.forEach((id) => newSelected.add(id))
    }

    if (!containerRef.value) return

    const itemElements = containerRef.value.querySelectorAll('[data-id]')

    itemElements.forEach((el) => {
      const rect = el.getBoundingClientRect()
      const elementId = el.getAttribute('data-id')
      if (!elementId) return

      // Intersection Check
      const isIntersecting =
        rect.left < boxRight && rect.right > boxLeft && rect.top < boxBottom && rect.bottom > boxTop

      if (isIntersecting) {
        newSelected.add(elementId)
      }
    })

    selectedIds.value = newSelected
  }

  return {
    selectionBox,
    onMouseDown,
    isDragging,
  }
}
