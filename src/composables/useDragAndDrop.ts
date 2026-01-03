import type { VerseItem, Folder, FolderItem, FileItem } from '@/types/common'
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

    // Create custom drag image
    const dragImage = createDragImage(type, itemsToDrag)
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
    type: 'verse' | 'folder' | 'file',
    items: (T | Folder<T>)[],
  ): HTMLElement | null => {
    if (items.length === 0) return null
    const mainItem = items[0]

    const dragImage = document.createElement('div')
    Object.assign(dragImage.style, {
      position: 'absolute',
      top: '-1000px',
      left: '-1000px',
      pointerEvents: 'none',
      zIndex: '9999',
      backgroundColor: 'rgba(var(--v-theme-surface), 0.9)',
      borderRadius: '8px',
      padding: '8px 12px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      fontSize: '14px',
      fontWeight: '500',
      width: '240px',
      height: '50px',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
    })

    // Stack effect for multiple items
    if (items.length > 1) {
      dragImage.style.boxShadow =
        '4px 4px 0 rgba(var(--v-theme-surface), 0.5), 0 4px 12px rgba(0, 0, 0, 0.15)'
    }

    const truncateName = (name: string) => {
      // Create a temporary span to checking width is tricky in this context without mounting
      // Fallback to character count for simplicity but ensure it fits
      if (name.length <= 20) return name
      return name.substring(0, 20) + '...'
    }

    let iconHtml = ''
    let textHtml = ''

    if (type === 'verse') {
      const verse = mainItem as unknown as VerseItem
      iconHtml = `<i class="mdi mdi-book-open-page-variant" style="color: rgb(var(--v-theme-primary)); font-size: 20px; margin-right: 8px;"></i>`
      textHtml = `${verse.bookAbbreviation}${verse.chapter}:${verse.verse}`
    } else if (type === 'file') {
      const file = mainItem as unknown as FileItem
      let icon = 'mdi-file'
      const fileType = file.metadata?.fileType
      // Map file types to icons
      if (fileType === 'video') icon = 'mdi-video'
      else if (fileType === 'image') icon = 'mdi-image'
      else if (fileType === 'pdf') icon = 'mdi-file-pdf-box'
      else if (fileType === 'audio') icon = 'mdi-volume-high'
      // Youtube is usually handled as a file with specific metadata or distinct type, if stored as file check mime or metadata
      // If we don't have explicit youtube type in metadata yet, fallback to generic or video

      iconHtml = `<i class="mdi ${icon}" style="color: red; font-size: 20px; margin-right: 8px;"></i>`
      textHtml = truncateName(file.name)
    } else {
      const folder = mainItem as Folder<T>
      iconHtml = `<i class="mdi mdi-folder" style="color: rgb(var(--v-theme-primary)); font-size: 20px; margin-right: 8px;"></i>`
      textHtml = truncateName(folder.name)
    }

    const contentHtml = `
      <div style="display: flex; align-items: center; width: 100%;">
        ${iconHtml}
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${textHtml}</span>
      </div>
    `
    // Add badge for multiple items
    let badgeHtml = ''
    if (items.length > 1) {
      badgeHtml = `
            <div style="position: absolute; top: -8px; right: -8px; background-color: rgb(var(--v-theme-primary)); color: white; border-radius: 50%; min-width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; padding: 0 4px; border: 2px solid rgb(var(--v-theme-surface));">
                ${items.length}
            </div>
        `
    }

    dragImage.innerHTML = contentHtml + badgeHtml
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
