import { isMac as checkIsMac } from '@/utils/platform'

export interface ModifierConfig {
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  metaOrCtrl?: boolean
}

export function useSelectionModifiers() {
  const isMac = checkIsMac()

  /**
   * 檢查滑鼠事件是否符合指定的修飾鍵配置
   */
  const matchesModifier = (event: MouseEvent, config: ModifierConfig): boolean => {
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
  const getSelectionMode = (event: MouseEvent): 'single' | 'multi' | 'range' | 'range-add' => {
    const isShift = event.shiftKey
    const isMetaOrCtrl = isMac ? event.metaKey : event.ctrlKey

    if (isShift && isMetaOrCtrl) return 'range-add'
    if (isShift) return 'range'
    if (isMetaOrCtrl) return 'multi'
    return 'single'
  }

  return {
    matchesModifier,
    getSelectionMode,
    isMac,
  }
}
