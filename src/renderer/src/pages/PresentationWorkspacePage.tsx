import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceAround,
  Baseline,
  Bold,
  ChevronDown,
  Crop,
  Eraser,
  FileText,
  ImagePlus,
  Italic,
  Minus,
  Palette,
  Plus,
  RectangleHorizontal,
  RefreshCw,
  StickyNote,
  Type,
  Underline,
  ZoomIn,
  ZoomOut,
  WrapText,
  X
} from 'lucide-react'
import { AlertDialog } from '@heroui/react/alert-dialog'
import { Button } from '@heroui/react/button'
import { Spinner } from '@heroui/react/spinner'
import { toast } from '@heroui/react/toast'
import EditableSlideSurface from '@renderer/components/Common/EditableSlideSurface'
import {
  InspectorPanel,
  NavigatorRail,
  StageViewport,
  WorkspaceShell
} from '@renderer/components/Common/WorkspacePrimitives'
import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import {
  addElementToSlide,
  applySlideBackgroundToAllSlides,
  createImageElement,
  createLineElement,
  createShapeElement,
  createTextElement,
  convertPptxToEditablePresentation,
  DEFAULT_GRADIENT_BACKGROUND,
  duplicateEditableSlides,
  getSlideBackgroundPrimaryColor,
  INSERTED_TEXT_CLICK_SIZE,
  INSERTED_TEXT_DRAG_MIN_SIZE,
  INSERTED_TEXT_FONT_SIZE,
  insertBlankEditableSlide,
  normalizeSlideBackground,
  presentationCanvasPxToPoints,
  presentationPointsToCanvasPx,
  removeElementFromSlide,
  removeEditableSlides,
  reorderElementInSlide,
  resetSlideBackground,
  updateElementInSlide,
  updateSlideBackground,
  updateSlideNotes,
  type EditableGradientDirection,
  type EditableImageElement,
  type EditablePresentationDocument,
  type EditablePresentationElement,
  type EditableSlideBackground,
  type EditableTextInsertFrame
} from '@renderer/lib/editable-presentation'
import {
  alignElements,
  distributeElements,
  nudgeElements,
  reorderSelectedSlides,
  selectElementsInBounds,
  snapElementPosition,
  type ElementAlignment,
  type ElementDistribution
} from '@renderer/lib/presentation-editor-commands'
import { openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import {
  mergeFontFamilies,
  queryLocalFontFamilies,
  supportsLocalFontAccess
} from '@renderer/lib/local-fonts'
import { usePresentationSessionRegistry } from '@renderer/contexts/PresentationSessionRegistryContext'
import type { PresentationEditorSession } from '@renderer/lib/presentation-editor-session'
import { ensurePresentationPageDocument } from '@renderer/lib/presentation-page-document'
import { readPresentationArrayBuffer } from '@renderer/lib/presentation-source'
import { openPptxViewer, type PptxViewerHandle } from '@renderer/lib/pptx-renderer-service'
import { getPresentationWorkspacePath, isPresentationItem } from '@renderer/lib/presentation-media'
import {
  usePresentationWorkspaceStore,
  type PresentationWorkspaceDocument
} from '@renderer/stores/presentation-workspace'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { isFileItem, type FileItemRecord } from '@shared/types/folder'
import type { SlideHandle } from '@aiden0z/pptx-renderer'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'failed'
type RibbonTab = 'home' | 'insert' | 'design' | 'picture' | 'text'
type PresentationElementType = EditablePresentationElement['type']

const FONT_FAMILIES = ['Inter Variable', 'Noto Sans TC Variable', 'Noto Sans SC Variable', 'Arial']
const FONT_SIZES = [12, 14, 16, 18, 24, 32, 44, 56, 72, 96]
const LINE_SPACING_VALUES = [1, 1.15, 1.5, 2]
const BASE_RIBBON_TABS: RibbonTab[] = ['home', 'insert', 'design']
const NATIVE_CONTROL_CLASS =
  'presentation-native-control rounded-lg border border-divider bg-content2 px-3 text-sm text-foreground outline-none'
const RANGE_CLASS = 'presentation-range w-full'
const RIBBON_ICON_BUTTON_CLASS =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-transparent px-2 text-default-500 transition-[background-color,border-color,color,box-shadow,transform] hover:border-divider hover:bg-content2/80 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-transparent disabled:hover:bg-transparent'
const RIBBON_ICON_BUTTON_ACTIVE_CLASS =
  'border-primary bg-primary text-white shadow-inner hover:border-primary hover:bg-primary/90 hover:text-white'

function RibbonGroup({
  label,
  children,
  className = ''
}: {
  label: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section
      role="group"
      aria-label={label}
      data-testid="presentation-ribbon-group"
      className={`flex h-full shrink-0 flex-col border-r border-divider px-3 pb-1 pt-2 last:border-r-0 ${className}`}
    >
      <div className="min-h-0 flex-1">{children}</div>
      <p className="mt-1 text-center text-[10px] leading-3 text-default-400">{label}</p>
    </section>
  )
}

function getPptxSlideId(index: number): string {
  return `pptx-slide-${index}`
}

function getPptxSlideIndex(slideId: string | null): number {
  if (!slideId?.startsWith('pptx-slide-')) return 0
  const index = Number(slideId.slice('pptx-slide-'.length))
  return Number.isInteger(index) && index >= 0 ? index : 0
}

function SlideThumbnail({
  viewer,
  index,
  active,
  onSelect
}: {
  viewer: PptxViewerHandle
  index: number
  active: boolean
  onSelect: () => void
}): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(() => !('IntersectionObserver' in window))

  useEffect(() => {
    const container = containerRef.current
    if (!container || isVisible) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setIsVisible(true)
        observer.disconnect()
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [isVisible])

  useEffect(() => {
    if (!isVisible || !containerRef.current) return
    const container = containerRef.current
    container.innerHTML = ''
    const handle: SlideHandle | null = viewer.viewer.renderThumbnailToContainer(index, container, {
      width: 144
    })
    return () => {
      handle?.dispose()
      container.innerHTML = ''
    }
  }, [index, isVisible, viewer])

  return (
    <button
      className="flex w-full gap-2 rounded-xl px-1 py-2 text-left text-default-500 transition-colors hover:bg-content2"
      onClick={onSelect}
    >
      <span
        className={
          active
            ? 'w-4 pt-1 text-right text-xs tabular-nums text-foreground'
            : 'w-4 pt-1 text-right text-xs tabular-nums'
        }
      >
        {index + 1}
      </span>
      <span
        ref={containerRef}
        className={`flex h-[81px] w-36 items-center justify-center overflow-hidden border bg-white shadow-sm ${
          active ? 'border-primary ring-2 ring-primary/40' : 'border-transparent'
        }`}
      />
    </button>
  )
}

const EditableSlideThumbnail = React.memo(
  function EditableSlideThumbnail({
    document,
    slideId
  }: {
    document: EditablePresentationDocument
    slideId: string
  }): React.JSX.Element {
    const containerRef = useRef<HTMLDivElement>(null)
    const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === 'undefined')

    useEffect(() => {
      const container = containerRef.current
      if (!container || isVisible) return
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setIsVisible(true)
            observer.disconnect()
          }
        },
        { rootMargin: '160px 0px' }
      )
      observer.observe(container)
      return () => observer.disconnect()
    }, [isVisible])

    return (
      <div ref={containerRef} className="h-full w-full">
        {isVisible && (
          <EditableSlideSurface
            document={document}
            slideId={slideId}
            className="pointer-events-none"
          />
        )}
      </div>
    )
  },
  (previous, next) =>
    previous.slideId === next.slideId &&
    previous.document.width === next.document.width &&
    previous.document.height === next.document.height &&
    previous.document.assets === next.document.assets &&
    previous.document.slides[previous.slideId] === next.document.slides[next.slideId]
)

async function getPresentationSourceItem(itemId: string): Promise<FileItemRecord> {
  const storeItem = useFileExplorerStore.getState().items[itemId]
  if (storeItem && isFileItem(storeItem)) return storeItem

  const db = await openFileExplorerDB()
  const record = await db.get('folder-items', itemId)
  if (record && isFileItem(record)) return record
  throw new Error('Presentation source is unavailable')
}

