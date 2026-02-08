import { ref, onMounted, onUnmounted, type Ref } from 'vue'

/**
 * Composable for managing context menu state and behavior
 * Handles opening/closing menu, positioning, and click-outside detection
 *
 * @example
 * ```vue
 * <template>
 *   <div @contextmenu="handleRightClick">
 *     <v-menu v-model="show" :location="[x, y]">
 *       <!-- menu content -->
 *     </v-menu>
 *   </div>
 * </template>
 *
 * <script setup>
 * const { show, x, y, open, close } = useContextMenu()
 *
 * const handleRightClick = (event) => {
 *   open(event)
 * }
 * </script>
 * ```
 *
 * @returns Context menu state and methods
 * - `show`: Whether the menu is visible
 * - `x`: X coordinate for menu position
 * - `y`: Y coordinate for menu position
 * - `open`: Open the menu at event coordinates
 * - `close`: Close the menu
 */
export function useContextMenu(): {
  show: Ref<boolean>
  x: Ref<number>
  y: Ref<number>
  open: (event: MouseEvent) => void
  close: () => void
} {
  const show = ref(false)
  const x = ref(0)
  const y = ref(0)

  /**
   * Open context menu at specified coordinates
   * @param event - Mouse event containing clientX and clientY
   */
  const open = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    x.value = event.clientX
    y.value = event.clientY
    show.value = true
  }

  /**
   * Close context menu
   */
  const close = () => {
    show.value = false
  }

  const handleGlobalEvents = (event: Event) => {
    if (!show.value) return

    if (event instanceof KeyboardEvent) {
      if (event.key === 'Escape') {
        close()
        return
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const items = Array.from(document.querySelectorAll('[role="menuitem"]')) as HTMLElement[]
        if (items.length === 0) return

        const currentIndex = items.indexOf(document.activeElement as HTMLElement)
        let nextIndex = 0

        if (event.key === 'ArrowDown') {
          nextIndex = (currentIndex + 1) % items.length
        } else {
          nextIndex = (currentIndex - 1 + items.length) % items.length
        }

        items[nextIndex]?.focus()
      }
    }

    if (
      event instanceof MouseEvent ||
      (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent)
    ) {
      const target = event.target as Element

      const isClickOnMenu =
        target.closest('.v-menu') ||
        target.closest('.v-list') ||
        target.closest('.v-list-item') ||
        target.closest('[role="menu"]')

      if (!isClickOnMenu) {
        close()
      }
    }
  }

  onMounted(() => {
    document.addEventListener('click', handleGlobalEvents, true)
    document.addEventListener('contextmenu', handleGlobalEvents, true)
    document.addEventListener('keydown', handleGlobalEvents, true)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleGlobalEvents, true)
    document.removeEventListener('contextmenu', handleGlobalEvents, true)
    document.removeEventListener('keydown', handleGlobalEvents, true)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleGlobalEvents, true)
    document.removeEventListener('contextmenu', handleGlobalEvents, true)
    document.removeEventListener('keydown', handleGlobalEvents, true)
  })

  return {
    show,
    x,
    y,
    open,
    close,
  }
}
