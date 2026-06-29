import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  ImagePlus,
  Minus,
  Palette,
  Play,
  Plus,
  Redo2,
  Square,
  Type,
  Undo2
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
  loadEditablePresentation,
  removeElementFromSlide,
  removeEditableSlide,
  saveEditablePresentation,
  updateElementInSlide,
  type EditableImageElement,
  type EditablePresentationDocument,
  type EditablePresentationElement,
  type EditableTextAlign
} from '@renderer/lib/editable-presentation'
import { openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import { ensurePresentationPageDocument } from '@renderer/lib/presentation-page-document'
import { readPresentationArrayBuffer } from '@renderer/lib/presentation-source'
import { openPptxViewer, type PptxViewerHandle } from '@renderer/lib/pptx-renderer-service'
import { isPresentationItem } from '@renderer/lib/presentation-media'
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
type RibbonTab = 'home' | 'insert' | 'design'

const FONT_FAMILIES = ['Inter Variable', 'Noto Sans TC Variable', 'Noto Sans SC Variable', 'Arial']
const FONT_SIZES = [12, 14, 16, 18, 24, 32, 44, 56, 72, 96]
const RIBBON_TABS: RibbonTab[] = ['home', 'insert', 'design']

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

function PptxDocumentView({
  deck,
  onPresent
}: {
  deck: PresentationWorkspaceDocument
  onPresent: () => void
}): React.JSX.Element {
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
    <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] bg-background">
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
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center border-t border-divider bg-content1/70 px-4">
          <span />
          <div className="flex items-center justify-center gap-3">
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
          <div className="flex justify-end">
            <Button
              isIconOnly
              variant="primary"
              onPress={onPresent}
              aria-label={t('presentationWorkspace.present')}
            >
              <Play size={18} />
            </Button>
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
  onPresent
}: {
  deck: PresentationWorkspaceDocument
  activeRibbon: RibbonTab
  isRibbonOpen: boolean
  onPresent: () => void
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
  const [copiedSlideId, setCopiedSlideId] = useState<string | null>(null)
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)
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

  const duplicateSlideAt = (sourceSlideId: string, targetIndex: number): void => {
    if (!document) return
    const sourceIndex = document.slideOrder.indexOf(sourceSlideId)
    if (sourceIndex === -1) return
    const duplicated = duplicateEditableSlide(document, sourceSlideId)
    const newSlideId = duplicated.slideOrder[sourceIndex + 1]
    if (!newSlideId) return
    const slideOrderWithoutNew = duplicated.slideOrder.filter((slideId) => slideId !== newSlideId)
    const safeIndex = Math.max(0, Math.min(targetIndex, slideOrderWithoutNew.length))
    const slideOrder = [
      ...slideOrderWithoutNew.slice(0, safeIndex),
      newSlideId,
      ...slideOrderWithoutNew.slice(safeIndex)
    ]
    commitDocument({ ...duplicated, slideOrder, updatedAt: Date.now() })
    setActiveSlide(deck.itemId, safeIndex)
    setSelectedElementId(null)
  }

  const pasteSlide = (): void => {
    if (!copiedSlideId || !document) return
    duplicateSlideAt(copiedSlideId, insertionIndex ?? activeSlideIndex + 1)
    setInsertionIndex(null)
  }

  const deleteSlide = (): void => {
    if (!document || !activeSlideId || document.slideOrder.length <= 1) return
    const nextIndex = Math.max(0, activeSlideIndex - 1)
    commitDocument(removeEditableSlide(document, activeSlideId))
    setActiveSlide(deck.itemId, nextIndex)
    setSelectedElementId(null)
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

  const selectedTextElement = selectedElement?.type === 'text' ? selectedElement : null

  const updateSelectedNumber = (key: 'x' | 'y' | 'width' | 'height', value: string): void => {
    const next = Number(value)
    if (Number.isFinite(next))
      updateSelectedElement({ [key]: next } as Partial<EditablePresentationElement>)
  }

  const updateSlideSize = (value: string): void => {
    if (!document) return
    const [width, height] = value.split(':').map(Number)
    if (!width || !height) return
    commitDocument({ ...document, width, height, updatedAt: Date.now() })
  }

  const renderRibbon = (): React.JSX.Element => {
    if (activeRibbon === 'insert') {
      return (
        <div className="flex h-16 items-center gap-2 border-b border-divider bg-content1/80 px-4">
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
        </div>
      )
    }

    if (activeRibbon === 'design') {
      return (
        <div className="flex h-16 items-center gap-3 border-b border-divider bg-content1/80 px-4 text-sm">
          <label className="flex items-center gap-2 text-default-500">
            <Palette size={16} />
            <span>{t('presentationWorkspace.background', 'Background')}</span>
            <input
              className="h-8 w-10 rounded bg-transparent"
              type="color"
              value={activeSlide?.background.color ?? '#111827'}
              onChange={(event) => updateActiveSlideBackground(event.currentTarget.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-default-500">
            <span>{t('presentationWorkspace.slideSize', 'Slide Size')}</span>
            <select
              className="h-9 rounded-lg bg-content2 px-3 text-sm text-foreground outline-none"
              value={`${document?.width ?? 1920}:${document?.height ?? 1080}`}
              onChange={(event) => updateSlideSize(event.currentTarget.value)}
            >
              <option value="1920:1080">16:9</option>
              <option value="1440:1080">4:3</option>
            </select>
          </label>
        </div>
      )
    }

    return (
      <div className="flex h-16 items-center gap-2 border-b border-divider bg-content1/80 px-4">
        <Button size="sm" variant="tertiary" onPress={undo} isDisabled={past.length === 0}>
          <Undo2 size={16} />
        </Button>
        <Button size="sm" variant="tertiary" onPress={redo} isDisabled={future.length === 0}>
          <Redo2 size={16} />
        </Button>
        <span className="mx-1 h-8 w-px bg-divider" />
        <select
          className="h-9 w-44 rounded-lg bg-content2 px-3 text-sm text-foreground outline-none disabled:opacity-40"
          disabled={!selectedTextElement}
          value={selectedTextElement?.fontFamily ?? FONT_FAMILIES[0]}
          onChange={(event) =>
            updateSelectedElement({
              fontFamily: event.currentTarget.value
            } as Partial<EditablePresentationElement>)
          }
        >
          {FONT_FAMILIES.map((fontFamily) => (
            <option key={fontFamily} value={fontFamily}>
              {fontFamily}
            </option>
          ))}
        </select>
        <select
          className="h-9 w-20 rounded-lg bg-content2 px-3 text-sm text-foreground outline-none disabled:opacity-40"
          disabled={!selectedTextElement}
          value={selectedTextElement?.fontSize ?? 44}
          onChange={(event) =>
            updateSelectedElement({
              fontSize: Number(event.currentTarget.value)
            } as Partial<EditablePresentationElement>)
          }
        >
          {FONT_SIZES.map((fontSize) => (
            <option key={fontSize} value={fontSize}>
              {fontSize}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant={selectedTextElement?.bold ? 'primary' : 'tertiary'}
          isDisabled={!selectedTextElement}
          onPress={() =>
            selectedTextElement &&
            updateSelectedElement({
              bold: !selectedTextElement.bold
            } as Partial<EditablePresentationElement>)
          }
        >
          B
        </Button>
        <Button
          size="sm"
          variant={selectedTextElement?.italic ? 'primary' : 'tertiary'}
          isDisabled={!selectedTextElement}
          onPress={() =>
            selectedTextElement &&
            updateSelectedElement({
              italic: !selectedTextElement.italic
            } as Partial<EditablePresentationElement>)
          }
        >
          I
        </Button>
        <Button
          size="sm"
          variant={selectedTextElement?.underline ? 'primary' : 'tertiary'}
          isDisabled={!selectedTextElement}
          onPress={() =>
            selectedTextElement &&
            updateSelectedElement({
              underline: !selectedTextElement.underline
            } as Partial<EditablePresentationElement>)
          }
        >
          U
        </Button>
        <input
          className="h-8 w-10 rounded bg-transparent disabled:opacity-40"
          type="color"
          disabled={!selectedTextElement}
          value={selectedTextElement?.color ?? '#ffffff'}
          onChange={(event) =>
            updateSelectedElement({
              color: event.currentTarget.value
            } as Partial<EditablePresentationElement>)
          }
        />
        {(['left', 'center', 'right'] as EditableTextAlign[]).map((align) => (
          <Button
            key={align}
            size="sm"
            variant={selectedTextElement?.align === align ? 'primary' : 'tertiary'}
            isDisabled={!selectedTextElement}
            onPress={() => updateSelectedElement({ align } as Partial<EditablePresentationElement>)}
          >
            {align}
          </Button>
        ))}
        <span className="mx-1 h-8 w-px bg-divider" />
        {selectedElement &&
          (['x', 'y', 'width', 'height'] as const).map((key) => (
            <label key={key} className="flex items-center gap-1 text-xs uppercase text-default-400">
              {key}
              <input
                className="h-8 w-16 rounded-lg bg-content2 px-2 text-sm text-foreground outline-none"
                type="number"
                value={Math.round(selectedElement[key])}
                onChange={(event) => updateSelectedNumber(key, event.currentTarget.value)}
              />
            </label>
          ))}
      </div>
    )
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      const isEditingText =
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'SELECT' ||
        target?.tagName === 'TEXTAREA'
      if (isEditingText) return

      const command = event.metaKey || event.ctrlKey
      if (command && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        if (selectedElement) {
          setCopiedElement(selectedElement)
          setCopiedSlideId(null)
        } else if (activeSlideId) {
          setCopiedSlideId(activeSlideId)
          setCopiedElement(null)
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
        } else if (document && document.slideOrder.length > 1) {
          event.preventDefault()
          deleteSlide()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

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
    <div className="flex min-h-0 flex-1 flex-col bg-background">
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
      <div
        className={`shrink-0 overflow-hidden transition-[height,opacity] duration-200 ${
          isRibbonOpen ? 'h-16 opacity-100' : 'h-0 opacity-0'
        }`}
      >
        {renderRibbon()}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r border-divider bg-content1/40 p-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-default-400">
              {t('presentationWorkspace.slides')}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="tertiary"
              onPress={addSlide}
              aria-label="Add slide"
            >
              <Plus size={16} />
            </Button>
          </div>
          <div className="space-y-1">
            {document.slideOrder.map((slideId, index) => (
              <React.Fragment key={slideId}>
                <button
                  type="button"
                  className="flex h-4 w-full items-center px-2"
                  onClick={() => setInsertionIndex(index)}
                  aria-label={`Insert before slide ${index + 1}`}
                >
                  <span
                    className={`h-0.5 w-full rounded-full ${
                      insertionIndex === index ? 'bg-primary' : 'bg-transparent hover:bg-primary/40'
                    }`}
                  />
                </button>
                <button
                  className={`flex w-full gap-3 rounded-xl border p-2 text-left transition-colors ${
                    index === activeSlideIndex
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-transparent bg-content1/40 text-default-500 hover:bg-content2'
                  }`}
                  onClick={() => {
                    setActiveSlide(deck.itemId, index)
                    setSelectedElementId(null)
                    setInsertionIndex(null)
                  }}
                >
                  <span className="w-6 pt-1 text-right text-xs tabular-nums">{index + 1}</span>
                  <span className="flex h-[90px] w-40 overflow-hidden rounded-md bg-black shadow-sm">
                    <EditableSlideSurface
                      document={document}
                      slideId={slideId}
                      className="pointer-events-none"
                    />
                  </span>
                </button>
              </React.Fragment>
            ))}
            <button
              type="button"
              className="flex h-4 w-full items-center px-2"
              onClick={() => setInsertionIndex(document.slideOrder.length)}
              aria-label="Insert after last slide"
            >
              <span
                className={`h-0.5 w-full rounded-full ${
                  insertionIndex === document.slideOrder.length
                    ? 'bg-primary'
                    : 'bg-transparent hover:bg-primary/40'
                }`}
              />
            </button>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col bg-[#111217]">
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
          <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center border-t border-divider bg-content1/70 px-4">
            <span />
            <div className="flex items-center justify-center gap-3">
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
            <div className="flex justify-end">
              <Button
                isIconOnly
                variant="primary"
                onPress={onPresent}
                aria-label={t('presentationWorkspace.present')}
              >
                <Play size={18} />
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
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
  const openDocument = usePresentationWorkspaceStore((state) => state.openDocument)
  const activeDocument = usePresentationWorkspaceStore((state) => state.getActiveDocument())
  const [activeRibbon, setActiveRibbon] = useState<RibbonTab>('home')
  const [isRibbonOpen, setIsRibbonOpen] = useState(true)
  const activeRibbonIndex = RIBBON_TABS.indexOf(activeRibbon)

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

  const handleRibbonTabClick = (tab: RibbonTab): void => {
    if (tab === activeRibbon) {
      setIsRibbonOpen((open) => !open)
      return
    }
    setActiveRibbon(tab)
    setIsRibbonOpen(true)
  }

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="relative flex h-10 shrink-0 items-end gap-1 bg-background px-4">
        {RIBBON_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`h-9 w-20 rounded-t-lg text-sm transition-colors ${
              activeRibbon === tab
                ? 'bg-content1 text-foreground'
                : 'text-default-500 hover:bg-content1/60 hover:text-foreground'
            }`}
            onClick={() => handleRibbonTabClick(tab)}
          >
            {t(`presentationWorkspace.${tab}`)}
          </button>
        ))}
        <span
          className="absolute bottom-0 left-8 h-0.5 w-12 rounded-full bg-primary transition-transform duration-200"
          style={{ transform: `translateX(${activeRibbonIndex * 84}px)` }}
        />
      </div>

      {activeDocument ? (
        activeDocument.mode === 'editable' ? (
          <EditableDocumentView
            deck={activeDocument}
            activeRibbon={activeRibbon}
            isRibbonOpen={isRibbonOpen}
            onPresent={() => void handlePresentActiveDocument()}
          />
        ) : (
          <PptxDocumentView
            deck={activeDocument}
            onPresent={() => void handlePresentActiveDocument()}
          />
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
