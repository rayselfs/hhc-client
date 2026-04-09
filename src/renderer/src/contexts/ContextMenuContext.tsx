import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

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

  const close = useCallback(() => setMenu(null), [])

  const showMenu = useCallback((items: ContextMenuEntry[], e: React.MouseEvent): void => {
    e.preventDefault()
    e.stopPropagation()
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

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('scroll', handleScroll, true)
    document.addEventListener('contextmenu', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
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
        <div
          ref={menuRef}
          role="menu"
          className="fixed z-[9999] min-w-[160px] rounded-lg border border-divider bg-content1 py-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.items.map((entry, i) => {
            if (entry === 'separator') {
              return <div key={`sep-${i}`} role="separator" className="my-1 h-px bg-divider" />
            }
            const isDanger = entry.variant === 'danger'
            return (
              <button
                key={entry.id}
                role="menuitem"
                type="button"
                className={[
                  'flex w-full items-center gap-2 px-3 py-1.5 text-sm outline-none',
                  'hover:bg-default-100 active:bg-default-200',
                  isDanger ? 'text-danger hover:bg-danger-50' : 'text-foreground'
                ].join(' ')}
                onClick={() => {
                  entry.onAction()
                  close()
                }}
              >
                {entry.icon && <span className="flex-shrink-0 w-4 h-4">{entry.icon}</span>}
                {entry.label}
              </button>
            )
          })}
        </div>
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
