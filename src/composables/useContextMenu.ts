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
    // 只在選單顯示時處理點擊外部事件
    if (!show.value) return

    const target = event.target as Element

    // 檢查點擊的目標是否在右鍵選單內
    const isClickOnMenu =
      target.closest('.v-menu') ||
      target.closest('.v-list') ||
      target.closest('.v-list-item') ||
      target.closest('[role="menu"]')

    // 如果點擊在選單外，關閉選單
    if (!isClickOnMenu) {
      close()
    }
  }

  // 監聽全局點擊事件
  // 注意：每個組件實例都會註冊自己的事件監聽器，但這不會造成衝突
  // 因為每個實例都有獨立的 show 狀態，只有當 show.value 為 true 時才會關閉
  onMounted(() => {
    document.addEventListener('click', handleClickOutside, true)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside, true)
  })

  return {
    show,
    x,
    y,
    open,
    close,
  }
}
