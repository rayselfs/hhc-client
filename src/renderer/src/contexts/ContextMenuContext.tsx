import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import ContextMenuOverlay from '@renderer/components/Common/ContextMenuOverlay'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  variant?: 'default' | 'danger'
  disabled?: boolean
  onAction: () => void
}

export type ContextMenuSeparator = 'separator'

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator

interface ContextMenuState {
  x: number
  y: number
  items: ContextMenuEntry[]
}

interface ContextMenuContextValue {
  showMenu: (items: ContextMenuEntry[], e: React.MouseEvent) => void
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null)

export function ContextMenuProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<Element | null>(null)

  const close = useCallback(() => {
    setMenu(null)
    if (triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus({ preventScroll: true })
    }
    triggerRef.current = null
  }, [])

  const showMenu = useCallback(
    (items: ContextMenuEntry[], e: React.MouseEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      const hasActionableItem = items.some((item) => item !== 'separator')
      if (!hasActionableItem) {
        close()
        return
      }
      triggerRef.current = document.activeElement
      const anchorToTrigger = e.type === 'click' && e.clientX === 0 && e.clientY === 0
      const triggerRect = anchorToTrigger ? e.currentTarget.getBoundingClientRect() : null
      setMenu({
        x: triggerRect?.left ?? e.clientX,
        y: triggerRect?.bottom ?? e.clientY,
        items
      })
    },
    [close]
  )

  useEffect(() => {
    if (!menu) return

    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if (e.type === 'mousedown' && e.button === 2) return
        close()
        if (
          e.type === 'contextmenu' &&
          !(
            e.target instanceof Element &&
            e.target.closest('input, textarea, [contenteditable="true"]')
          )
        ) {
          e.preventDefault()
          e.stopImmediatePropagation()
        }
      }
    }

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }

    const handleScroll = (): void => close()
    const handleResize = (): void => close()
    const handleBlur = (): void => close()

    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('keydown', handleEscape, true)
    document.addEventListener('scroll', handleScroll, true)
    document.addEventListener('contextmenu', handleClickOutside, true)
    window.addEventListener('resize', handleResize)
    window.addEventListener('blur', handleBlur)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('keydown', handleEscape, true)
      document.removeEventListener('scroll', handleScroll, true)
      document.removeEventListener('contextmenu', handleClickOutside, true)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('blur', handleBlur)
    }
  }, [menu, close])

  useEffect(() => {
    const suppress = (e: Event): void => {
      if (
        e.target instanceof Element &&
        e.target.closest('input, textarea, [contenteditable="true"]')
      )
        return
      e.preventDefault()
    }
    document.addEventListener('contextmenu', suppress)
    return () => document.removeEventListener('contextmenu', suppress)
  }, [])

  return (
    <ContextMenuContext.Provider value={{ showMenu }}>
      {children}
      {menu && (
        <ContextMenuOverlay
          x={menu.x}
          y={menu.y}
          items={menu.items}
          menuRef={menuRef}
          onClose={close}
        />
      )}
    </ContextMenuContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useContextMenu(): ContextMenuContextValue {
  const ctx = useContext(ContextMenuContext)
  if (!ctx) {
    throw new Error('useContextMenu must be used within a ContextMenuProvider')
  }
  return ctx
}
