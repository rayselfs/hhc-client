import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  FileText,
  Home,
  ImagePlus,
  Minus,
  Palette,
  Play,
  Plus,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  X
} from 'lucide-react'
import { Button } from '@heroui/react/button'
import { Spinner } from '@heroui/react/spinner'
import { toast } from '@heroui/react/toast'
import EditableSlideSurface from '@renderer/components/Common/EditableSlideSurface'
import {
  addBlankEditableSlide,
  addElementToSlide,
  createLineElement,
  createShapeElement,
  createTextElement,
  duplicateEditableSlide,
  duplicateElementInSlide,
  loadEditablePresentation,
  moveEditableSlide,
  removeElementFromSlide,
  removeEditableSlide,
  saveEditablePresentation,
  updateElementInSlide,
  type EditableImageElement,
  type EditablePresentationDocument,
  type EditablePresentationElement,
  type EditableTextAlign,
  type EditableTextElement
} from '@renderer/lib/editable-presentation'
import { openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import { ensurePresentationPageDocument } from '@renderer/lib/presentation-page-document'
import { readPresentationArrayBuffer } from '@renderer/lib/presentation-source'
import { openPptxViewer, type PptxViewerHandle } from '@renderer/lib/pptx-renderer-service'
import { getPresentationWorkspacePath, isPresentationItem } from '@renderer/lib/presentation-media'
import { startMediaProjection } from '@renderer/lib/projection-actions'
import {
  usePresentationWorkspaceStore,
  type PresentationWorkspaceDocument
} from '@renderer/stores/presentation-workspace'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { isFileItem } from '@shared/types/folder'
import type { SlideHandle } from '@aiden0z/pptx-renderer'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'failed'

function RibbonButton({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}): React.JSX.Element {
  return (
    <button
      className="flex h-14 min-w-20 flex-col items-center justify-center gap-1 rounded-lg px-3 text-xs text-default-500 transition-colors hover:bg-content2 hover:text-foreground"
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
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
      width: 112
    })
    return () => {
      handle?.dispose()
      container.innerHTML = ''
    }
  }, [index, isVisible, viewer])

  return (
    <button
      className={`flex w-full gap-3 rounded-xl border p-2 text-left transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-foreground'
          : 'border-transparent bg-content1/40 text-default-500 hover:bg-content2'
      }`}
      onClick={onSelect}
    >
      <span className="w-6 pt-1 text-right text-xs tabular-nums">{index + 1}</span>
      <span
        ref={containerRef}
        className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-md bg-white shadow-sm"
      />
    </button>
  )
}

function PptxDocumentView({ deck }: { deck: PresentationWorkspaceDocument }): React.JSX.Element {
  const { t } = useTranslation()
  const setSlideCount = usePresentationWorkspaceStore((state) => state.setSlideCount)
  const setActiveSlide = usePresentationWorkspaceStore((state) => state.setActiveSlide)
  const activeSlide = usePresentationWorkspaceStore((state) => state.getActiveSlide(deck.itemId))
  const deckItemId = deck.itemId
  const deckMimeType = deck.mimeType
  const deckUrl = deck.url
  const canvasRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<PptxViewerHandle | null>(null)
  const [viewer, setViewer] = useState<PptxViewerHandle | null>(null)
  const [status, setStatus] = useState<LoadStatus>('idle')
  const [error, setError] = useState<string | null>(null)

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
  }, [deckItemId, deckMimeType, deckUrl, setSlideCount])

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
  const canGoPrev = activeSlide > 0
  const canGoNext = activeSlide < slideIndexes.length - 1

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_280px] bg-background">
      <aside className="min-h-0 overflow-y-auto border-r border-divider bg-content1/40 p-3">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-default-400">
          {t('presentationWorkspace.slides')}
        </div>
        <div className="space-y-2">
          {viewer &&
            slideIndexes.map((index) => (
              <SlideThumbnail
                key={index}
                viewer={viewer}
                index={index}
                active={index === activeSlide}
                onSelect={() => setActiveSlide(deck.itemId, index)}
              />
            ))}
        </div>
      </aside>

      <main className="flex min-h-0 flex-col bg-[#111217]">
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
        <div className="flex h-14 items-center justify-center gap-3 border-t border-divider bg-content1/70">
          <Button
            isIconOnly
            size="sm"
            variant="tertiary"
            isDisabled={!canGoPrev}
            onPress={() => setActiveSlide(deck.itemId, activeSlide - 1)}
            aria-label={t('presentationWorkspace.previousSlide')}
          >
            <ChevronLeft size={18} />
          </Button>
          <span className="min-w-24 text-center text-sm tabular-nums text-default-500">
            {slideIndexes.length === 0 ? '0 / 0' : `${activeSlide + 1} / ${slideIndexes.length}`}
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="tertiary"
            isDisabled={!canGoNext}
            onPress={() => setActiveSlide(deck.itemId, activeSlide + 1)}
            aria-label={t('presentationWorkspace.nextSlide')}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </main>

      <aside className="min-h-0 overflow-y-auto border-l border-divider bg-content1/40 p-4">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-default-400">
          {t('presentationWorkspace.inspector')}
        </div>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-default-400">{t('presentationWorkspace.fileName')}</dt>
            <dd className="mt-1 break-words text-foreground">{deck.name}</dd>
          </div>
          <div>
            <dt className="text-default-400">{t('presentationWorkspace.slideCount')}</dt>
            <dd className="mt-1 text-foreground">{slideIndexes.length || '—'}</dd>
          </div>
          <div>
            <dt className="text-default-400">{t('presentationWorkspace.dimensions')}</dt>
            <dd className="mt-1 text-foreground">
              {viewer
                ? `${Math.round(viewer.slideWidth)} × ${Math.round(viewer.slideHeight)}`
                : '—'}
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  )
}