export function PptxDocumentView({
  deck
}: {
  deck: PresentationWorkspaceDocument
}): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const openDocument = usePresentationWorkspaceStore((state) => state.openDocument)
  const setSlideCount = usePresentationWorkspaceStore((state) => state.setSlideCount)
  const setActiveSlideId = usePresentationWorkspaceStore((state) => state.setActiveSlideId)
  const activeSlideId = usePresentationWorkspaceStore((state) =>
    state.getActiveSlideId(deck.itemId)
  )
  const activeSlide = getPptxSlideIndex(activeSlideId)
  const deckItemId = deck.itemId
  const deckMimeType = deck.mimeType
  const deckUrl = deck.url
  const canvasRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<PptxViewerHandle | null>(null)
  const [viewer, setViewer] = useState<PptxViewerHandle | null>(null)
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const target = canvasRef.current
    if (!target) return
    const container = target
    container.innerHTML = ''
    viewerRef.current?.destroy()
    viewerRef.current = null

    async function open(): Promise<void> {
      await Promise.resolve()
      if (cancelled) return
      setViewer(null)
      setStatus('loading')
      setError(null)
      try {
        const buffer = await readPresentationArrayBuffer({
          id: deckItemId,
          url: deckUrl,
          mimeType: deckMimeType
        })
        if (cancelled) return
        const handle = await openPptxViewer(buffer, container, { renderMode: 'slide' })
        if (cancelled) {
          handle.destroy()
          return
        }
        viewerRef.current = handle
        setViewer(handle)
        setSlideCount(deckItemId, handle.slideCount)
        const storedSlideId = usePresentationWorkspaceStore.getState().getActiveSlideId(deckItemId)
        const safeSlideIndex = Math.min(
          getPptxSlideIndex(storedSlideId),
          Math.max(0, handle.slideCount - 1)
        )
        setActiveSlideId(deckItemId, getPptxSlideId(safeSlideIndex))
        void ensurePresentationPageDocument(
          { id: deckItemId, url: deckUrl },
          handle.slideCount
        ).catch(() => undefined)
        setStatus('ready')
      } catch (loadError) {
        if (cancelled) return
        setStatus('failed')
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      }
    }

    void open()
    return () => {
      cancelled = true
      viewerRef.current?.destroy()
      viewerRef.current = null
    }
  }, [deckItemId, deckMimeType, deckUrl, setActiveSlideId, setSlideCount])

  useEffect(() => {
    const current = viewerRef.current
    if (!current || status !== 'ready') return
    void current.viewer.renderSlide(activeSlide).catch((renderError) => {
      setStatus('failed')
      setError(renderError instanceof Error ? renderError.message : String(renderError))
    })
  }, [activeSlide, status])

  const slideIndexes = useMemo(
    () => Array.from({ length: viewer?.slideCount ?? deck.slideCount ?? 0 }, (_, index) => index),
    [deck.slideCount, viewer?.slideCount]
  )

  const editCopy = async (): Promise<void> => {
    if (isConverting) return
    setIsConverting(true)
    try {
      const item = await getPresentationSourceItem(deck.itemId)
      const createdItem = await convertPptxToEditablePresentation(item)
      openDocument(createdItem)
      navigate(getPresentationWorkspacePath(createdItem.id))
    } catch (conversionError) {
      toast.danger(
        conversionError instanceof Error ? conversionError.message : String(conversionError)
      )
    } finally {
      setIsConverting(false)
    }
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] bg-background">
      <aside className="min-h-0 overflow-y-auto border-r border-divider bg-content1/40 px-2 py-3">
        <div className="space-y-2">
          {viewer &&
            slideIndexes.map((index) => (
              <SlideThumbnail
                key={index}
                viewer={viewer}
                index={index}
                active={index === activeSlide}
                onSelect={() => setActiveSlideId(deck.itemId, getPptxSlideId(index))}
              />
            ))}
        </div>
      </aside>

      <main className="flex min-h-0 flex-col bg-[#111217]">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-divider bg-content1/80 px-4">
          <div>
            <p className="text-sm font-semibold text-foreground">{deck.name}</p>
            <p className="text-xs text-default-400">
              {t('presentationWorkspace.readOnlyPptx', 'Read-only PPTX')}
            </p>
          </div>
          <Button variant="primary" isDisabled={isConverting} onPress={() => void editCopy()}>
            {isConverting
              ? t('presentationWorkspace.editCopyConverting', 'Creating copy...')
              : t('presentationWorkspace.editCopy', 'Edit a copy')}
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto p-8">
          <div className="relative flex min-h-[360px] w-full max-w-5xl items-center justify-center rounded-2xl bg-black/30 p-4 shadow-2xl">
            <div ref={canvasRef} className="w-full" />
            {status === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40">
                <Spinner />
              </div>
            )}
            {status === 'failed' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/70 p-6 text-center">
                <FileText className="mb-3 text-danger" size={36} />
                <p className="text-sm font-semibold text-danger">
                  {t('presentationWorkspace.loadFailed')}
                </p>
                {error && <p className="mt-2 max-w-lg text-xs text-default-400">{error}</p>}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function EditableDocumentView({
  deck,
  activeRibbon,
  isRibbonOpen,
  onSelectedElementTypeChange
}: {
  deck: PresentationWorkspaceDocument
  activeRibbon: RibbonTab
  isRibbonOpen: boolean
  onSelectedElementTypeChange: (type: PresentationElementType | null) => void
}): React.JSX.Element {
  const registry = usePresentationSessionRegistry()
  const session = useSyncExternalStore(
    registry.subscribe,
    () => registry.get(deck.itemId),
    () => registry.get(deck.itemId)
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session) return
    let cancelled = false
    void getPresentationSourceItem(deck.itemId)
      .then((item) => registry.open(item))
      .catch((openError) => {
        if (!cancelled) {
          setError(openError instanceof Error ? openError.message : String(openError))
        }
      })
    return () => {
      cancelled = true
    }
  }, [deck.itemId, registry, session])

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <FileText className="text-danger" size={36} />
        <p className="text-sm font-semibold text-danger">Failed to load presentation</p>
        <p className="max-w-lg text-xs text-default-400">{error}</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <EditableSessionDocumentView
      key={deck.itemId}
      deck={deck}
      session={session}
      activeRibbon={activeRibbon}
      isRibbonOpen={isRibbonOpen}
      onSelectedElementTypeChange={onSelectedElementTypeChange}
    />
  )
}

