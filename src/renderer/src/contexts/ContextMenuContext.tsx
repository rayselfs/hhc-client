import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import ContextMenuOverlay from '@renderer/components/Common/ContextMenuOverlay'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: React.ReactNode
  variant?: 'default' | 'danger'
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
      triggerRef.current.focus()
    }
    triggerRef.current = null
  }, [])

  const showMenu = useCallback((items: ContextMenuEntry[], e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    triggerRef.current = document.activeElement
    setMenu({ x: e.clientX, y: e.clientY, items })
  }, [])

  useEffect(() => {
    if (!menu) return

    const handleClickOutside = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close()
      }
    }

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }

    const handleScroll = (): void => close()

    document.addEventListener('mousedown', handleClickOutside, true)
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('scroll', handleScroll, true)
    document.addEventListener('contextmenu', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('scroll', handleScroll, true)
      document.removeEventListener('contextmenu', handleClickOutside)
    }
  }, [menu, close])

  useEffect(() => {
    const suppress = (e: Event): void => e.preventDefault()
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
