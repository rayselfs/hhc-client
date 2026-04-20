import { useEffect, useRef } from 'react'
import { isMac } from '@renderer/lib/env'
import { registerShortcut, unregisterShortcut } from '@renderer/lib/shortcut-registry'
import { useOptionalShortcutScope } from '@renderer/contexts/ShortcutScopeContext'

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
  id?: string
  description?: string
}

export interface UseKeyboardShortcutsOptions {
  enabled?: boolean
  sectionKey?: string
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
  const { enabled = true, sectionKey } = options

  const { isOverlayActive } = useOptionalShortcutScope()

  const shortcutsRef = useRef<ShortcutHandler[]>(shortcuts)
  const enabledRef = useRef<boolean>(enabled)
  const isOverlayActiveRef = useRef<boolean>(false)
  const shortcutIdsRef = useRef<string[]>([])

  const sectionKeyRef = useRef(sectionKey)

  useEffect(() => {
    shortcutsRef.current = shortcuts
    enabledRef.current = enabled
    isOverlayActiveRef.current = isOverlayActive
    sectionKeyRef.current = sectionKey
  })

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const currentShortcuts = shortcutsRef.current
    const currentSectionKey = sectionKeyRef.current
    shortcutIdsRef.current = currentShortcuts.map(
      (shortcut, index) => shortcut.id || `shortcut-${index}`
    )

    currentShortcuts.forEach((shortcut, index) => {
      const id = shortcutIdsRef.current[index]
      registerShortcut({
        id,
        config: shortcut.config,
        description: shortcut.description,
        sectionKey: currentSectionKey
      })
    })

    const handleKeydown = (event: KeyboardEvent): void => {
      if (event.isComposing || event.keyCode === 229) return
      if (!enabledRef.current) return
      if (isEditableTarget(event.target)) return

      if (event.code === 'Escape' && document.querySelector('[role="menu"]')) {
        return
      }

      for (const {
        config,
        handler,
        preventDefault = true,
        stopPropagation = true
      } of shortcutsRef.current) {
        if (isOverlayActiveRef.current && config.code !== 'Escape') continue
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
      shortcutIdsRef.current.forEach((id) => {
        unregisterShortcut(id)
      })
    }
  }, [])
}
