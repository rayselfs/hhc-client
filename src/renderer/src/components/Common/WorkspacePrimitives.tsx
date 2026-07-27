import { useState, type ComponentPropsWithoutRef, type CSSProperties, type ReactNode } from 'react'
import { Button } from '@heroui/react/button'
import { List, PanelRight, X } from 'lucide-react'

export function WorkspaceShell({
  children,
  className = '',
  ...props
}: ComponentPropsWithoutRef<'section'>): React.JSX.Element {
  return (
    <section className={`flex h-full min-h-0 flex-col overflow-hidden ${className}`} {...props}>
      {children}
    </section>
  )
}

export function StageViewport({
  children,
  className = '',
  ...props
}: ComponentPropsWithoutRef<'main'>): React.JSX.Element {
  return (
    <main
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </main>
  )
}

export function NavigatorRail({
  children,
  className = '',
  ...props
}: ComponentPropsWithoutRef<'aside'>): React.JSX.Element {
  return (
    <aside
      className={`min-h-0 min-w-0 overflow-hidden ${className}`}
      data-workspace-navigator
      {...props}
    >
      {children}
    </aside>
  )
}

export function InspectorPanel({
  children,
  className = '',
  ...props
}: ComponentPropsWithoutRef<'aside'>): React.JSX.Element {
  return (
    <aside
      className={`min-h-0 min-w-0 overflow-hidden ${className}`}
      data-workspace-inspector
      {...props}
    >
      {children}
    </aside>
  )
}

export function ResponsivePanelGroup({
  navigator,
  stage,
  inspector,
  navigatorWidth = 240,
  inspectorWidth = 300,
  navigatorLabel = 'Navigator',
  inspectorLabel = 'Inspector',
  className = ''
}: {
  navigator: ReactNode
  stage: ReactNode
  inspector?: ReactNode
  navigatorWidth?: number
  inspectorWidth?: number
  navigatorLabel?: string
  inspectorLabel?: string
  className?: string
}): React.JSX.Element {
  const [overlay, setOverlay] = useState<'navigator' | 'inspector' | null>(null)
  const style = {
    '--workspace-navigator-width': `${navigatorWidth}px`,
    '--workspace-inspector-width': `${inspectorWidth}px`
  } as CSSProperties

  return (
    <div
      className={`workspace-panel-group relative min-h-0 flex-1 ${
        inspector ? '' : 'workspace-two-panel'
      } ${className}`}
      style={style}
    >
      <div className="workspace-compact-switcher absolute left-2 top-2 z-30 flex gap-1">
        <Button
          className="workspace-navigator-trigger"
          size="sm"
          variant="tertiary"
          onPress={() => setOverlay((current) => (current === 'navigator' ? null : 'navigator'))}
          aria-expanded={overlay === 'navigator'}
        >
          <List size={14} />
          {navigatorLabel}
        </Button>
        {inspector && (
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => setOverlay((current) => (current === 'inspector' ? null : 'inspector'))}
            aria-expanded={overlay === 'inspector'}
          >
            <PanelRight size={14} />
            {inspectorLabel}
          </Button>
        )}
      </div>
      <div
        className={`workspace-navigator-slot ${overlay === 'navigator' ? 'workspace-overlay-open' : ''}`}
      >
        {navigator}
        {overlay === 'navigator' && (
          <OverlayClose label={`Close ${navigatorLabel}`} onPress={() => setOverlay(null)} />
        )}
      </div>
      <div className="workspace-stage-slot min-h-0 min-w-0">{stage}</div>
      {inspector && (
        <div
          className={`workspace-inspector-slot ${
            overlay === 'inspector' ? 'workspace-overlay-open' : ''
          }`}
        >
          {inspector}
          {overlay === 'inspector' && (
            <OverlayClose label={`Close ${inspectorLabel}`} onPress={() => setOverlay(null)} />
          )}
        </div>
      )}
    </div>
  )
}

function OverlayClose({
  label,
  onPress
}: {
  label: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <Button
      isIconOnly
      size="sm"
      variant="ghost"
      className="workspace-overlay-close absolute right-2 top-2 z-20"
      onPress={onPress}
      aria-label={label}
    >
      <X size={16} />
    </Button>
  )
}

export function ProjectionSessionControl({
  status,
  primaryAction,
  secondaryAction,
  className = ''
}: {
  status: ReactNode
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section
      className={`flex min-w-0 items-center gap-2 ${className}`}
      aria-label="Projection session controls"
    >
      <div className="min-w-0 flex-1">{status}</div>
      {secondaryAction}
      {primaryAction}
    </section>
  )
}
