import type { VerseItem, Folder } from '@/types/common'
import { useSentry } from './useSentry'
import type { DragData } from '@/utils/typeGuards'
import { isValidDragData } from '@/utils/typeGuards'

/**
 * Drag and Drop Composable
 * Provides unified drag and drop handling logic
 */
export const useDragAndDrop = <T extends VerseItem>() => {
  const { reportError } = useSentry()

  /**
   * Handle drag start
   */
  const handleDragStart = (
    event: DragEvent,
    type: 'verse' | 'folder',
    item: VerseItem | Folder<T>,
  ) => {
    if (!event.dataTransfer) return

    // Set drag data
    const data: DragData = { type, item }
    event.dataTransfer.setData('application/json', JSON.stringify(data))
    event.dataTransfer.effectAllowed = 'move'

    // Create custom drag image
    const dragImage = createDragImage(type, item)
    if (dragImage) {
      document.body.appendChild(dragImage)
      event.dataTransfer.setDragImage(dragImage, 10, 10)

      // Delay removing drag image
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage)
        }
      }, 0)
    }
  }

  /**
   * Create visual effect during drag
   */
  const createDragImage = (
    type: 'verse' | 'folder',
    item: VerseItem | Folder<T>,
  ): HTMLElement | null => {
    const dragImage = document.createElement('div')
    dragImage.style.position = 'absolute'
    dragImage.style.top = '-1000px'
    dragImage.style.left = '-1000px'
    dragImage.style.pointerEvents = 'none'
    dragImage.style.zIndex = '9999'
    dragImage.style.backgroundColor = 'rgba(var(--v-theme-surface), 0.9)'
    dragImage.style.borderRadius = '4px'
    dragImage.style.padding = '8px 12px'
    dragImage.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
    dragImage.style.fontSize = '14px'
    dragImage.style.fontWeight = '500'

    if (type === 'verse') {
      const verse = item as VerseItem
      dragImage.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="background-color: rgb(var(--v-theme-primary)); color: white; padding: 2px 6px; border-radius: 12px; font-size: 12px; font-weight: 500;">
            ${verse.bookAbbreviation}${verse.chapter}:${verse.verse}
          </span>
        </div>
      `
    } else {
      const folder = item as Folder<T>
      dragImage.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <i class="mdi mdi-folder" style="color: rgb(var(--v-theme-primary)); font-size: 16px;"></i>
          <span>${folder.name}</span>
        </div>
      `
    }

    return dragImage
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
    const container = (event.target as HTMLElement).closest('.verse-item')
    if (container) {
      container.classList.add('drag-over')
    }
  }

  /**
   * Handle drag leave
   */
  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault()
    const container = (event.target as HTMLElement).closest('.verse-item')
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
   * Handle drop
   */
  const handleDrop = (
    event: DragEvent,
    onDrop: (data: DragData<T>, target: HTMLElement) => void,
  ) => {
    event.preventDefault()

    // Remove drag highlight effect
    const container = (event.target as HTMLElement).closest('.verse-item')
    if (container) {
      container.classList.remove('drag-over')
    }

    try {
      const dataString = event.dataTransfer?.getData('application/json')
      if (!dataString) return

      const parsed = JSON.parse(dataString)
      if (!isValidDragData<T>(parsed)) {
        console.warn('Invalid drag data:', parsed)
        return
      }

      const data = parsed as DragData<T>
      if (container) {
        onDrop(data, container as HTMLElement)
      }
    } catch (error) {
      reportError(error, {
        operation: 'drag-handling',
        component: 'useDragAndDrop',
      })
    }
  }

  return {
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
  }
}