function EditableSessionDocumentView({
  deck,
  session,
  activeRibbon,
  isRibbonOpen,
  onSelectedElementTypeChange
}: {
  deck: PresentationWorkspaceDocument
  session: PresentationEditorSession
  activeRibbon: RibbonTab
  isRibbonOpen: boolean
  onSelectedElementTypeChange: (type: PresentationElementType | null) => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const { showMenu } = useContextMenu()
  const setSlideCount = usePresentationWorkspaceStore((state) => state.setSlideCount)
  const setActiveSlideId = usePresentationWorkspaceStore((state) => state.setActiveSlideId)
  const storedActiveSlideId = usePresentationWorkspaceStore((state) =>
    state.getActiveSlideId(deck.itemId)
  )
  const sessionSnapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot
  )
  const document = sessionSnapshot.renderedDocument
  const storedActiveSlideIndex = document.slideOrder.indexOf(storedActiveSlideId ?? '')
  const [lastActiveSlideIndex, setLastActiveSlideIndex] = useState(() =>
    Math.max(0, storedActiveSlideIndex)
  )
  const activeSlideIndex =
    storedActiveSlideIndex >= 0
      ? storedActiveSlideIndex
      : Math.min(lastActiveSlideIndex, Math.max(0, document.slideOrder.length - 1))
  const activeSlideId = document.slideOrder[activeSlideIndex] ?? null
  const imageInputRef = useRef<HTMLInputElement>(null)
  const textCommitTimerRef = useRef<number | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(() => new Set())
  const [copiedElement, setCopiedElement] = useState<EditablePresentationElement | null>(null)
  const [copiedSlideIds, setCopiedSlideIds] = useState<string[]>([])
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(() => new Set())
  const [selectionAnchorIndex, setSelectionAnchorIndex] = useState(0)
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)
  const [isBackgroundPanelOpen, setIsBackgroundPanelOpen] = useState(false)
  const [isLineSpacingOptionsOpen, setIsLineSpacingOptionsOpen] = useState(false)
  const [lineSpacingDraft, setLineSpacingDraft] = useState(1.15)
  const [editingElementId, setEditingElementId] = useState<string | null>(null)
  const [isTextInsertMode, setIsTextInsertMode] = useState(false)
  const [pressedRibbonAction, setPressedRibbonAction] = useState<string | null>(null)
  const [localFontFamilies, setLocalFontFamilies] = useState<string[]>([])
  const [isLoadingLocalFonts, setIsLoadingLocalFonts] = useState(false)
  const [draggingSlideIds, setDraggingSlideIds] = useState<string[]>([])
  const [railWidth, setRailWidth] = useState(240)
  const [zoomPercent, setZoomPercent] = useState(100)
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [notesDraftBySlideId, setNotesDraftBySlideId] = useState<Record<string, string>>({})
  const [cropElementId, setCropElementId] = useState<string | null>(null)
  const [isCompactRailOpen, setIsCompactRailOpen] = useState(false)
  const [snapGuides, setSnapGuides] = useState<{
    vertical?: number
    horizontal?: number
  }>({})
  const pressedRibbonTimeoutRef = useRef<number | null>(null)
  const projectionPlaylist = useMediaProjectionStore((state) => state.playlist)
  const projectionIndex = useMediaProjectionStore((state) => state.currentIndex)
  const isPresenting = useMediaProjectionStore((state) => state.isPresenting)
  const projectedPresentationState = useMediaProjectionStore(
    (state) => state.typeStates.presentation
  )

  useEffect(
    () => () => {
      if (pressedRibbonTimeoutRef.current !== null) {
        window.clearTimeout(pressedRibbonTimeoutRef.current)
      }
      if (textCommitTimerRef.current !== null) {
        window.clearTimeout(textCommitTimerRef.current)
      }
    },
    []
  )

  useEffect(() => {
    setSlideCount(deck.itemId, document.slideOrder.length)
    if (activeSlideId !== storedActiveSlideId) {
      setActiveSlideId(deck.itemId, activeSlideId)
    }
  }, [
    activeSlideId,
    activeSlideIndex,
    deck.itemId,
    document.slideOrder.length,
    setActiveSlideId,
    setSlideCount,
    storedActiveSlideId
  ])

  const activateSlide = (slideId: string | null): void => {
    if (slideId) {
      const index = document.slideOrder.indexOf(slideId)
      if (index >= 0) setLastActiveSlideIndex(index)
    }
    setActiveSlideId(deck.itemId, slideId)
  }

  const activeSlide = activeSlideId ? document.slides[activeSlideId] : null
  const selectedElement =
    activeSlide && selectedElementId ? activeSlide.elements[selectedElementId] : null
  const selectedImageElement = selectedElement?.type === 'image' ? selectedElement : null
  const projectedItem = projectionPlaylist[projectionIndex]
  const projectedSlideIndex =
    isPresenting && projectedItem?.id === deck.itemId
      ? (projectedPresentationState?.slideIndex ?? 0)
      : -1

  const notesDraft = activeSlideId
    ? (notesDraftBySlideId[activeSlideId] ?? activeSlide?.notes ?? '')
    : ''

  useEffect(() => {
    onSelectedElementTypeChange(selectedElement?.type ?? null)
  }, [onSelectedElementTypeChange, selectedElement?.type])

  const clearTextCommitTimer = (): void => {
    if (textCommitTimerRef.current === null) return
    window.clearTimeout(textCommitTimerRef.current)
    textCommitTimerRef.current = null
  }

  const commitTextDraft = (): void => {
    clearTextCommitTimer()
    if (session.getSnapshot().draftKind === 'text') session.commitDraft()
  }

  const commitDocument = (nextDocument: EditablePresentationDocument): void => {
    clearTextCommitTimer()
    session.commit(nextDocument)
  }

  const previewTextElement = (
    slideId: string,
    elementId: string,
    updates: Partial<EditablePresentationElement>
  ): void => {
    if (session.getSnapshot().draftKind !== 'text') session.beginDraft('text')
    const preview = session.getSnapshot().renderedDocument
    session.previewDraft(updateElementInSlide(preview, slideId, elementId, updates))
    clearTextCommitTimer()
    textCommitTimerRef.current = window.setTimeout(() => {
      textCommitTimerRef.current = null
      if (session.getSnapshot().draftKind === 'text') session.commitDraft()
    }, 750)
  }

  const updateSelectedElement = (updates: Partial<EditablePresentationElement>): void => {
    if (!document || !activeSlideId || !selectedElementId) return
    commitDocument(updateElementInSlide(document, activeSlideId, selectedElementId, updates))
  }

  const selectElement = (
    elementId: string | null,
    event?: React.MouseEvent | React.PointerEvent
  ): void => {
    if (!elementId) {
      setSelectedElementId(null)
      setSelectedElementIds(new Set())
      setCropElementId(null)
      return
    }
    const additive = Boolean(event?.metaKey || event?.ctrlKey)
    if (!additive) {
      setSelectedElementId(elementId)
      setSelectedElementIds(new Set([elementId]))
    } else {
      setSelectedElementIds((current) => {
        const next = new Set(current)
        if (next.has(elementId)) {
          next.delete(elementId)
        } else {
          next.add(elementId)
        }
        setSelectedElementId(next.has(elementId) ? elementId : (next.values().next().value ?? null))
        return next
      })
    }
    if (elementId !== editingElementId) setEditingElementId(null)
    setIsTextInsertMode(false)
  }

  const addShape = (shape: 'rectangle' | 'ellipse'): void => {
    if (!activeSlideId) return
    const element = createShapeElement(shape)
    commitDocument(addElementToSlide(document, activeSlideId, element))
    setSelectedElementId(element.id)
    setSelectedElementIds(new Set([element.id]))
    setSelectedElementIds(new Set([element.id]))
  }

  const addLine = (): void => {
    if (!activeSlideId) return
    const element = createLineElement()
    commitDocument(addElementToSlide(document, activeSlideId, element))
    setSelectedElementId(element.id)
    setSelectedElementIds(new Set([element.id]))
  }

  const applyElementAlignment = (alignment: ElementAlignment): void => {
    if (!activeSlideId) return
    const ids = [...selectedElementIds]
    if (ids.length < 2) return
    commitDocument(alignElements(document, activeSlideId, ids, alignment))
  }

  const applyElementDistribution = (distribution: ElementDistribution): void => {
    if (!activeSlideId) return
    const ids = [...selectedElementIds]
    if (ids.length < 3) return
    commitDocument(distributeElements(document, activeSlideId, ids, distribution))
  }

  const moveSelectedSlides = (targetIndex: number): void => {
    const ids = draggingSlideIds.length > 0 ? draggingSlideIds : getSelectedSlideIds()
    const nextDocument = reorderSelectedSlides(document, ids, targetIndex)
    if (nextDocument === document) return
    commitDocument(nextDocument)
    setDraggingSlideIds([])
    setInsertionIndex(null)
  }

  const setActiveSlideBackground = (background: EditableSlideBackground): void => {
    if (!document || !activeSlideId) return
    commitDocument(updateSlideBackground(document, activeSlideId, background))
  }

  const applyActiveBackgroundToAllSlides = (): void => {
    if (!document || !activeSlide) return
    commitDocument(applySlideBackgroundToAllSlides(document, activeSlide.background))
  }

  const resetActiveSlideBackground = (): void => {
    if (!document || !activeSlideId) return
    commitDocument(resetSlideBackground(document, activeSlideId))
  }

  const addTextElement = (frame?: EditableTextInsertFrame): void => {
    if (!document || !activeSlideId) return
    const autoSize = frame?.autoSize ?? 'content'
    const nextFrame = frame ?? {
      x: 260,
      y: 220,
      width: INSERTED_TEXT_CLICK_SIZE.width,
      height: INSERTED_TEXT_CLICK_SIZE.height,
      autoSize
    }
    const width =
      autoSize === 'content'
        ? nextFrame.width
        : Math.max(INSERTED_TEXT_DRAG_MIN_SIZE.width, nextFrame.width)
    const height =
      autoSize === 'content'
        ? nextFrame.height
        : Math.max(INSERTED_TEXT_DRAG_MIN_SIZE.height, nextFrame.height)
    const element = createTextElement({
      x: Math.max(0, Math.min(document.width - width, nextFrame.x)),
      y: Math.max(0, Math.min(document.height - height, nextFrame.y)),
      width,
      height,
      autoWidth: autoSize === 'content',
      autoSize,
      fontSize: INSERTED_TEXT_FONT_SIZE,
      text: ''
    })
    commitDocument(addElementToSlide(document, activeSlideId, element))
    setSelectedElementId(element.id)
    setEditingElementId(element.id)
    setIsTextInsertMode(false)
  }

  const addSlide = (): void => {
    if (!document) return
    const result = insertBlankEditableSlide(document, document.slideOrder.length)
    commitDocument(result.document)
    activateSlide(result.slideId)
    setSelectedSlideIds(new Set([result.slideId]))
    setSelectedElementId(null)
    setSelectedElementIds(new Set())
  }

  const addSlideAfter = (index: number): void => {
    if (!document) return
    const result = insertBlankEditableSlide(document, index + 1)
    commitDocument(result.document)
    activateSlide(result.slideId)
    setSelectedSlideIds(new Set([result.slideId]))
    setSelectionAnchorIndex(index + 1)
    setSelectedElementId(null)
    setSelectedElementIds(new Set())
    setInsertionIndex(null)
  }

  const selectSlide = (index: number, event: React.MouseEvent | React.KeyboardEvent): void => {
    const slideId = document.slideOrder[index]
    if (!slideId) return
    commitTextDraft()

    if (event.shiftKey) {
      const start = Math.min(selectionAnchorIndex, index)
      const end = Math.max(selectionAnchorIndex, index)
      setSelectedSlideIds(new Set(document.slideOrder.slice(start, end + 1)))
      setSelectedElementId(null)
      setSelectedElementIds(new Set())
      setEditingElementId(null)
      setIsTextInsertMode(false)
      setInsertionIndex(null)
      return
    } else if (event.metaKey || event.ctrlKey) {
      setSelectedSlideIds((current) => {
        const next = new Set(current)
        if (next.has(slideId)) {
          next.delete(slideId)
        } else {
          next.add(slideId)
        }
        if (next.size === 0) next.add(slideId)
        return next
      })
      setSelectedElementId(null)
      setSelectedElementIds(new Set())
      setEditingElementId(null)
      setIsTextInsertMode(false)
      setInsertionIndex(null)
      return
    } else {
      setSelectedSlideIds(new Set([slideId]))
      setSelectionAnchorIndex(index)
    }

    activateSlide(slideId)
    setSelectedElementId(null)
    setSelectedElementIds(new Set())
    setIsTextInsertMode(false)
    setInsertionIndex(null)
  }

  const showSlideSidebarMenu = (event: React.MouseEvent): void => {
    showMenu(
      [
        {
          id: 'new-slide',
          label: t('presentationWorkspace.newSlide'),
          icon: <Plus size={16} />,
          onAction: addSlide
        }
      ],
      event
    )
  }

  const getSelectedSlideIds = (): string[] => {
    if (!document) return []
    const selected = document.slideOrder.filter((slideId) => selectedSlideIds.has(slideId))
    if (selected.length > 0) return selected
    return activeSlideId ? [activeSlideId] : []
  }

  const pasteSlide = (): void => {
    if (copiedSlideIds.length === 0 || !document) return
    const targetIndex = insertionIndex ?? activeSlideIndex + 1
    const result = duplicateEditableSlides(document, copiedSlideIds, targetIndex)
    if (result.slideIds.length === 0) return
    commitDocument(result.document)
    setSelectedSlideIds(new Set(result.slideIds))
    activateSlide(result.slideIds[0])
    setInsertionIndex(null)
    setSelectedElementId(null)
    setSelectedElementIds(new Set())
  }

  const copySelectedSlides = (): void => {
    const slideIds = getSelectedSlideIds()
    if (slideIds.length === 0) return
    setCopiedSlideIds(slideIds)
    setCopiedElement(null)
  }

  const deleteSlide = (): void => {
    if (!document || document.slideOrder.length <= 1) return
    const removingIds = getSelectedSlideIds()
    if (removingIds.length === 0) return
    const nextDocument = removeEditableSlides(document, removingIds)
    const nextIndex = Math.min(activeSlideIndex, Math.max(0, nextDocument.slideOrder.length - 1))
    const nextSlideId = nextDocument.slideOrder[nextIndex]
    commitDocument(nextDocument)
    activateSlide(nextSlideId ?? null)
    setSelectedSlideIds(nextSlideId ? new Set([nextSlideId]) : new Set())
    setSelectedElementId(null)
    setSelectedElementIds(new Set())
    setInsertionIndex(null)
  }

  const deleteElement = (): void => {
    if (editingElementId) return
    if (!document || !activeSlideId || selectedElementIds.size === 0) return
    const nextDocument = [...selectedElementIds].reduce(
      (current, elementId) => removeElementFromSlide(current, activeSlideId, elementId),
      document
    )
    commitDocument(nextDocument)
    setSelectedElementId(null)
    setSelectedElementIds(new Set())
  }

  const pasteElement = (): void => {
    if (!copiedElement || !document || !activeSlideId) return
    const element = {
      ...copiedElement,
      id: crypto.randomUUID(),
      x: copiedElement.x + 24,
      y: copiedElement.y + 24
    } as EditablePresentationElement
    commitDocument(addElementToSlide(document, activeSlideId, element))
    setSelectedElementId(element.id)
    setSelectedElementIds(new Set([element.id]))
  }

  const reorderElement = (
    elementId: string,
    action: 'bring-forward' | 'bring-to-front' | 'send-backward' | 'send-to-back'
  ): void => {
    if (!document || !activeSlideId) return
    commitDocument(reorderElementInSlide(document, activeSlideId, elementId, action))
  }

  const showElementContextMenu = (
    event: React.MouseEvent,
    element: EditablePresentationElement
  ): void => {
    setSelectedElementId(element.id)
    setSelectedElementIds(new Set([element.id]))
    showMenu(
      [
        {
          id: 'bring-to-front',
          label: t('presentationWorkspace.bringToFront', 'Bring to Front'),
          onAction: () => reorderElement(element.id, 'bring-to-front')
        },
        {
          id: 'bring-forward',
          label: t('presentationWorkspace.bringForward', 'Bring Forward'),
          onAction: () => reorderElement(element.id, 'bring-forward')
        },
        'separator',
        {
          id: 'send-backward',
          label: t('presentationWorkspace.sendBackward', 'Send Backward'),
          onAction: () => reorderElement(element.id, 'send-backward')
        },
        {
          id: 'send-to-back',
          label: t('presentationWorkspace.sendToBack', 'Send to Back'),
          onAction: () => reorderElement(element.id, 'send-to-back')
        }
      ],
      event
    )
  }

  const addImage = async (file: File): Promise<void> => {
    if (!document || !activeSlideId) return
    const { dataUrl, width, height } = await readImageFile(file)
    const assetId = crypto.randomUUID()
    const nextDocument: EditablePresentationDocument = {
      ...document,
      assets: {
        ...document.assets,
        [assetId]: {
          id: assetId,
          name: file.name,
          mimeType: file.type || 'image/*',
          dataUrl
        }
      }
    }
    const element = createImageElement({
      assetId,
      slideWidth: document.width,
      slideHeight: document.height,
      sourceWidth: width,
      sourceHeight: height
    })
    commitDocument(addElementToSlide(nextDocument, activeSlideId, element))
    setSelectedElementId(element.id)
    setSelectedElementIds(new Set([element.id]))
    setIsTextInsertMode(false)
  }

  const selectedTextElement = selectedElement?.type === 'text' ? selectedElement : null
  const fontFamilies = useMemo(
    () =>
      mergeFontFamilies(
        FONT_FAMILIES,
        selectedTextElement ? [selectedTextElement.fontFamily] : [],
        localFontFamilies
      ),
    [localFontFamilies, selectedTextElement]
  )

  const updateSelectedTextElement = (
    updates: Partial<Extract<EditablePresentationElement, { type: 'text' }>>
  ): void => {
    if (!selectedTextElement) return
    updateSelectedElement(updates as Partial<EditablePresentationElement>)
  }

  const loadLocalFonts = async (): Promise<void> => {
    setIsLoadingLocalFonts(true)
    try {
      setLocalFontFamilies(await queryLocalFontFamilies())
    } catch {
      toast.warning(
        t(
          'presentationWorkspace.localFontsLoadFailed',
          'Unable to load local fonts. Check the font access permission.'
        )
      )
    } finally {
      setIsLoadingLocalFonts(false)
    }
  }

  const updateSelectedImageElement = (
    updates: Partial<Extract<EditablePresentationElement, { type: 'image' }>>
  ): void => {
    if (!selectedImageElement) return
    updateSelectedElement(updates as Partial<EditablePresentationElement>)
  }

  const openLineSpacingOptions = (): void => {
    setLineSpacingDraft(selectedTextElement?.lineHeight ?? 1.15)
    setIsLineSpacingOptionsOpen(true)
  }

  const showLineSpacingMenu = (event: React.MouseEvent): void => {
    showMenu(
      [
        ...LINE_SPACING_VALUES.map((value) => ({
          id: `line-spacing-${value}`,
          label: String(value),
          disabled: !selectedTextElement,
          onAction: () => updateSelectedTextElement({ lineHeight: value })
        })),
        'separator',
        {
          id: 'line-spacing-options',
          label: t('presentationWorkspace.lineSpacingOptions', 'Line Spacing Options...'),
          disabled: !selectedTextElement,
          onAction: openLineSpacingOptions
        }
      ],
      event
    )
  }

  const collapseSlideSelectionToActive = (): void => {
    if (!activeSlideId || selectedSlideIds.size <= 1) return
    setSelectedSlideIds(new Set([activeSlideId]))
  }

  const updateSelectedNumber = (key: 'x' | 'y' | 'width' | 'height', value: string): void => {
    const next = Number(value)
    if (!Number.isFinite(next)) return
    updateSelectedElement({
      [key]: next,
      ...(selectedElement?.type === 'text' && (key === 'width' || key === 'height')
        ? { autoWidth: false, autoSize: 'fixed' as const }
        : {})
    } as Partial<EditablePresentationElement>)
  }

  const commitNotes = (): void => {
    if (!activeSlideId || notesDraft === activeSlide?.notes) return
    commitDocument(updateSlideNotes(document, activeSlideId, notesDraft))
  }

  const flashRibbonAction = (actionId: string): void => {
    setPressedRibbonAction(actionId)
    if (pressedRibbonTimeoutRef.current !== null) {
      window.clearTimeout(pressedRibbonTimeoutRef.current)
    }
    pressedRibbonTimeoutRef.current = window.setTimeout(() => {
      setPressedRibbonAction((current) => (current === actionId ? null : current))
      pressedRibbonTimeoutRef.current = null
    }, 140)
  }

  const startRailResize = (event: React.PointerEvent): void => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = railWidth
    const move = (moveEvent: PointerEvent): void => {
      setRailWidth(Math.max(184, Math.min(360, startWidth + moveEvent.clientX - startX)))
    }
    const finish = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish, { once: true })
  }

  const renderRibbon = (): React.JSX.Element => {
    if (activeRibbon === 'picture') {
      return (
        <div
          data-ribbon-surface
          className="flex h-full min-w-max items-stretch overflow-x-auto overflow-y-hidden border-b border-divider bg-content1/95 text-sm"
        >
          <RibbonGroup
            label={t('presentationWorkspace.ribbonGroups.adjust', 'Adjust')}
            className="w-[660px]"
          >
            <div className="grid h-full grid-cols-[240px_120px_140px_140px] items-center gap-2">
              <ControlSlider
                label={t('presentationWorkspace.transparency', 'Transparency')}
                value={
                  selectedImageElement ? Math.round((1 - selectedImageElement.opacity) * 100) : 0
                }
                min={0}
                max={100}
                suffix="%"
                onChange={(value) => updateSelectedImageElement({ opacity: 1 - value / 100 })}
              />
              <label className="flex items-center gap-2 text-default-500">
                <span>{t('presentationWorkspace.borderColor', 'Border')}</span>
                <input
                  className="h-9 w-12 rounded bg-transparent"
                  type="color"
                  disabled={!selectedImageElement}
                  value={selectedImageElement?.borderColor ?? '#ffffff'}
                  onChange={(event) =>
                    updateSelectedImageElement({ borderColor: event.currentTarget.value })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-default-500">
                <span>{t('presentationWorkspace.borderWidth', 'Width')}</span>
                <select
                  className={`h-9 w-20 disabled:opacity-40 ${NATIVE_CONTROL_CLASS}`}
                  disabled={!selectedImageElement}
                  value={selectedImageElement?.borderWidth ?? 0}
                  onChange={(event) =>
                    updateSelectedImageElement({ borderWidth: Number(event.currentTarget.value) })
                  }
                >
                  {[0, 1, 2, 4, 6, 8].map((width) => (
                    <option key={width} value={width}>
                      {width}px
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-default-500">
                <span>{t('presentationWorkspace.shadow', 'Shadow')}</span>
                <select
                  className={`h-9 w-28 disabled:opacity-40 ${NATIVE_CONTROL_CLASS}`}
                  disabled={!selectedImageElement}
                  value={selectedImageElement?.shadow ?? 'none'}
                  onChange={(event) =>
                    updateSelectedImageElement({
                      shadow: event.currentTarget.value as EditableImageElement['shadow']
                    })
                  }
                >
                  <option value="none">{t('presentationWorkspace.shadowNone', 'None')}</option>
                  <option value="soft">{t('presentationWorkspace.shadowSoft', 'Soft')}</option>
                  <option value="medium">
                    {t('presentationWorkspace.shadowMedium', 'Medium')}
                  </option>
                </select>
              </label>
            </div>
          </RibbonGroup>
          <RibbonGroup
            label={t('presentationWorkspace.ribbonGroups.arrange', 'Arrange')}
            className="w-48"
          >
            <div className="grid h-full grid-rows-2 gap-1">
              <Button
                size="sm"
                variant="tertiary"
                isDisabled={!selectedImageElement}
                onPress={() =>
                  selectedImageElement && reorderElement(selectedImageElement.id, 'bring-forward')
                }
              >
                {t('presentationWorkspace.bringForward', 'Bring Forward')}
              </Button>
              <Button
                size="sm"
                variant="tertiary"
                isDisabled={!selectedImageElement}
                onPress={() =>
                  selectedImageElement && reorderElement(selectedImageElement.id, 'send-backward')
                }
              >
                {t('presentationWorkspace.sendBackward', 'Send Backward')}
              </Button>
            </div>
          </RibbonGroup>
          <RibbonGroup
            label={t('presentationWorkspace.ribbonGroups.size', 'Size')}
            className="w-28"
          >
            <div className="flex h-full items-center justify-center">
              <Button
                size="sm"
                variant={cropElementId === selectedImageElement?.id ? 'primary' : 'tertiary'}
                isDisabled={!selectedImageElement}
                onPress={() =>
                  setCropElementId((current) =>
                    current === selectedImageElement?.id ? null : (selectedImageElement?.id ?? null)
                  )
                }
              >
                <Crop size={16} />
                {t('presentationWorkspace.crop', 'Crop')}
              </Button>
            </div>
          </RibbonGroup>
        </div>
      )
    }

    if (activeRibbon === 'insert') {
      return (
        <div
          data-ribbon-surface
          className="flex h-full min-w-max items-stretch overflow-x-auto overflow-y-hidden border-b border-divider bg-content1/95"
        >
          <RibbonGroup
            label={t('presentationWorkspace.ribbonGroups.insert', 'Insert')}
            className="w-[460px]"
          >
            <div className="flex h-full items-center gap-1 [&>button]:h-16 [&>button]:min-w-20 [&>button]:flex-col [&>button]:gap-1">
              <Button
                size="sm"
                variant={isTextInsertMode ? 'primary' : 'tertiary'}
                onPress={() => setIsTextInsertMode((enabled) => !enabled)}
              >
                <Type size={18} />
                {t('presentationWorkspace.text', 'Text')}
              </Button>
              <Button size="sm" variant="tertiary" onPress={() => imageInputRef.current?.click()}>
                <ImagePlus size={18} />
                {t('presentationWorkspace.image', 'Image')}
              </Button>
              <Button size="sm" variant="tertiary" onPress={() => addShape('rectangle')}>
                <RectangleHorizontal size={18} />
                {t('presentationWorkspace.rectangle', 'Rectangle')}
              </Button>
              <Button size="sm" variant="tertiary" onPress={() => addShape('ellipse')}>
                <span className="size-[18px] rounded-full border-2 border-current" />
                {t('presentationWorkspace.ellipse', 'Ellipse')}
              </Button>
              <Button size="sm" variant="tertiary" onPress={addLine}>
                <Minus size={18} />
                {t('presentationWorkspace.line', 'Line')}
              </Button>
            </div>
          </RibbonGroup>
        </div>
      )
    }

    if (activeRibbon === 'design') {
      return (
        <div
          data-ribbon-surface
          className="flex h-full min-w-max items-stretch overflow-x-auto overflow-y-hidden border-b border-divider bg-content1/95 text-sm"
        >
          <RibbonGroup
            label={t('presentationWorkspace.ribbonGroups.background', 'Background')}
            className="w-48"
          >
            <div className="flex h-full items-center justify-center">
              <Button
                size="sm"
                variant={isBackgroundPanelOpen ? 'primary' : 'tertiary'}
                isDisabled={!activeSlide}
                onPress={() => {
                  setIsCompactRailOpen(false)
                  setIsBackgroundPanelOpen(true)
                }}
              >
                <Palette size={16} />
                {t('presentationWorkspace.formatBackground', 'Format Background')}
              </Button>
            </div>
          </RibbonGroup>
        </div>
      )
    }

    const textDisabled = !selectedTextElement
    const textButtonClass = (active = false, actionId?: string): string =>
      `${RIBBON_ICON_BUTTON_CLASS} ${
        active || (actionId !== undefined && pressedRibbonAction === actionId)
          ? RIBBON_ICON_BUTTON_ACTIVE_CLASS
          : ''
      }`
    const changeFontSize = (delta: number): void => {
      if (!selectedTextElement || !document) return
      const currentPoints = presentationCanvasPxToPoints(
        selectedTextElement.fontSize,
        document.width
      )
      const nextPoints = Math.max(6, Math.min(240, currentPoints + delta))
      updateSelectedTextElement({
        fontSize: presentationPointsToCanvasPx(nextPoints, document.width)
      })
    }
    const clearTextFormatting = (): void => {
      updateSelectedTextElement({
        bold: false,
        italic: false,
        underline: false,
        color: '#111827',
        align: 'left',
        lineHeight: 1.15
      })
    }

    return (
      <div
        data-ribbon-surface
        className="flex h-full min-w-max items-stretch overflow-x-auto overflow-y-hidden border-b border-divider bg-content1/95"
      >
        <RibbonGroup
          label={t('presentationWorkspace.ribbonGroups.font', 'Font')}
          className="w-[520px]"
        >
          <div className="grid h-full grid-rows-2 gap-1">
            <div className="flex items-center gap-2">
              <select
                aria-label={t('presentationWorkspace.fontFamily', 'Font family')}
                className={`h-9 w-64 disabled:opacity-40 ${NATIVE_CONTROL_CLASS}`}
                disabled={textDisabled}
                value={selectedTextElement?.fontFamily ?? FONT_FAMILIES[0]}
                onChange={(event) =>
                  updateSelectedTextElement({
                    fontFamily: event.currentTarget.value
                  })
                }
              >
                {fontFamilies.map((fontFamily) => (
                  <option key={fontFamily} value={fontFamily}>
                    {fontFamily}
                  </option>
                ))}
              </select>
              {supportsLocalFontAccess() && (
                <button
                  type="button"
                  className={RIBBON_ICON_BUTTON_CLASS}
                  disabled={isLoadingLocalFonts}
                  onClick={() => void loadLocalFonts()}
                  aria-label={t('presentationWorkspace.loadLocalFonts', 'Load local fonts')}
                >
                  <RefreshCw className={`size-4 ${isLoadingLocalFonts ? 'animate-spin' : ''}`} />
                </button>
              )}
              <select
                className={`h-9 w-24 disabled:opacity-40 ${NATIVE_CONTROL_CLASS}`}
                disabled={textDisabled}
                value={
                  selectedTextElement && document
                    ? presentationCanvasPxToPoints(selectedTextElement.fontSize, document.width)
                    : 44
                }
                onChange={(event) =>
                  updateSelectedTextElement({
                    fontSize: presentationPointsToCanvasPx(
                      Number(event.currentTarget.value),
                      document?.width ?? 1920
                    )
                  })
                }
              >
                {FONT_SIZES.map((fontSize) => (
                  <option key={fontSize} value={fontSize}>
                    {fontSize}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={textButtonClass(false, 'increase-font-size')}
                disabled={textDisabled}
                onClick={() => {
                  flashRibbonAction('increase-font-size')
                  changeFontSize(2)
                }}
                aria-label={t('presentationWorkspace.increaseFontSize', 'Increase font size')}
              >
                <span className="text-xl leading-none">A</span>
                <ChevronDown className="size-3 rotate-180" />
              </button>
              <button
                type="button"
                className={textButtonClass(false, 'decrease-font-size')}
                disabled={textDisabled}
                onClick={() => {
                  flashRibbonAction('decrease-font-size')
                  changeFontSize(-2)
                }}
                aria-label={t('presentationWorkspace.decreaseFontSize', 'Decrease font size')}
              >
                <span className="text-sm leading-none">A</span>
                <ChevronDown className="size-3" />
              </button>
              <button
                type="button"
                className={textButtonClass(false, 'clear-formatting')}
                disabled={textDisabled}
                onClick={() => {
                  flashRibbonAction('clear-formatting')
                  clearTextFormatting()
                }}
                aria-label={t('presentationWorkspace.clearFormatting', 'Clear formatting')}
              >
                <Eraser size={18} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={textButtonClass(Boolean(selectedTextElement?.bold))}
                disabled={textDisabled}
                aria-pressed={Boolean(selectedTextElement?.bold)}
                onClick={() => updateSelectedTextElement({ bold: !selectedTextElement?.bold })}
                aria-label={t('presentationWorkspace.bold', 'Bold')}
              >
                <Bold size={18} />
              </button>
              <button
                type="button"
                className={textButtonClass(Boolean(selectedTextElement?.italic))}
                disabled={textDisabled}
                aria-pressed={Boolean(selectedTextElement?.italic)}
                onClick={() => updateSelectedTextElement({ italic: !selectedTextElement?.italic })}
                aria-label={t('presentationWorkspace.italic', 'Italic')}
              >
                <Italic size={18} />
              </button>
              <button
                type="button"
                className={textButtonClass(Boolean(selectedTextElement?.underline))}
                disabled={textDisabled}
                aria-pressed={Boolean(selectedTextElement?.underline)}
                onClick={() =>
                  updateSelectedTextElement({ underline: !selectedTextElement?.underline })
                }
                aria-label={t('presentationWorkspace.underline', 'Underline')}
              >
                <Underline size={18} />
              </button>
              <label
                className={`relative ${RIBBON_ICON_BUTTON_CLASS} ${
                  textDisabled ? 'cursor-not-allowed opacity-30 hover:bg-transparent' : ''
                }`}
                aria-label={t('presentationWorkspace.fontColor', 'Font color')}
              >
                <Baseline size={18} />
                <ChevronDown size={12} />
                <span
                  className="absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2"
                  style={{ backgroundColor: selectedTextElement?.color ?? '#111827' }}
                />
                <input
                  className="sr-only"
                  type="color"
                  disabled={textDisabled}
                  value={selectedTextElement?.color ?? '#111827'}
                  onChange={(event) =>
                    updateSelectedTextElement({
                      color: event.currentTarget.value
                    })
                  }
                />
              </label>
            </div>
          </div>
        </RibbonGroup>

        <RibbonGroup
          label={t('presentationWorkspace.ribbonGroups.paragraph', 'Paragraph')}
          className="w-44"
        >
          <div className="grid h-full grid-rows-2 gap-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={textButtonClass(false, 'line-spacing')}
                disabled={textDisabled}
                onClick={(event) => {
                  flashRibbonAction('line-spacing')
                  showLineSpacingMenu(event)
                }}
                aria-label={t('presentationWorkspace.lineSpacing', 'Line spacing')}
              >
                <WrapText size={19} />
                <ChevronDown size={12} />
              </button>
            </div>
            <div className="flex items-center gap-1">
              {(
                [
                  ['left', AlignLeft],
                  ['center', AlignCenter],
                  ['right', AlignRight]
                ] as const
              ).map(([align, Icon]) => (
                <button
                  key={align}
                  type="button"
                  className={textButtonClass(selectedTextElement?.align === align)}
                  disabled={textDisabled}
                  aria-pressed={selectedTextElement?.align === align}
                  onClick={() => updateSelectedTextElement({ align })}
                  aria-label={t(`presentationWorkspace.align.${align}`, align)}
                >
                  <Icon size={19} />
                </button>
              ))}
            </div>
          </div>
        </RibbonGroup>

        <RibbonGroup
          label={t('presentationWorkspace.ribbonGroups.position', 'Position')}
          className="w-48"
        >
          <div className="grid h-full grid-cols-2 grid-rows-2 gap-1">
            {(['x', 'y', 'width', 'height'] as const).map((key) => (
              <label
                key={key}
                className="flex items-center gap-1 text-xs uppercase text-default-400"
              >
                <span className="w-3">{key === 'width' ? 'w' : key === 'height' ? 'h' : key}</span>
                <input
                  className={`h-8 min-w-0 flex-1 px-2 ${NATIVE_CONTROL_CLASS}`}
                  type="number"
                  disabled={!selectedElement}
                  value={selectedElement ? Math.round(selectedElement[key]) : 0}
                  onChange={(event) => updateSelectedNumber(key, event.currentTarget.value)}
                  aria-label={key}
                />
              </label>
            ))}
          </div>
        </RibbonGroup>

        <RibbonGroup
          label={t('presentationWorkspace.ribbonGroups.arrange', 'Arrange')}
          className="w-44"
        >
          <div data-ribbon-no-wrap className="grid h-full grid-cols-4 grid-rows-2 gap-1">
            {(
              [
                ['left', AlignHorizontalJustifyStart, 'Align objects left'],
                ['center', AlignHorizontalJustifyCenter, 'Align objects center'],
                ['right', AlignHorizontalJustifyEnd, 'Align objects right'],
                ['top', AlignVerticalJustifyStart, 'Align objects top'],
                ['middle', AlignVerticalJustifyCenter, 'Align objects middle'],
                ['bottom', AlignVerticalJustifyEnd, 'Align objects bottom']
              ] as const
            ).map(([alignment, Icon, fallback]) => (
              <button
                key={alignment}
                type="button"
                className={RIBBON_ICON_BUTTON_CLASS}
                disabled={selectedElementIds.size < 2}
                onClick={() => applyElementAlignment(alignment)}
                aria-label={t(`presentationWorkspace.objectAlign.${alignment}`, fallback)}
              >
                <Icon size={19} />
              </button>
            ))}
            {(
              [
                ['horizontal', AlignHorizontalSpaceAround, 'Distribute objects horizontally'],
                ['vertical', AlignVerticalSpaceAround, 'Distribute objects vertically']
              ] as const
            ).map(([direction, Icon, fallback]) => (
              <button
                key={direction}
                type="button"
                className={RIBBON_ICON_BUTTON_CLASS}
                disabled={selectedElementIds.size < 3}
                onClick={() => applyElementDistribution(direction)}
                aria-label={t(`presentationWorkspace.distribute.${direction}`, fallback)}
              >
                <Icon size={19} />
              </button>
            ))}
          </div>
        </RibbonGroup>
      </div>
    )
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (event.key === 'Escape' && session.getSnapshot().draftKind !== null) {
        event.preventDefault()
        clearTextCommitTimer()
        session.cancelDraft()
        setEditingElementId(null)
        return
      }
      const isEditingText =
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'SELECT' ||
        target?.tagName === 'TEXTAREA'
      if (isEditingText) return

      const command = event.metaKey || event.ctrlKey
      const isSlideSidebar = Boolean(target?.closest('[data-slide-sidebar]'))
      if (
        activeSlideId &&
        selectedElementIds.size > 0 &&
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      ) {
        event.preventDefault()
        const amount = event.shiftKey ? 10 : 1
        const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0
        const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0
        commitDocument(nudgeElements(document, activeSlideId, [...selectedElementIds], dx, dy))
        return
      }
      if (isSlideSidebar && command && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        if (document) {
          setSelectedSlideIds(new Set(document.slideOrder))
          setCopiedElement(null)
          setSelectedElementId(null)
        }
        return
      }
      if (command && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        if (selectedElement) {
          setCopiedElement(selectedElement)
          setCopiedSlideIds([])
        } else {
          copySelectedSlides()
        }
      }
      if (command && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        if (copiedElement) {
          pasteElement()
        } else {
          pasteSlide()
        }
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedElementId) {
          event.preventDefault()
          deleteElement()
        } else if (isSlideSidebar && document && document.slideOrder.length > 1) {
          event.preventDefault()
          deleteSlide()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  if (!activeSlideId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <FileText className="text-danger" size={36} />
        <p className="text-sm font-semibold text-danger">{t('presentationWorkspace.loadFailed')}</p>
      </div>
    )
  }

  const ribbonHeightClass = 'h-28'

  return (
    <>
      <div
        className="flex min-h-0 flex-1 flex-col bg-background"
        onPointerDownCapture={(event) => {
          const target = event.target as HTMLElement | null
          if (target?.closest('[data-slide-sidebar]')) return
          collapseSlideSelectionToActive()
        }}
      >
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ''
            if (file) {
              void addImage(file).catch((imageError) => {
                toast.danger(imageError instanceof Error ? imageError.message : String(imageError))
              })
            }
          }}
        />
        <div
          data-testid="presentation-ribbon-frame"
          className={`shrink-0 overflow-hidden transition-[height,opacity] duration-200 ${
            isRibbonOpen ? `${ribbonHeightClass} opacity-100` : 'h-0 opacity-0'
          }`}
        >
          {renderRibbon()}
        </div>
        <div
          data-testid="presentation-workspace-grid"
          className={`presentation-workspace-grid grid min-h-0 flex-1 ${
            isBackgroundPanelOpen ? '' : 'workspace-two-panel'
          }`}
          style={
            {
              '--presentation-rail-width': `${railWidth}px`,
              gridTemplateColumns: isBackgroundPanelOpen
                ? `${railWidth}px minmax(0, 1fr) 300px`
                : `${railWidth}px minmax(0, 1fr)`
            } as React.CSSProperties
          }
        >
          <NavigatorRail
            data-slide-sidebar
            data-compact-open={isCompactRailOpen || undefined}
            className="presentation-slide-rail relative min-h-0 overflow-y-auto border-r border-divider bg-content1/40 px-2 py-3"
            onContextMenu={showSlideSidebarMenu}
          >
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1 z-20 md:hidden"
              onPress={() => setIsCompactRailOpen(false)}
              aria-label={t('presentationWorkspace.closeSlideRail', 'Close slide rail')}
            >
              <X size={14} />
            </Button>
            <div className="space-y-1">
              {document.slideOrder.map((slideId, index) => {
                const isSelected =
                  selectedSlideIds.size === 0
                    ? index === activeSlideIndex
                    : selectedSlideIds.has(slideId)
                return (
                  <React.Fragment key={slideId}>
                    <button
                      type="button"
                      className="group flex h-5 w-full items-center px-1"
                      onClick={() => setInsertionIndex(index)}
                      onDragOver={(event) => {
                        event.preventDefault()
                        setInsertionIndex(index)
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        moveSelectedSlides(index)
                      }}
                      aria-label={`Insert before slide ${index + 1}`}
                    >
                      <span
                        className={`w-full rounded-full ${
                          insertionIndex === index
                            ? 'h-[2px] animate-pulse bg-[#f59e0b]'
                            : 'h-px bg-transparent group-hover:bg-[#f59e0b]/50 group-focus-visible:bg-[#f59e0b]/70'
                        }`}
                      />
                    </button>
                    <button
                      draggable
                      className="flex w-full gap-2 px-1 py-2 text-left text-default-500 transition-colors hover:bg-content2 focus-visible:outline-none"
                      onClick={(event) => selectSlide(index, event)}
                      onDragStart={(event) => {
                        const ids = selectedSlideIds.has(slideId)
                          ? getSelectedSlideIds()
                          : [slideId]
                        setDraggingSlideIds(ids)
                        setSelectedSlideIds(new Set(ids))
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', ids.join(','))
                      }}
                      onDragEnd={() => {
                        setDraggingSlideIds([])
                        setInsertionIndex(null)
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.altKey &&
                          (event.key === 'ArrowUp' || event.key === 'ArrowDown')
                        ) {
                          event.preventDefault()
                          const target = event.key === 'ArrowUp' ? index - 1 : index + 2
                          const ids = selectedSlideIds.has(slideId)
                            ? getSelectedSlideIds()
                            : [slideId]
                          const nextDocument = reorderSelectedSlides(document, ids, target)
                          if (nextDocument !== document) commitDocument(nextDocument)
                          return
                        }
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addSlideAfter(index)
                        }
                      }}
                    >
                      <span
                        className={
                          isSelected
                            ? 'w-4 pt-1 text-right text-xs tabular-nums text-foreground'
                            : 'w-4 pt-1 text-right text-xs tabular-nums'
                        }
                      >
                        {index + 1}
                      </span>
                      <span
                        className={`relative flex aspect-video w-full min-w-0 overflow-hidden border bg-black shadow-sm ${
                          isSelected
                            ? 'border-warning ring-2 ring-warning/50'
                            : index === activeSlideIndex
                              ? 'border-primary ring-2 ring-primary/40'
                              : 'border-transparent'
                        }`}
                      >
                        <EditableSlideThumbnail document={document} slideId={slideId} />
                        {index === projectedSlideIndex && (
                          <span
                            className="absolute inset-y-0 left-0 w-1 bg-success"
                            aria-label={t(
                              'presentationWorkspace.projectedSlide',
                              'Projected slide'
                            )}
                          />
                        )}
                        {index === projectedSlideIndex + 1 && projectedSlideIndex >= 0 && (
                          <span
                            className="absolute bottom-1 right-1 rounded bg-success/90 px-1 text-[10px] font-semibold text-white"
                            aria-label={t('presentationWorkspace.nextSlide', 'Next slide')}
                          >
                            {t('presentationWorkspace.next', 'Next')}
                          </span>
                        )}
                      </span>
                    </button>
                  </React.Fragment>
                )
              })}
              <button
                type="button"
                className="group flex h-5 w-full items-center px-1"
                onClick={() => setInsertionIndex(document.slideOrder.length)}
                onDragOver={(event) => {
                  event.preventDefault()
                  setInsertionIndex(document.slideOrder.length)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  moveSelectedSlides(document.slideOrder.length)
                }}
                aria-label="Insert after last slide"
              >
                <span
                  className={`w-full rounded-full ${
                    insertionIndex === document.slideOrder.length
                      ? 'h-[2px] animate-pulse bg-[#f59e0b]'
                      : 'h-px bg-transparent group-hover:bg-[#f59e0b]/50 group-focus-visible:bg-[#f59e0b]/70'
                  }`}
                />
              </button>
            </div>
            <button
              type="button"
              className="absolute inset-y-0 right-0 w-1 cursor-col-resize bg-transparent hover:bg-primary/50 focus-visible:bg-primary"
              onPointerDown={startRailResize}
              aria-label={t('presentationWorkspace.resizeSlideRail', 'Resize slide rail')}
            />
          </NavigatorRail>

          <StageViewport className="presentation-stage relative flex min-h-0 flex-col bg-[#111217]">
            <Button
              size="sm"
              variant="tertiary"
              className="absolute left-2 top-2 z-20 md:hidden"
              onPress={() => {
                setIsBackgroundPanelOpen(false)
                setIsCompactRailOpen(true)
              }}
              aria-label={t('presentationWorkspace.openSlideRail', 'Open slide rail')}
            >
              {t('presentationWorkspace.slides', 'Slides')}
            </Button>
            <div className="flex flex-1 items-center justify-center overflow-auto p-8">
              <div
                className="relative max-w-none shrink-0 transition-[width] duration-150"
                style={{ width: `${Math.max(320, 1024 * (zoomPercent / 100))}px` }}
              >
                <EditableSlideSurface
                  document={document}
                  slideId={activeSlideId}
                  editable
                  showBorder
                  selectedElementId={selectedElementId}
                  selectedElementIds={selectedElementIds}
                  editingElementId={editingElementId}
                  cropElementId={cropElementId}
                  isTextInsertMode={isTextInsertMode}
                  onSelectElement={selectElement}
                  onMarqueeSelect={(bounds, additive) => {
                    if (!activeSlide) return
                    const matches = selectElementsInBounds(activeSlide, bounds)
                    setSelectedElementIds((current) => {
                      const next = additive ? new Set(current) : new Set<string>()
                      matches.forEach((elementId) => next.add(elementId))
                      setSelectedElementId(matches.at(-1) ?? (additive ? selectedElementId : null))
                      return next
                    })
                  }}
                  onEditingElementChange={(elementId) => {
                    if (elementId === null) commitTextDraft()
                    setEditingElementId(elementId)
                  }}
                  onInsertText={addTextElement}
                  onElementContextMenu={showElementContextMenu}
                  onTransformStart={() => session.beginDraft('pointer')}
                  onTransformPreview={(elementId, updates) => {
                    const snapshot = session.getSnapshot()
                    const preview = snapshot.renderedDocument
                    const base = snapshot.history.present
                    const current = base.slides[activeSlideId]?.elements[elementId]
                    let nextUpdates = updates
                    if (current && (updates.x !== undefined || updates.y !== undefined)) {
                      const snapped = snapElementPosition(
                        { ...current, ...updates },
                        { width: preview.width, height: preview.height },
                        8
                      )
                      nextUpdates = { ...updates, x: snapped.x, y: snapped.y }
                      setSnapGuides({
                        vertical: snapped.verticalGuide,
                        horizontal: snapped.horizontalGuide
                      })
                    }
                    if (
                      current &&
                      selectedElementIds.size > 1 &&
                      updates.width === undefined &&
                      updates.height === undefined &&
                      (nextUpdates.x !== undefined || nextUpdates.y !== undefined)
                    ) {
                      session.previewDraft(
                        nudgeElements(
                          base,
                          activeSlideId,
                          [...selectedElementIds],
                          (nextUpdates.x ?? current.x) - current.x,
                          (nextUpdates.y ?? current.y) - current.y
                        )
                      )
                      return
                    }
                    session.previewDraft(
                      updateElementInSlide(preview, activeSlideId, elementId, nextUpdates)
                    )
                  }}
                  onTransformCommit={() => {
                    setSnapGuides({})
                    session.commitDraft()
                  }}
                  onTransformCancel={() => {
                    setSnapGuides({})
                    session.cancelDraft()
                  }}
                  onUpdateElement={previewTextElement}
                />
                {snapGuides.vertical !== undefined && (
                  <span
                    className="pointer-events-none absolute inset-y-0 w-px bg-primary"
                    style={{ left: `${(snapGuides.vertical / document.width) * 100}%` }}
                  />
                )}
                {snapGuides.horizontal !== undefined && (
                  <span
                    className="pointer-events-none absolute inset-x-0 h-px bg-primary"
                    style={{ top: `${(snapGuides.horizontal / document.height) * 100}%` }}
                  />
                )}
              </div>
            </div>
            {isNotesOpen && (
              <label className="border-t border-divider bg-content1/95 px-4 py-2 text-xs text-default-500">
                <span className="sr-only">{t('presentationWorkspace.notes', 'Notes')}</span>
                <textarea
                  className="h-20 w-full resize-none rounded-lg border border-divider bg-content2 p-2 text-sm text-foreground outline-none focus:border-primary"
                  value={notesDraft}
                  onChange={(event) => {
                    const value = event.currentTarget.value
                    setNotesDraftBySlideId((current) => ({
                      ...current,
                      [activeSlideId]: value
                    }))
                  }}
                  onBlur={commitNotes}
                  aria-label={t('presentationWorkspace.notes', 'Notes')}
                  placeholder={t(
                    'presentationWorkspace.notesPlaceholder',
                    'Add speaker notes for this slide'
                  )}
                />
              </label>
            )}
            <div className="flex h-8 items-center gap-3 border-t border-divider bg-content1 px-3 text-xs text-default-500">
              <span>
                {t('presentationWorkspace.slide', 'Slide')} {activeSlideIndex + 1} /{' '}
                {document.slideOrder.length}
              </span>
              <span>
                {t('presentationWorkspace.selectedObjects', 'Selected objects')}:{' '}
                {selectedElementIds.size}
              </span>
              {projectedSlideIndex >= 0 && (
                <span className="text-success">
                  {t('presentationWorkspace.projectingSlide', 'Projecting slide')}{' '}
                  {projectedSlideIndex + 1}
                </span>
              )}
              <Button
                size="sm"
                variant={isNotesOpen ? 'primary' : 'ghost'}
                onPress={() => {
                  if (isNotesOpen) commitNotes()
                  setIsNotesOpen((open) => !open)
                }}
                aria-label={t('presentationWorkspace.toggleNotes', 'Toggle Notes')}
              >
                <StickyNote size={14} />
                <span className="hidden lg:inline">
                  {t('presentationWorkspace.notes', 'Notes')}
                </span>
              </Button>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  onPress={() => setZoomPercent((value) => Math.max(25, value - 25))}
                  aria-label={t('presentationWorkspace.zoomOut', 'Zoom out')}
                >
                  <ZoomOut size={14} />
                </Button>
                <input
                  className="w-28 accent-primary"
                  type="range"
                  min={25}
                  max={200}
                  step={5}
                  value={zoomPercent}
                  onChange={(event) => setZoomPercent(Number(event.currentTarget.value))}
                  aria-label={t('presentationWorkspace.zoom', 'Zoom')}
                />
                <button
                  type="button"
                  className="w-11 rounded px-1 text-right tabular-nums hover:bg-content2"
                  onClick={() => setZoomPercent(100)}
                  aria-label={t('presentationWorkspace.resetZoom', 'Reset zoom')}
                >
                  {zoomPercent}%
                </button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  onPress={() => setZoomPercent((value) => Math.min(200, value + 25))}
                  aria-label={t('presentationWorkspace.zoomIn', 'Zoom in')}
                >
                  <ZoomIn size={14} />
                </Button>
              </div>
            </div>
          </StageViewport>
          {isBackgroundPanelOpen && activeSlide && (
            <InspectorPanel className="presentation-inspector">
              <FormatBackgroundPanel
                background={activeSlide.background}
                onChange={setActiveSlideBackground}
                onApplyToAll={applyActiveBackgroundToAllSlides}
                onReset={resetActiveSlideBackground}
                onClose={() => setIsBackgroundPanelOpen(false)}
              />
            </InspectorPanel>
          )}
        </div>
      </div>
      <LineSpacingOptionsDialog
        isOpen={isLineSpacingOptionsOpen}
        value={lineSpacingDraft}
        onValueChange={setLineSpacingDraft}
        onClose={() => setIsLineSpacingOptionsOpen(false)}
        onApply={() => {
          const nextLineHeight = Math.max(
            0.5,
            Math.min(4, Number.isFinite(lineSpacingDraft) ? lineSpacingDraft : 1.15)
          )
          updateSelectedTextElement({ lineHeight: nextLineHeight })
          setIsLineSpacingOptionsOpen(false)
        }}
      />
    </>
  )
}

function LineSpacingOptionsDialog({
  isOpen,
  value,
  onValueChange,
  onClose,
  onApply
}: {
  isOpen: boolean
  value: number
  onValueChange: (value: number) => void
  onClose: () => void
  onApply: () => void
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <AlertDialog.Backdrop isOpen={isOpen} isDismissable onOpenChange={(open) => !open && onClose()}>
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog className="p-5">
          <AlertDialog.Header>
            <AlertDialog.Heading>
              {t('presentationWorkspace.lineSpacingOptions', 'Line Spacing Options')}
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <div className="space-y-4">
              <label className="block text-sm text-default-500">
                <span>{t('presentationWorkspace.lineSpacing', 'Line spacing')}</span>
                <input
                  className={`mt-2 h-10 w-full ${NATIVE_CONTROL_CLASS}`}
                  type="number"
                  min={0.5}
                  max={4}
                  step={0.05}
                  value={value}
                  onChange={(event) => onValueChange(Number(event.currentTarget.value))}
                />
              </label>
              <input
                className={RANGE_CLASS}
                type="range"
                min={0.5}
                max={4}
                step={0.05}
                value={value}
                onChange={(event) => onValueChange(Number(event.currentTarget.value))}
              />
            </div>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" onPress={onClose}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onPress={onApply}>
              {t('common.confirm')}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  )
}

function FormatBackgroundPanel({
  background,
  onChange,
  onApplyToAll,
  onReset,
  onClose
}: {
  background: EditableSlideBackground
  onChange: (background: EditableSlideBackground) => void
  onApplyToAll: () => void
  onReset: () => void
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation()
  const [selectedStopIndex, setSelectedStopIndex] = useState(0)
  const normalized = normalizeSlideBackground(background)
  const isModernGradient = normalized.type === 'gradient' && 'stops' in normalized
  const fillType = isModernGradient ? 'gradient' : 'solid'
  const gradient = isModernGradient
    ? normalized
    : {
        ...DEFAULT_GRADIENT_BACKGROUND,
        stops: [
          {
            ...DEFAULT_GRADIENT_BACKGROUND.stops[0],
            color: getSlideBackgroundPrimaryColor(normalized)
          },
          { ...DEFAULT_GRADIENT_BACKGROUND.stops[1] }
        ]
      }
  const selectedStop = gradient.stops[Math.min(selectedStopIndex, gradient.stops.length - 1)]

  const setFillType = (type: 'solid' | 'gradient'): void => {
    if (type === fillType) return
    if (type === 'solid') {
      onChange({
        type: 'solid',
        color: getSlideBackgroundPrimaryColor(normalized),
        transparency: 0
      })
      return
    }
    onChange({
      ...DEFAULT_GRADIENT_BACKGROUND,
      stops: [
        {
          ...DEFAULT_GRADIENT_BACKGROUND.stops[0],
          color: getSlideBackgroundPrimaryColor(normalized)
        },
        { ...DEFAULT_GRADIENT_BACKGROUND.stops[1] }
      ]
    })
    setSelectedStopIndex(0)
  }

  const updateSolid = (
    updates: Partial<Extract<EditableSlideBackground, { type: 'solid' }>>
  ): void => {
    const solid =
      normalized.type === 'solid'
        ? normalized
        : {
            type: 'solid' as const,
            color: getSlideBackgroundPrimaryColor(normalized),
            transparency: 0
          }
    onChange({ ...solid, ...updates })
  }

  const updateGradient = (
    updates: Partial<Extract<EditableSlideBackground, { type: 'gradient'; stops: unknown[] }>>
  ): void => {
    onChange({ ...gradient, ...updates })
  }

  const updateSelectedStop = (updates: Partial<(typeof gradient.stops)[number]>): void => {
    const stops = gradient.stops.map((stop, index) =>
      index === selectedStopIndex ? { ...stop, ...updates } : stop
    )
    updateGradient({ stops })
  }

  const addGradientStop = (): void => {
    const nextStop = { color: '#ffffff', position: 50, transparency: 0, brightness: 0 }
    const stops = [...gradient.stops, nextStop].sort((a, b) => a.position - b.position)
    updateGradient({ stops })
    setSelectedStopIndex(stops.indexOf(nextStop))
  }

  const removeSelectedStop = (): void => {
    if (gradient.stops.length <= 2) return
    const stops = gradient.stops.filter((_stop, index) => index !== selectedStopIndex)
    updateGradient({ stops })
    setSelectedStopIndex(Math.max(0, selectedStopIndex - 1))
  }

  return (
    <aside className="flex min-h-0 flex-col border-l border-divider bg-content1/80">
      <div className="flex items-center justify-between border-b border-divider px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          {t('presentationWorkspace.formatBackground', 'Format Background')}
        </h2>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          onPress={onClose}
          aria-label={t('common.close')}
        >
          <X size={16} />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <div role="radiogroup" className="space-y-2 text-sm text-default-500">
          {(['solid', 'gradient'] as const).map((type) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-content2"
            >
              <input
                type="radio"
                name="presentation-background-fill"
                checked={fillType === type}
                onChange={() => setFillType(type)}
              />
              {type === 'solid'
                ? t('presentationWorkspace.solidFill', 'Solid fill')
                : t('presentationWorkspace.gradientFill', 'Gradient fill')}
            </label>
          ))}
        </div>

        {fillType === 'solid' ? (
          <div className="space-y-4 text-sm text-default-500">
            <label className="flex items-center justify-between gap-3">
              <span>{t('presentationWorkspace.fillColor', 'Color')}</span>
              <input
                className="h-9 w-14 rounded bg-transparent"
                type="color"
                value={
                  normalized.type === 'solid'
                    ? normalized.color
                    : getSlideBackgroundPrimaryColor(normalized)
                }
                onChange={(event) => updateSolid({ color: event.currentTarget.value })}
              />
            </label>
            <ControlSlider
              label={t('presentationWorkspace.transparency', 'Transparency')}
              value={normalized.type === 'solid' ? normalized.transparency : 0}
              min={0}
              max={100}
              suffix="%"
              onChange={(value) => updateSolid({ transparency: value })}
            />
          </div>
        ) : (
          <div className="space-y-4 text-sm text-default-500">
            <label className="block">
              <span>{t('presentationWorkspace.gradientType', 'Type')}</span>
              <select className={`mt-2 h-9 w-full ${NATIVE_CONTROL_CLASS}`} value="linear" disabled>
                <option value="linear">Linear</option>
              </select>
            </label>
            <label className="block">
              <span>{t('presentationWorkspace.gradientDirection', 'Direction')}</span>
              <select
                className={`mt-2 h-9 w-full ${NATIVE_CONTROL_CLASS}`}
                value={gradient.direction}
                onChange={(event) =>
                  updateGradient({
                    direction: event.currentTarget.value as EditableGradientDirection,
                    angle: getAngleForDirection(
                      event.currentTarget.value as EditableGradientDirection
                    )
                  })
                }
              >
                <option value="left-right">
                  {t('presentationWorkspace.gradientLeftRight', 'Left to right')}
                </option>
                <option value="top-bottom">
                  {t('presentationWorkspace.gradientTopBottom', 'Top to bottom')}
                </option>
                <option value="diagonal">
                  {t('presentationWorkspace.gradientDiagonal', 'Diagonal')}
                </option>
              </select>
            </label>
            <ControlSlider
              label={t('presentationWorkspace.gradientAngle', 'Angle')}
              value={gradient.angle}
              min={0}
              max={360}
              suffix="°"
              onChange={(value) => updateGradient({ angle: value })}
            />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>{t('presentationWorkspace.gradientStops', 'Gradient stops')}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onPress={addGradientStop}>
                    +
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    isDisabled={gradient.stops.length <= 2}
                    onPress={removeSelectedStop}
                  >
                    -
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                {gradient.stops.map((stop, index) => (
                  <button
                    key={`${stop.color}-${stop.position}-${index}`}
                    type="button"
                    className={`h-7 flex-1 rounded border ${
                      selectedStopIndex === index ? 'border-primary' : 'border-divider'
                    }`}
                    style={{ backgroundColor: stop.color }}
                    onClick={() => setSelectedStopIndex(index)}
                    aria-label={`${t('presentationWorkspace.gradientStop', 'Gradient stop')} ${index + 1}`}
                  />
                ))}
              </div>
            </div>
            {selectedStop && (
              <div className="space-y-4 rounded-xl border border-divider bg-content2/50 p-3">
                <label className="flex items-center justify-between gap-3">
                  <span>{t('presentationWorkspace.fillColor', 'Color')}</span>
                  <input
                    className="h-9 w-14 rounded bg-transparent"
                    type="color"
                    value={selectedStop.color}
                    onChange={(event) => updateSelectedStop({ color: event.currentTarget.value })}
                  />
                </label>
                <ControlSlider
                  label={t('presentationWorkspace.positionPercent', 'Position')}
                  value={selectedStop.position}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(value) => updateSelectedStop({ position: value })}
                />
                <ControlSlider
                  label={t('presentationWorkspace.transparency', 'Transparency')}
                  value={selectedStop.transparency}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(value) => updateSelectedStop({ transparency: value })}
                />
                <ControlSlider
                  label={t('presentationWorkspace.brightness', 'Brightness')}
                  value={selectedStop.brightness}
                  min={-100}
                  max={100}
                  suffix="%"
                  onChange={(value) => updateSelectedStop({ brightness: value })}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-divider p-4">
        <Button variant="primary" onPress={onApplyToAll}>
          {t('presentationWorkspace.applyToAll', 'Apply to All')}
        </Button>
        <Button variant="tertiary" onPress={onReset}>
          {t('presentationWorkspace.resetBackground', 'Reset Background')}
        </Button>
      </div>
    </aside>
  )
}

function ControlSlider({
  label,
  value,
  min,
  max,
  suffix,
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  suffix: string
  onChange: (value: number) => void
}): React.JSX.Element {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="text-xs tabular-nums text-default-400">
          {value}
          {suffix}
        </span>
      </div>
      <input
        className={RANGE_CLASS}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  )
}

function getAngleForDirection(direction: EditableGradientDirection): number {
  if (direction === 'left-right') return 90
  if (direction === 'diagonal') return 135
  return 180
}

async function readImageFile(
  file: File
): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl = await readFileAsDataUrl(file)
  const size = await readImageSize(dataUrl)
  return { dataUrl, ...size }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

function readImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const width = image.naturalWidth
      const height = image.naturalHeight
      if (width <= 0 || height <= 0) {
        reject(new Error('Unable to read image dimensions'))
        return
      }
      resolve({ width, height })
    }
    image.onerror = () => reject(new Error('Unable to read image dimensions'))
    image.src = dataUrl
  })
}

