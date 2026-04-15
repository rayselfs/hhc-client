import { useEffect, useRef } from 'react'
import { isMac } from '@renderer/lib/env'

export interface ShortcutConfig {
  code: string
  shift?: boolean
  ctrl?: boolean
  meta?: boolean
  alt?: boolean
  metaOrCtrl?: boolean
  mac?: Partial<ShortcutConfig>
  windows?: Partial<ShortcutConfig>
}

export interface ShortcutHandler {
  config: ShortcutConfig
  handler: (event: KeyboardEvent) => void
  preventDefault?: boolean
  stopPropagation?: boolean
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean
}

export function getPlatformShortcut(config: ShortcutConfig): ShortcutConfig {
  const mac = isMac()
  if (mac && config.mac) {
    return { ...config, ...config.mac }
  }
  if (!mac && config.windows) {
    return { ...config, ...config.windows }
  }
  return config
}

export function matchesConfig(event: KeyboardEvent, config: ShortcutConfig): boolean {
  const resolved = getPlatformShortcut(config)

  if (resolved.ctrl !== undefined && event.ctrlKey !== resolved.ctrl) return false
  if (resolved.meta !== undefined && event.metaKey !== resolved.meta) return false
  if (resolved.shift !== undefined && event.shiftKey !== resolved.shift) return false
  if (resolved.alt !== undefined && event.altKey !== resolved.alt) return false

  if (resolved.metaOrCtrl) {
    if (!event.metaKey && !event.ctrlKey) return false
  }

  if (event.code !== resolved.code) return false

  return true
}

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false
  if (INPUT_TAGS.has(target.tagName)) return true
  if (target.getAttribute('contenteditable') === 'true') return true
  const role = target.getAttribute('role')
  if (role === 'textbox' || role === 'searchbox') return true
  return false
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutHandler[],
  options: UseKeyboardShortcutsOptions = {}
): void {
  const { enabled = true } = options

  const shortcutsRef = useRef<ShortcutHandler[]>(shortcuts)
  const enabledRef = useRef<boolean>(enabled)

  useEffect(() => {
    shortcutsRef.current = shortcuts
    enabledRef.current = enabled
  })

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent): void => {
      if (!enabledRef.current) return
      if (isEditableTarget(event.target)) return

      for (const {
        config,
        handler,
        preventDefault = true,
        stopPropagation = true
      } of shortcutsRef.current) {
        if (matchesConfig(event, config)) {
          if (preventDefault) event.preventDefault()
          if (stopPropagation) event.stopPropagation()
          handler(event)
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeydown, true)
    return () => {
      document.removeEventListener('keydown', handleKeydown, true)
    }
  }, [])
}
