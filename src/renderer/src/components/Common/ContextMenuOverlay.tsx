import { createPortal } from 'react-dom'
import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import GlassDivider from '@renderer/components/Common/GlassDivider'
import type { ContextMenuEntry, ContextMenuItem } from '@renderer/contexts/ContextMenuContext'

interface ContextMenuOverlayProps {
  x: number
  y: number
  items: ContextMenuEntry[]
  menuRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
}

export default function ContextMenuOverlay({
  x,
  y,
  items,
  menuRef,
  onClose
}: ContextMenuOverlayProps): React.JSX.Element {
  const menuItems = items.filter((e): e is ContextMenuItem => e !== 'separator')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [adjustedPos, setAdjustedPos] = useState({ x, y })

  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const newX = x + rect.width > window.innerWidth ? x - rect.width : x
    const newY = y + rect.height > window.innerHeight ? y - rect.height : y
    setAdjustedPos({
      x: Math.max(0, newX),
      y: Math.max(0, newY)
    })
  }, [x, y, menuRef])

  useEffect(() => {
    buttonRefs.current[0]?.focus()
  }, [])

  useEffect(() => {
    buttonRefs.current[focusedIndex]?.focus()
  }, [focusedIndex])

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((prev) => (prev + 1) % menuItems.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length)
        break
      case 'Home':
        e.preventDefault()
        setFocusedIndex(0)
        break
      case 'End':
        e.preventDefault()
        setFocusedIndex(menuItems.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        menuItems[focusedIndex]?.onAction()
        onClose()
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'Tab':
        e.preventDefault()
        onClose()
        break
    }
  }

  let menuItemIdx = -1

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      className="fixed z-9999 min-w-[160px] rounded-2xl bg-overlay py-1.5 px-1"
      style={{ left: adjustedPos.x, top: adjustedPos.y, boxShadow: 'var(--shadow-overlay)' }}
      onKeyDown={handleKeyDown}
    >
      {items.map((entry, i) => {
        if (entry === 'separator') {
          const prev = items.slice(0, i).findLast((e): e is ContextMenuItem => e !== 'separator')
          const key = `sep-${prev ? prev.id : 'start'}`
          return <GlassDivider key={key} className="my-1" />
        }
        menuItemIdx++
        const currentIdx = menuItemIdx
        const isDanger = entry.variant === 'danger'
        return (
          <button
            key={entry.id}
            ref={(el) => {
              buttonRefs.current[currentIdx] = el
            }}
            role="menuitem"
            type="button"
            tabIndex={currentIdx === focusedIndex ? 0 : -1}
            className={[
              'flex w-full items-center gap-2 rounded-2xl px-2.5 py-1.5 text-sm outline-none cursor-pointer',
              'hover:bg-accent hover:text-accent-foreground active:scale-[0.98] transition-colors',
              isDanger ? 'text-danger' : 'text-foreground'
            ].join(' ')}
            onClick={() => {
              entry.onAction()
              onClose()
            }}
            onFocus={() => setFocusedIndex(currentIdx)}
          >
            {entry.icon && <span className="shrink-0 w-4 h-4">{entry.icon}</span>}
            {entry.label}
          </button>
        )
      })}
    </div>,
    document.body
  )
}
