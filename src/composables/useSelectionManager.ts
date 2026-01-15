import { ref } from 'vue'
import { isMac as checkIsMac } from '@/utils/platform'

export interface ModifierConfig {
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  metaOrCtrl?: boolean
}

export function useSelectionManager() {
  const isMac = checkIsMac()
  const focusedId = ref<string | null>(null)

  /**
   * 檢查滑鼠事件是否符合指定的修飾鍵配置
   */
  const matchesModifier = (event: MouseEvent | KeyboardEvent, config: ModifierConfig): boolean => {
    if (config.ctrl !== undefined && event.ctrlKey !== config.ctrl) return false
    if (config.meta !== undefined && event.metaKey !== config.meta) return false
    if (config.shift !== undefined && event.shiftKey !== config.shift) return false
    if (config.alt !== undefined && event.altKey !== config.alt) return false

    if (config.metaOrCtrl) {
      // Mac 用 Cmd, Windows/Linux 用 Ctrl
      const hasModifier = isMac ? event.metaKey : event.ctrlKey
      if (!hasModifier) return false
    }

    return true
  }

  /**
   * 判斷選取模式
   */
  const getSelectionMode = (
    event: MouseEvent | KeyboardEvent,
  ): 'single' | 'multi' | 'range' | 'range-add' => {
    const isShift = event.shiftKey
    const isMetaOrCtrl = isMac ? event.metaKey : event.ctrlKey

    if (isShift && isMetaOrCtrl) return 'range-add'
    if (isShift) return 'range'
    if (isMetaOrCtrl) return 'multi'
    return 'single'
  }

  /**
   * 處理鍵盤導航
   * @param event 鍵盤事件
   * @param items 當前列表項目 (有序)
   * @param colsPerRow 每行顯示幾個項目 (用於上下移動)
   * @returns 新的 focusedId，如果沒有變動則回傳 null
   */
  const handleKeyNavigation = (
    event: KeyboardEvent,
    items: { id: string }[],
    colsPerRow: number,
  ): string | null => {
    if (!items.length) return null

    // 如果當前沒有 focus，預設 focus 第一個
    const currentIndex = focusedId.value ? items.findIndex((i) => i.id === focusedId.value) : -1
    if (currentIndex === -1 && items.length > 0) {
      // 任何導航鍵都會觸發選中第一個
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.code)) {
        const firstItem = items[0]
        if (firstItem) {
          focusedId.value = firstItem.id
          return firstItem.id
        }
      }
      return null
    }

    let nextIndex = currentIndex

    switch (event.code) {
      case 'ArrowRight':
        nextIndex = Math.min(currentIndex + 1, items.length - 1)
        break
      case 'ArrowLeft':
        nextIndex = Math.max(currentIndex - 1, 0)
        break
      case 'ArrowDown': {
        const targetIndex = currentIndex + colsPerRow
        if (targetIndex < items.length) {
          nextIndex = targetIndex
        } else {
          // No wrap, stay put if no item below
          return null
        }
        break
      }
      case 'ArrowUp': {
        const targetIndex = currentIndex - colsPerRow
        if (targetIndex >= 0) {
          nextIndex = targetIndex
        } else {
          // No wrap
          return null
        }
        break
      }
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = items.length - 1
        break
      default:
        return null
    }

    if (nextIndex !== currentIndex) {
      const nextItem = items[nextIndex]
      if (nextItem) {
        event.preventDefault()
        focusedId.value = nextItem.id
        return nextItem.id
      }
    }

    return null
  }

  /**
   * 滾動到焦點項目
   */
  const scrollIntoView = (containerRef: HTMLElement | null) => {
    if (!containerRef || !focusedId.value) return

    // 嘗試找到具有 data-id=focusedId 的元素
    const element = containerRef.querySelector(`[data-id="${focusedId.value}"]`) as HTMLElement
    if (element) {
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }

  // State
  const selectedItems = ref(new Set<string>())
  const lastSelectedId = ref<string | null>(null)

  /**
   * 核心選取更新邏輯
   */
  const updateSelection = (
    items: { id: string }[],
    targetId: string,
    mode: 'single' | 'multi' | 'range' | 'range-add',
  ) => {
    const newSelection = new Set(selectedItems.value)

    switch (mode) {
      case 'range':
      case 'range-add':
        if (lastSelectedId.value) {
          const allIds = items.map((i) => i.id)
          const start = allIds.indexOf(lastSelectedId.value)
          const end = allIds.indexOf(targetId)

          if (start !== -1 && end !== -1) {
            const [lower, upper] = [Math.min(start, end), Math.max(start, end)]
            const rangeIds = allIds.slice(lower, upper + 1)

            if (mode === 'range') {
              newSelection.clear()
            }
            rangeIds.forEach((rid) => newSelection.add(rid))
          }
        }
        break

      case 'multi':
        if (newSelection.has(targetId)) {
          newSelection.delete(targetId)
        } else {
          newSelection.add(targetId)
          lastSelectedId.value = targetId
        }
        break

      case 'single':
      default:
        if (newSelection.size === 1 && newSelection.has(targetId)) {
          return // Already selected singly
        }
        newSelection.clear()
        newSelection.add(targetId)
        lastSelectedId.value = targetId
        break
    }

    selectedItems.value = newSelection
  }

  /**
   * 處理項目點擊
   */
  const handleItemClick = (id: string, items: { id: string }[], event: MouseEvent) => {
    // Update focus on click
    focusedId.value = id

    const mode = getSelectionMode(event)
    updateSelection(items, id, mode)
  }

  /**
   * 全選
   */
  const selectAll = (allIds: string[]) => {
    selectedItems.value = new Set(allIds)
  }

  /**
   * 清除選取
   */
  const clearSelection = () => {
    selectedItems.value = new Set()
  }

  return {
    matchesModifier,
    getSelectionMode,
    handleKeyNavigation,
    scrollIntoView,
    focusedId,
    selectedItems, // Exposed
    lastSelectedId, // Exposed
    handleItemClick, // Exposed
    updateSelection, // Exposed
    selectAll, // Exposed
    clearSelection, // Exposed
    isMac,
  }
}