function EditableDocumentView({
  deck
}: {
  deck: PresentationWorkspaceDocument
}): React.JSX.Element {
  const { t } = useTranslation()
  const setSlideCount = usePresentationWorkspaceStore((state) => state.setSlideCount)
  const setActiveSlide = usePresentationWorkspaceStore((state) => state.setActiveSlide)
  const activeSlideIndex = usePresentationWorkspaceStore((state) =>
    state.getActiveSlide(deck.itemId)
  )
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [document, setDocument] = useState<EditablePresentationDocument | null>(null)
  const [past, setPast] = useState<EditablePresentationDocument[]>([])
  const [future, setFuture] = useState<EditablePresentationDocument[]>([])
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [copiedElement, setCopiedElement] = useState<EditablePresentationElement | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadDocument(): Promise<void> {
      await Promise.resolve()
      if (cancelled) return
      setStatus('loading')
      setError(null)
      await loadEditablePresentation({ id: deck.itemId, url: deck.url, name: deck.name })
        .then((loadedDocument) => {
          if (cancelled) return
          setDocument(loadedDocument)
          setSlideCount(deck.itemId, loadedDocument.slideOrder.length)
          setStatus('ready')
        })
        .catch((loadError) => {
          if (cancelled) return
          setStatus('failed')
          setError(loadError instanceof Error ? loadError.message : String(loadError))
        })
    }
    void loadDocument()
    return () => {
      cancelled = true
    }
  }, [deck.itemId, deck.name, deck.url, setSlideCount])

  const activeSlideId =
    document?.slideOrder[Math.min(activeSlideIndex, Math.max(0, document.slideOrder.length - 1))]
  const activeSlide = activeSlideId ? document?.slides[activeSlideId] : null
  const selectedElement =
    activeSlide && selectedElementId ? activeSlide.elements[selectedElementId] : null

  const commitDocument = (nextDocument: EditablePresentationDocument): void => {
    if (!document) return
    setPast((items) => [...items.slice(-29), document])
    setFuture([])
    setDocument(nextDocument)
    setSlideCount(deck.itemId, nextDocument.slideOrder.length)
    void saveEditablePresentation({ id: deck.itemId, url: deck.url }, nextDocument).catch(
      (saveError) => {
        toast.danger(saveError instanceof Error ? saveError.message : String(saveError))
      }
    )
  }

  const updateSelectedElement = (updates: Partial<EditablePresentationElement>): void => {
    if (!document || !activeSlideId || !selectedElementId) return
    commitDocument(updateElementInSlide(document, activeSlideId, selectedElementId, updates))
  }

  const updateActiveSlideBackground = (color: string): void => {
    if (!document || !activeSlideId || !activeSlide) return
    commitDocument({
      ...document,
      slides: {
        ...document.slides,
        [activeSlideId]: {
          ...activeSlide,
          background: { type: 'color', color }
        }
      },
      updatedAt: Date.now()
    })
  }

  const addElement = (element: EditablePresentationElement): void => {
    if (!document || !activeSlideId) return
    commitDocument(addElementToSlide(document, activeSlideId, element))
    setSelectedElementId(element.id)
  }

  const addSlide = (): void => {
    if (!document) return
    const nextDocument = addBlankEditableSlide(document)
    commitDocument(nextDocument)
    setActiveSlide(deck.itemId, nextDocument.slideOrder.length - 1)
    setSelectedElementId(null)
  }

  const duplicateSlide = (): void => {
    if (!document || !activeSlideId) return
    const nextDocument = duplicateEditableSlide(document, activeSlideId)
    commitDocument(nextDocument)
    setActiveSlide(deck.itemId, nextDocument.slideOrder.indexOf(activeSlideId) + 1)
    setSelectedElementId(null)
  }

  const deleteSlide = (): void => {
    if (!document || !activeSlideId || document.slideOrder.length <= 1) return
    const nextIndex = Math.max(0, activeSlideIndex - 1)
    commitDocument(removeEditableSlide(document, activeSlideId))
    setActiveSlide(deck.itemId, nextIndex)
    setSelectedElementId(null)
  }

  const moveSlide = (direction: -1 | 1): void => {
    if (!document || !activeSlideId) return
    const nextDocument = moveEditableSlide(document, activeSlideId, direction)
    commitDocument(nextDocument)
    setActiveSlide(deck.itemId, nextDocument.slideOrder.indexOf(activeSlideId))
  }

  const duplicateElement = (): void => {
    if (!document || !activeSlideId || !selectedElementId) return
    const result = duplicateElementInSlide(document, activeSlideId, selectedElementId)
    commitDocument(result.document)
    setSelectedElementId(result.elementId)
  }

  const deleteElement = (): void => {
    if (!document || !activeSlideId || !selectedElementId) return
    commitDocument(removeElementFromSlide(document, activeSlideId, selectedElementId))
    setSelectedElementId(null)
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
  }

  const undo = (): void => {
    const previous = past[past.length - 1]
    if (!document || !previous) return
    setPast((items) => items.slice(0, -1))
    setFuture((items) => [document, ...items])
    setDocument(previous)
    void saveEditablePresentation({ id: deck.itemId, url: deck.url }, previous)
  }

  const redo = (): void => {
    const next = future[0]
    if (!document || !next) return
    setFuture((items) => items.slice(1))
    setPast((items) => [...items.slice(-29), document])
    setDocument(next)
    void saveEditablePresentation({ id: deck.itemId, url: deck.url }, next)
  }

  const addImage = async (file: File): Promise<void> => {
    if (!document || !activeSlideId) return
    const dataUrl = await readFileAsDataUrl(file)
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
    const element: EditableImageElement = {
      id: crypto.randomUUID(),
      type: 'image',
      assetId,
      x: 320,
      y: 220,
      width: 640,
      height: 360,
      rotation: 0,
      opacity: 1
    }
    commitDocument(addElementToSlide(nextDocument, activeSlideId, element))
    setSelectedElementId(element.id)
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (status === 'failed' || !document || !activeSlideId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <FileText className="text-danger" size={36} />
        <p className="text-sm font-semibold text-danger">{t('presentationWorkspace.loadFailed')}</p>
        {error && <p className="max-w-lg text-xs text-default-400">{error}</p>}
      </div>
    )
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)_280px] bg-background">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void addImage(file)
        }}
      />
      <aside className="min-h-0 overflow-y-auto border-r border-divider bg-content1/40 p-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-default-400">
            {t('presentationWorkspace.slides')}
          </span>
          <Button isIconOnly size="sm" variant="tertiary" onPress={addSlide} aria-label="Add slide">
            <Plus size={16} />
          </Button>
        </div>
        <div className="space-y-2">
          {document.slideOrder.map((slideId, index) => (
            <button
              key={slideId}
              className={`flex w-full gap-3 rounded-xl border p-2 text-left transition-colors ${
                index === activeSlideIndex
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-transparent bg-content1/40 text-default-500 hover:bg-content2'
              }`}
              onClick={() => {
                setActiveSlide(deck.itemId, index)
                setSelectedElementId(null)
              }}
            >
              <span className="w-6 pt-1 text-right text-xs tabular-nums">{index + 1}</span>
              <span className="flex h-16 w-28 overflow-hidden rounded-md bg-black shadow-sm">
                <EditableSlideSurface
                  document={document}
                  slideId={slideId}
                  className="pointer-events-none"
                />
              </span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex min-h-0 flex-col bg-[#111217]">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-divider bg-content1/70 px-3">
          <Button size="sm" variant="tertiary" onPress={undo} isDisabled={past.length === 0}>
            <Undo2 size={16} />
          </Button>
          <Button size="sm" variant="tertiary" onPress={redo} isDisabled={future.length === 0}>
            <Redo2 size={16} />
          </Button>
          <span className="mx-1 h-6 w-px bg-divider" />
          <label className="flex items-center gap-2 rounded-lg px-2 text-xs text-default-500">
            <Palette size={16} />
            <input
              className="h-7 w-8 rounded bg-transparent"
              type="color"
              value={activeSlide?.background.color ?? '#111827'}
              onChange={(event) => updateActiveSlideBackground(event.currentTarget.value)}
              aria-label="Slide background"
            />
          </label>
          <span className="mx-1 h-6 w-px bg-divider" />
          <Button size="sm" variant="tertiary" onPress={() => addElement(createTextElement())}>
            <Type size={16} />
            {t('presentationWorkspace.text', 'Text')}
          </Button>
          <Button size="sm" variant="tertiary" onPress={() => imageInputRef.current?.click()}>
            <ImagePlus size={16} />
            {t('presentationWorkspace.image', 'Image')}
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => addElement(createShapeElement('rectangle'))}
          >
            <Square size={16} />
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => addElement(createShapeElement('ellipse'))}
          >
            <Circle size={16} />
          </Button>
          <Button size="sm" variant="tertiary" onPress={() => addElement(createLineElement())}>
            <Minus size={16} />
          </Button>
          <span className="mx-1 h-6 w-px bg-divider" />
          <Button size="sm" variant="tertiary" onPress={duplicateSlide}>
            <Copy size={16} />
            {t('presentationWorkspace.copyPage')}
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => moveSlide(-1)}
            isDisabled={activeSlideIndex <= 0}
          >
            {t('presentationWorkspace.moveSlideUp', 'Move Up')}
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => moveSlide(1)}
            isDisabled={activeSlideIndex >= document.slideOrder.length - 1}
          >
            {t('presentationWorkspace.moveSlideDown', 'Move Down')}
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            className="text-danger"
            onPress={deleteSlide}
            isDisabled={document.slideOrder.length <= 1}
          >
            <Trash2 size={16} />
          </Button>
          <span className="mx-1 h-6 w-px bg-divider" />
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={!selectedElement}
            onPress={() => selectedElement && setCopiedElement(selectedElement)}
          >
            {t('presentationWorkspace.copyElement', 'Copy Element')}
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            isDisabled={!selectedElement}
            onPress={duplicateElement}
          >
            <Copy size={16} />
          </Button>
          <Button size="sm" variant="tertiary" isDisabled={!copiedElement} onPress={pasteElement}>
            {t('presentationWorkspace.pasteElement', 'Paste')}
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            className="text-danger"
            isDisabled={!selectedElement}
            onPress={deleteElement}
          >
            {t('presentationWorkspace.deleteElement', 'Delete')}
          </Button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto p-8">
          <div className="w-full max-w-5xl rounded-2xl bg-black/30 p-4 shadow-2xl">
            <EditableSlideSurface
              document={document}
              slideId={activeSlideId}
              editable
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onUpdateElement={(slideId, elementId, updates) =>
                commitDocument(updateElementInSlide(document, slideId, elementId, updates))
              }
            />
          </div>
        </div>
        <div className="flex h-14 items-center justify-center gap-3 border-t border-divider bg-content1/70">
          <Button
            isIconOnly
            size="sm"
            variant="tertiary"
            isDisabled={activeSlideIndex <= 0}
            onPress={() => setActiveSlide(deck.itemId, activeSlideIndex - 1)}
            aria-label={t('presentationWorkspace.previousSlide')}
          >
            <ChevronLeft size={18} />
          </Button>
          <span className="min-w-24 text-center text-sm tabular-nums text-default-500">
            {activeSlideIndex + 1} / {document.slideOrder.length}
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="tertiary"
            isDisabled={activeSlideIndex >= document.slideOrder.length - 1}
            onPress={() => setActiveSlide(deck.itemId, activeSlideIndex + 1)}
            aria-label={t('presentationWorkspace.nextSlide')}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
      </main>

      <aside className="min-h-0 overflow-y-auto border-l border-divider bg-content1/40 p-4">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wide text-default-400">
          {t('presentationWorkspace.inspector')}
        </div>
        <EditableInspector element={selectedElement} onUpdate={updateSelectedElement} />
      </aside>
    </div>
  )
}

