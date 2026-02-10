import { ref } from 'vue'
import type { VerseItem, Folder } from '@/types/common'

export function useBibleContextMenu() {
  const showItemContextMenu = ref(false)
  const showBackgroundContextMenu = ref(false)
  const menuPosition = ref<[number, number] | undefined>(undefined)

  const selectedItem = ref<{
    type: 'verse' | 'folder' | 'history'
    item: VerseItem | Folder<VerseItem>
  } | null>(null)

  const handleRightClick = (
    event: MouseEvent,
    type: 'verse' | 'folder' | 'history',
    item: VerseItem | Folder<VerseItem>,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    selectedItem.value = { type, item }
    menuPosition.value = [event.clientX, event.clientY]
    showBackgroundContextMenu.value = false
    showItemContextMenu.value = true
  }

  const handleCardTextRightClick = (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('.verse-item')) {
      return
    }

    event.preventDefault()
    selectedItem.value = null
    menuPosition.value = [event.clientX, event.clientY]
    showItemContextMenu.value = false
    showBackgroundContextMenu.value = true
  }

  const closeItemContextMenu = () => {
    showItemContextMenu.value = false
    showBackgroundContextMenu.value = false
    selectedItem.value = null
  }

  return {
    showItemContextMenu,
    showBackgroundContextMenu,
    menuPosition,
    selectedItem,
    handleRightClick,
    handleCardTextRightClick,
    closeItemContextMenu,
  }
}
