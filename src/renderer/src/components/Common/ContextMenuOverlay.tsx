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
  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[9999] min-w-[160px] rounded-2xl bg-overlay py-1.5"
      style={{ left: x, top: y, boxShadow: 'var(--shadow-overlay)' }}
    >
      {items.map((entry, i) => {
        if (entry === 'separator') {
          const prev = items.slice(0, i).findLast((e): e is ContextMenuItem => e !== 'separator')
          const key = `sep-${prev ? prev.id : 'start'}`
          return <GlassDivider key={key} className="my-1" />
        }
        const isDanger = entry.variant === 'danger'
        return (
          <button
            key={entry.id}
            role="menuitem"
            type="button"
            className={[
              'flex w-full items-center gap-2 rounded-2xl px-2.5 py-1.5 text-sm outline-none cursor-pointer',
              'hover:bg-default active:scale-[0.98] transition-colors',
              isDanger ? 'text-danger' : 'text-foreground'
            ].join(' ')}
            onClick={() => {
              entry.onAction()
              onClose()
            }}
          >
            {entry.icon && <span className="flex-shrink-0 w-4 h-4">{entry.icon}</span>}
            {entry.label}
          </button>
        )
      })}
    </div>
  )
}
