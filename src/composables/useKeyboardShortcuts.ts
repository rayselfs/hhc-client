import { onMounted, onBeforeUnmount } from 'vue'
import { useMemoryManager } from '@/utils/memoryManager'

import { isMac as checkIsMac } from '@/utils/platform'

export interface ShortcutConfig {
  key?: string
  code?: string
  keys?: string[] | readonly string[] // For multiple alternative keys like Delete/Backspace
  codes?: string[] | readonly string[] // For multiple alternative codes like ArrowRight/KeyN
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  metaOrCtrl?: boolean // Helper for cross-platform Ctrl/Cmd
  mac?: ShortcutConfig // Specific override for Mac
  windows?: ShortcutConfig // Specific override for Windows
}

export interface ShortcutHandler {
  config: ShortcutConfig
  handler: (event: KeyboardEvent) => void
  preventDefault?: boolean // Default true
}

export function useKeyboardShortcuts(shortcuts: ShortcutHandler[]) {
  // Generate unique ID for this instance to prevent collisions in MemoryManager
  const listenerId = `keydown-listener-${crypto.randomUUID()}`
  const { track, untrack } = useMemoryManager('useKeyboardShortcuts')

  // Check if Mac system
  const isMac = checkIsMac()

  const matchesConfig = (event: KeyboardEvent, config: ShortcutConfig): boolean => {
    // Guard against undefined config
    if (!config) return false

    // recursively check platform specific overrides
    if (isMac && config.mac) return matchesConfig(event, config.mac)
    if (!isMac && config.windows) return matchesConfig(event, config.windows)

    // Check modifiers
    if (config.ctrl !== undefined && event.ctrlKey !== config.ctrl) return false
    if (config.meta !== undefined && event.metaKey !== config.meta) return false
    if (config.shift !== undefined && event.shiftKey !== config.shift) return false
    if (config.alt !== undefined && event.altKey !== config.alt) return false

    if (config.metaOrCtrl) {
      if (!(event.metaKey || event.ctrlKey)) return false
    }

    // Check key code or key value
    if (config.code && event.code !== config.code) return false

    // Check multiple codes if provided
    if (config.codes) {
      if (!config.codes.includes(event.code)) return false
    }

    if (config.key && event.key.toLowerCase() !== config.key.toLowerCase()) return false

    // Check multiple keys if provided (OR logic)
    if (config.keys) {
      const keyMatch = config.keys.some((k) => k.toLowerCase() === event.key.toLowerCase())
      if (!keyMatch) return false
    }

    return true
  }

  const handleKeydown = (event: KeyboardEvent) => {
    // We are now in Capture Phase.
    // We can intercept events before they reach the target (e.g. focused button).

    // Avoid triggering shortcuts in input fields active typing
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return
    }

    for (const { config, handler, preventDefault = true } of shortcuts) {
      if (matchesConfig(event, config)) {
        if (preventDefault) event.preventDefault()

        // Stop propagation to prevent focused elements (like buttons) from handling this key
        event.stopPropagation()

        handler(event)
        return // Execute only the first matching shortcut per event
      }
    }
  }

  // Lifecycle management
  onMounted(() => {
    track(listenerId, 'listener', {
      element: document,
      event: 'keydown',
      handler: handleKeydown,
      options: true, // Use Capture
    })
    document.addEventListener('keydown', handleKeydown, true)
  })

  onBeforeUnmount(() => {
    untrack(listenerId)
    document.removeEventListener('keydown', handleKeydown, true)
    // Do not call cleanup() because it wipes ALL listeners sharing the 'useKeyboardShortcuts' component name
    // relying on individual untrack is safer.
  })
}
