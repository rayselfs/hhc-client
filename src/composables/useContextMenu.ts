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

  /**
   * Handle click outside menu to close it
   * @param event - Click event
   */
  const handleClickOutside = (event: Event) => {
    // Only handle outside click when menu is shown
    if (!show.value) return

    const target = event.target as Element

    // Check if click target is inside context menu
    const isClickOnMenu =
      target.closest('.v-menu') ||
      target.closest('.v-list') ||
      target.closest('.v-list-item') ||
      target.closest('[role="menu"]')

    // If click is outside menu, close it
    if (!isClickOnMenu) {
      close()
    }
  }

  // Listen for global click events
  // Note: Each component instance registers its own listener, but this won't conflict
  // because each instance has independent show state, closing only when show.value is true
  onMounted(() => {
    document.addEventListener('click', handleClickOutside, true)
    document.addEventListener('contextmenu', handleClickOutside, true)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside, true)
    document.removeEventListener('contextmenu', handleClickOutside, true)
  })

  return {
    show,
    x,
    y,
    open,
    close,
  }
}
