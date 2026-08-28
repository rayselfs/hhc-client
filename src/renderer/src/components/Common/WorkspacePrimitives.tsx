import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject
} from 'react'
import { Button } from '@heroui/react/button'
import { List, PanelRight, X } from 'lucide-react'

type WorkspaceOverlay = 'navigator' | 'inspector' | null

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
  overlay: controlledOverlay,
  onOverlayChange,
  inspectorReturnFocusRef,
  navigatorWidth = 240,
  inspectorWidth = 300,
  navigatorLabel = 'Navigator',
  inspectorLabel = 'Inspector',
  className = ''
}: {
  navigator: ReactNode
  stage: ReactNode
  inspector?: ReactNode
  overlay?: WorkspaceOverlay
  onOverlayChange?: (overlay: WorkspaceOverlay) => void
  inspectorReturnFocusRef?: RefObject<HTMLElement | null>
  navigatorWidth?: number
  inspectorWidth?: number
  navigatorLabel?: string
  inspectorLabel?: string
  className?: string
}): React.JSX.Element {
  const [uncontrolledOverlay, setUncontrolledOverlay] = useState<WorkspaceOverlay>(null)
  const navigatorTriggerRef = useRef<HTMLButtonElement>(null)
  const inspectorTriggerRef = useRef<HTMLButtonElement>(null)
  const navigatorSlotRef = useRef<HTMLDivElement>(null)
  const inspectorSlotRef = useRef<HTMLDivElement>(null)
  const previousCompactOverlayRef = useRef<WorkspaceOverlay>(null)
  const compactNavigator = useMediaQuery('(max-width: 1023px)')
  const compactInspector = useMediaQuery('(max-width: 1279px)')
  const overlay = controlledOverlay === undefined ? uncontrolledOverlay : controlledOverlay
  const compactOverlay =
    (overlay === 'navigator' && compactNavigator) || (overlay === 'inspector' && compactInspector)
      ? overlay
      : null
  const setOverlay = (nextOverlay: WorkspaceOverlay): void => {
    if (controlledOverlay === undefined) setUncontrolledOverlay(nextOverlay)
    onOverlayChange?.(nextOverlay)
  }
  const closeNavigator = (): void => {
    setOverlay(null)
    queueMicrotask(() => navigatorTriggerRef.current?.focus())
  }
  const closeInspector = (): void => {
    setOverlay(null)
    queueMicrotask(() => (inspectorReturnFocusRef?.current ?? inspectorTriggerRef.current)?.focus())
  }
  const style = {
    '--workspace-navigator-width': `${navigatorWidth}px`,
    '--workspace-inspector-width': `${inspectorWidth}px`
  } as CSSProperties
  const closeCompactOverlay = (): void => {
    if (compactOverlay === 'navigator') closeNavigator()
    else if (compactOverlay === 'inspector') closeInspector()
  }
  const trapCompactOverlayFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeCompactOverlay()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = getFocusableElements(event.currentTarget)
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  useLayoutEffect(() => {
    const previousCompactOverlay = previousCompactOverlayRef.current
    const previousSlot =
      previousCompactOverlay === 'navigator'
        ? navigatorSlotRef.current
        : previousCompactOverlay === 'inspector'
          ? inspectorSlotRef.current
          : null
    const previousClose =
      previousSlot?.querySelector<HTMLElement>('.workspace-overlay-close') ?? null
    if (
      previousCompactOverlay !== null &&
      compactOverlay === null &&
      overlay === previousCompactOverlay &&
      document.activeElement === previousClose
    ) {
      const paneControl = previousSlot
        ? getFocusableElements(previousSlot).find(
            (element) => !element.classList.contains('workspace-overlay-close')
          )
        : undefined
      const returnTarget =
        previousCompactOverlay === 'inspector'
          ? (inspectorReturnFocusRef?.current ?? inspectorTriggerRef.current)
          : navigatorTriggerRef.current
      ;(paneControl ?? returnTarget)?.focus()
    }

    const slot =
      compactOverlay === 'navigator'
        ? navigatorSlotRef.current
        : compactOverlay === 'inspector'
          ? inspectorSlotRef.current
          : null
    slot?.querySelector<HTMLElement>('.workspace-overlay-close')?.focus()
    previousCompactOverlayRef.current = compactOverlay
  }, [compactOverlay, inspectorReturnFocusRef, overlay])

  return (
    <div
      className={`workspace-panel-group relative min-h-0 flex-1 ${
        inspector ? '' : 'workspace-two-panel'
      } ${className}`}
      style={style}
    >
      <div className="workspace-compact-switcher z-30 flex gap-1">
        <Button
          ref={navigatorTriggerRef}
          className="workspace-navigator-trigger"
          size="sm"
          variant="tertiary"
          onPress={() => (overlay === 'navigator' ? closeNavigator() : setOverlay('navigator'))}
          aria-expanded={overlay === 'navigator'}
        >
          <List size={14} />
          {navigatorLabel}
        </Button>
        {inspector && (
          <Button
            ref={inspectorTriggerRef}
            size="sm"
            variant="tertiary"
            onPress={() => (overlay === 'inspector' ? closeInspector() : setOverlay('inspector'))}
            aria-expanded={overlay === 'inspector'}
          >
            <PanelRight size={14} />
            {inspectorLabel}
          </Button>
        )}
      </div>
      <div
        ref={navigatorSlotRef}
        className={`workspace-navigator-slot ${overlay === 'navigator' ? 'workspace-overlay-open' : ''}`}
        role={compactOverlay === 'navigator' ? 'dialog' : undefined}
        aria-modal={compactOverlay === 'navigator' ? true : undefined}
        aria-label={compactOverlay === 'navigator' ? navigatorLabel : undefined}
        aria-hidden={compactOverlay !== null && compactOverlay !== 'navigator' ? true : undefined}
        inert={compactOverlay !== null && compactOverlay !== 'navigator'}
        onKeyDown={compactOverlay === 'navigator' ? trapCompactOverlayFocus : undefined}
      >
        {navigator}
        {overlay === 'navigator' && (
          <OverlayClose label={`Close ${navigatorLabel}`} onPress={closeNavigator} />
        )}
      </div>
      <div
        className="workspace-stage-slot flex min-h-0 min-w-0"
        aria-hidden={compactOverlay !== null ? true : undefined}
        inert={compactOverlay !== null}
      >
        {stage}
      </div>
      {inspector && (
        <div
          ref={inspectorSlotRef}
          className={`workspace-inspector-slot ${
            overlay === 'inspector' ? 'workspace-overlay-open' : ''
          }`}
          role={compactOverlay === 'inspector' ? 'dialog' : undefined}
          aria-modal={compactOverlay === 'inspector' ? true : undefined}
          aria-label={compactOverlay === 'inspector' ? inspectorLabel : undefined}
          aria-hidden={compactOverlay !== null && compactOverlay !== 'inspector' ? true : undefined}
          inert={compactOverlay !== null && compactOverlay !== 'inspector'}
          onKeyDown={compactOverlay === 'inspector' ? trapCompactOverlayFocus : undefined}
        >
          {inspector}
          {overlay === 'inspector' && (
            <OverlayClose label={`Close ${inspectorLabel}`} onPress={closeInspector} />
          )}
        </div>
      )}
    </div>
  )
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = (event: MediaQueryListEvent): void => setMatches(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])
  return matches
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => {
    const style = window.getComputedStyle(element)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
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