export default function PresentationWorkspacePage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { itemId } = useParams()
  const openDocument = usePresentationWorkspaceStore((state) => state.openDocument)
  const activeDocument = usePresentationWorkspaceStore((state) => state.getActiveDocument())
  const [activeRibbon, setActiveRibbon] = useState<RibbonTab>('home')
  const [isRibbonOpen, setIsRibbonOpen] = useState(true)
  const [selectedElementType, setSelectedElementType] = useState<PresentationElementType | null>(
    null
  )
  const ribbonTabs = useMemo<RibbonTab[]>(
    () =>
      selectedElementType === 'image'
        ? [...BASE_RIBBON_TABS, 'picture']
        : selectedElementType === 'text'
          ? [...BASE_RIBBON_TABS, 'text']
          : BASE_RIBBON_TABS,
    [selectedElementType]
  )
  const effectiveActiveRibbon = ribbonTabs.includes(activeRibbon) ? activeRibbon : 'home'
  const activeRibbonIndex = Math.max(0, ribbonTabs.indexOf(effectiveActiveRibbon))

  useEffect(() => {
    if (!itemId) return
    const routeItemId = itemId
    let cancelled = false
    async function loadRouteDocument(): Promise<void> {
      await useFileExplorerStore.getState().initialize()
      const db = await openFileExplorerDB()
      const item = await db.get('folder-items', routeItemId)
      if (cancelled || !item || !isFileItem(item) || !isPresentationItem(item)) return
      openDocument(item)
    }
    void loadRouteDocument()
    return () => {
      cancelled = true
    }
  }, [itemId, openDocument])

  const handleRibbonTabClick = (tab: RibbonTab): void => {
    if (tab === activeRibbon) {
      setIsRibbonOpen((open) => !open)
      return
    }
    setActiveRibbon(tab)
    setIsRibbonOpen(true)
  }

  const getRibbonTabLabel = (tab: RibbonTab): string => {
    const fallbacks: Record<RibbonTab, string> = {
      home: '常用',
      insert: '插入',
      design: '設計',
      picture: '圖片格式',
      text: '文字格式'
    }
    return t(`presentationWorkspace.${tab}`, fallbacks[tab])
  }

  return (
    <WorkspaceShell className="bg-background text-foreground">
      <div className="relative flex h-10 shrink-0 items-end overflow-x-auto bg-background px-2 sm:px-4">
        {ribbonTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-selected={effectiveActiveRibbon === tab}
            className={`h-9 w-16 rounded-t-lg text-sm transition-colors ${
              effectiveActiveRibbon === tab
                ? 'bg-content1 text-foreground'
                : 'text-default-500 hover:bg-content1/60 hover:text-foreground'
            }`}
            onClick={() => handleRibbonTabClick(tab)}
          >
            {getRibbonTabLabel(tab)}
          </button>
        ))}
        <span
          className="pointer-events-none absolute bottom-0 left-4 z-10 h-1 w-16 bg-[#0ea5e9] transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${activeRibbonIndex * 64}px)` }}
        />
      </div>

      {activeDocument ? (
        activeDocument.mode === 'editable' ? (
          <EditableDocumentView
            deck={activeDocument}
            activeRibbon={effectiveActiveRibbon}
            isRibbonOpen={isRibbonOpen}
            onSelectedElementTypeChange={setSelectedElementType}
          />
        ) : (
          <PptxDocumentView deck={activeDocument} />
        )
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <FileText size={44} className="text-default-400" />
          <div>
            <p className="text-base font-semibold">{t('presentationWorkspace.emptyTitle')}</p>
            <p className="mt-1 text-sm text-default-400">
              {t('presentationWorkspace.emptyDescription')}
            </p>
          </div>
          <Button variant="tertiary" onPress={() => navigate('/files')}>
            {t('presentationWorkspace.backToFiles')}
          </Button>
        </div>
      )}
    </WorkspaceShell>
  )
}
