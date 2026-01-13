import type { Folder, FolderItem } from '@/types/common'
import { useSentry } from './useSentry'
import { ref } from 'vue'
import type { DragData } from '@/utils/typeGuards'
import { isValidDragData } from '@/utils/typeGuards'

interface UseDragAndDropOptions {
  itemSelector?: string
}

/**
 * Drag and Drop Composable
 * Provides unified drag and drop handling logic
 */
export const useDragAndDrop = <T extends FolderItem>(options: UseDragAndDropOptions = {}) => {
  const { reportError } = useSentry()
  const itemSelector = options.itemSelector || '.verse-item'

  const draggedItems = ref<Set<string>>(new Set())

  /**
   * Handle drag start
   */
  const handleDragStart = (
    event: DragEvent,
    type: 'verse' | 'folder' | 'file',
    item: T | Folder<T>,
    selectedItems?: Set<string>,
    getAllSelectedItems?: () => (T | Folder<T>)[],
  ) => {
    if (!event.dataTransfer) return

    // Determine items to drag
    let itemsToDrag: (T | Folder<T>)[] = [item]

    // If we have a selection and the clicked item is part of it, drag all selected items
    if (selectedItems && selectedItems.has(item.id) && getAllSelectedItems) {
      itemsToDrag = getAllSelectedItems()
    }

    // Set dragged state
    draggedItems.value = new Set(itemsToDrag.map((i) => i.id))

    // Set drag data
    const data: DragData = { type, items: itemsToDrag }
    event.dataTransfer.setData('application/json', JSON.stringify(data))
    event.dataTransfer.effectAllowed = 'move'

    // We rely on native browser drag image (ghost of the element)
    // to give the feel of "moving the item".
  }

  /**
   * Handle drag over
   */
  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move'
    }
  }

  /**
   * Handle drag enter
   */
  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault()
    const container = (event.target as HTMLElement).closest(itemSelector)
    if (container) {
      const targetId = container.getAttribute('data-id')
      // Disable drop if dragging selection over itself
      if (targetId && draggedItems.value.has(targetId)) {
        event.dataTransfer!.dropEffect = 'none'
        return
      }
      container.classList.add('drag-over')
    }
  }

  /**
   * Handle drag leave
   */
  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault()
    const container = (event.target as HTMLElement).closest(itemSelector)
    if (container) {
      const rect = container.getBoundingClientRect()
      const x = event.clientX
      const y = event.clientY

      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        container.classList.remove('drag-over')
      }
    }
  }

  /**
   * Handle drag end
   */
  const handleDragEnd = () => {
    draggedItems.value.clear()
  }

  /**
   * Handle drop
   */
  const handleDrop = (
    event: DragEvent,
    onDrop: (data: DragData<T>, target: HTMLElement, event: DragEvent) => void,
  ) => {
    event.preventDefault()

    // Remove drag highlight effect
    const container = (event.target as HTMLElement).closest(itemSelector)
    if (container) {
      container.classList.remove('drag-over')
    }

    try {
      const dataString = event.dataTransfer?.getData('application/json')
      if (!dataString) return

      const parsed = JSON.parse(dataString)
      // Basic validation
      if (!parsed || !parsed.type || !parsed.items) {
        // fallback for old format compatibility if needed, but we controlled start
        if (isValidDragData<T>(parsed)) {
          // converted old single item to array logic if compatible, but better to stick to new structure
        } else {
          return
        }
      }

      const data = parsed as DragData<T>

      // Prevent dropping on itself
      if (container) {
        const targetId = container.getAttribute('data-id')
        if (targetId && data.items.some((i: T | Folder<T>) => i.id === targetId)) {
          return
        }
      }

      if (container) {
        onDrop(data, container as HTMLElement, event)
      }
    } catch (error) {
      reportError(error, {
        operation: 'drag-handling',
        component: 'useDragAndDrop',
      })
    } finally {
      handleDragEnd()
    }
  }

  return {
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    draggedItems,
  }
}