function EditableInspector({
  element,
  onUpdate
}: {
  element: EditablePresentationElement | null
  onUpdate: (updates: Partial<EditablePresentationElement>) => void
}): React.JSX.Element {
  if (!element) {
    return <p className="text-sm text-default-400">Select an element to edit its properties.</p>
  }

  const updateNumber = (key: 'x' | 'y' | 'width' | 'height', value: string): void => {
    const next = Number(value)
    if (Number.isFinite(next)) onUpdate({ [key]: next } as Partial<EditablePresentationElement>)
  }

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        {(['x', 'y', 'width', 'height'] as const).map((key) => (
          <label key={key} className="space-y-1">
            <span className="text-xs uppercase text-default-400">{key}</span>
            <input
              className="h-9 w-full rounded-lg bg-content2 px-2 text-sm outline-none"
              type="number"
              value={Math.round(element[key])}
              onChange={(event) => updateNumber(key, event.currentTarget.value)}
            />
          </label>
        ))}
      </div>

      {element.type === 'text' && <TextInspector element={element} onUpdate={onUpdate} />}
      {element.type === 'shape' && (
        <div className="grid grid-cols-2 gap-2">
          <ColorInput
            label="Fill"
            value={element.fillColor}
            onChange={(fillColor) =>
              onUpdate({ fillColor } as Partial<EditablePresentationElement>)
            }
          />
          <ColorInput
            label="Stroke"
            value={element.strokeColor}
            onChange={(strokeColor) =>
              onUpdate({ strokeColor } as Partial<EditablePresentationElement>)
            }
          />
        </div>
      )}
      {element.type === 'line' && (
        <ColorInput
          label="Stroke"
          value={element.strokeColor}
          onChange={(strokeColor) =>
            onUpdate({ strokeColor } as Partial<EditablePresentationElement>)
          }
        />
      )}
    </div>
  )
}

function TextInspector({
  element,
  onUpdate
}: {
  element: EditableTextElement
  onUpdate: (updates: Partial<EditablePresentationElement>) => void
}): React.JSX.Element {
  return (
    <div className="space-y-3">
      <label className="space-y-1">
        <span className="text-xs uppercase text-default-400">Font family</span>
        <input
          className="h-9 w-full rounded-lg bg-content2 px-2 text-sm outline-none"
          value={element.fontFamily}
          onChange={(event) =>
            onUpdate({
              fontFamily: event.currentTarget.value || element.fontFamily
            } as Partial<EditablePresentationElement>)
          }
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase text-default-400">Font size</span>
        <input
          className="h-9 w-full rounded-lg bg-content2 px-2 text-sm outline-none"
          type="number"
          value={element.fontSize}
          onChange={(event) =>
            onUpdate({
              fontSize: Number(event.currentTarget.value) || element.fontSize
            } as Partial<EditablePresentationElement>)
          }
        />
      </label>
      <label className="space-y-1">
        <span className="text-xs uppercase text-default-400">Line height</span>
        <input
          className="h-9 w-full rounded-lg bg-content2 px-2 text-sm outline-none"
          type="number"
          step="0.05"
          min="0.7"
          value={element.lineHeight}
          onChange={(event) =>
            onUpdate({
              lineHeight: Number(event.currentTarget.value) || element.lineHeight
            } as Partial<EditablePresentationElement>)
          }
        />
      </label>
      <ColorInput
        label="Text color"
        value={element.color}
        onChange={(color) => onUpdate({ color } as Partial<EditablePresentationElement>)}
      />
      <div className="grid grid-cols-3 gap-1">
        {(['left', 'center', 'right'] as EditableTextAlign[]).map((align) => (
          <Button
            key={align}
            size="sm"
            variant={element.align === align ? 'primary' : 'tertiary'}
            onPress={() => onUpdate({ align } as Partial<EditablePresentationElement>)}
          >
            {align}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        <Button
          size="sm"
          variant={element.bold ? 'primary' : 'tertiary'}
          onPress={() => onUpdate({ bold: !element.bold } as Partial<EditablePresentationElement>)}
        >
          B
        </Button>
        <Button
          size="sm"
          variant={element.italic ? 'primary' : 'tertiary'}
          onPress={() =>
            onUpdate({ italic: !element.italic } as Partial<EditablePresentationElement>)
          }
        >
          I
        </Button>
        <Button
          size="sm"
          variant={element.underline ? 'primary' : 'tertiary'}
          onPress={() =>
            onUpdate({ underline: !element.underline } as Partial<EditablePresentationElement>)
          }
        >
          U
        </Button>
      </div>
    </div>
  )
}

function ColorInput({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <label className="space-y-1">
      <span className="text-xs uppercase text-default-400">{label}</span>
      <input
        className="h-9 w-full rounded-lg bg-content2 px-2"
        type="color"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

export default function PresentationWorkspacePage(): React.JSX.Element {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { itemId } = useParams()
  const documents = usePresentationWorkspaceStore((state) => state.documents)
  const activeItemId = usePresentationWorkspaceStore((state) => state.activeItemId)
  const openDocument = usePresentationWorkspaceStore((state) => state.openDocument)
  const closeDocument = usePresentationWorkspaceStore((state) => state.closeDocument)
  const setActiveDocument = usePresentationWorkspaceStore((state) => state.setActiveDocument)
  const activeDocument = usePresentationWorkspaceStore((state) => state.getActiveDocument())

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

  const handleActivate = (targetItemId: string): void => {
    setActiveDocument(targetItemId)
    navigate(getPresentationWorkspacePath(targetItemId))
  }

  const handleClose = (targetItemId: string): void => {
    closeDocument(targetItemId)
    const nextActiveItemId = usePresentationWorkspaceStore.getState().activeItemId
    navigate(nextActiveItemId ? getPresentationWorkspacePath(nextActiveItemId) : '/files')
  }

  const handlePresentActiveDocument = async (): Promise<void> => {
    if (!activeDocument) return
    const db = await openFileExplorerDB()
    const item = await db.get('folder-items', activeDocument.itemId)
    if (!item || !isFileItem(item) || !isPresentationItem(item)) return
    const slideIndex = usePresentationWorkspaceStore.getState().getActiveSlide(item.id)
    const report = await startMediaProjection(
      [item],
      0,
      { onNoProjectableFiles: () => toast.warning(t('fileExplorer.noProjectableFiles')) },
      { prioritizeStartItem: true }
    )
    if (report.summary.ready > 0) {
      useMediaProjectionStore.getState().setTypeState('presentation', {
        slideIndex,
        slideCount: activeDocument.slideCount
      })
    }
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="flex h-20 shrink-0 items-center gap-2 border-b border-divider bg-content1/80 px-4">
        <div className="mr-4">
          <p className="text-sm font-semibold">{t('presentationWorkspace.title')}</p>
          <p className="text-xs text-default-400">{t('presentationWorkspace.subtitle')}</p>
        </div>
        <RibbonButton icon={<Home size={18} />} label={t('presentationWorkspace.home')} />
        <RibbonButton icon={<ImagePlus size={18} />} label={t('presentationWorkspace.insert')} />
        <RibbonButton icon={<Palette size={18} />} label={t('presentationWorkspace.design')} />
        <RibbonButton
          icon={<Play size={18} />}
          label={t('presentationWorkspace.present')}
          onClick={() => void handlePresentActiveDocument()}
        />
        <RibbonButton icon={<Copy size={18} />} label={t('presentationWorkspace.copyPage')} />
      </div>

      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-divider bg-content1 px-3">
        {documents.map((deck) => (
          <div
            key={deck.itemId}
            role="button"
            tabIndex={0}
            className={`flex h-8 max-w-56 items-center gap-2 rounded-lg px-3 text-sm ${
              deck.itemId === activeItemId
                ? 'bg-primary text-primary-foreground'
                : 'bg-content2 text-default-500 hover:text-foreground'
            }`}
            onClick={() => handleActivate(deck.itemId)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleActivate(deck.itemId)
              }
            }}
          >
            <span className="truncate">{deck.name}</span>
            <button
              type="button"
              className="rounded p-0.5 hover:bg-black/10"
              onClick={(event) => {
                event.stopPropagation()
                handleClose(deck.itemId)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  handleClose(deck.itemId)
                }
              }}
              aria-label={t('presentationWorkspace.closeTab')}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {activeDocument ? (
        activeDocument.mode === 'editable' ? (
          <EditableDocumentView deck={activeDocument} />
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
    </div>
  )
}
