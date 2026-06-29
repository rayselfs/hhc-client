import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Circle,
  FileText,
  ImagePlus,
  Minus,
  Palette,
  Plus,
  Redo2,
  Square,
  Type,
  Undo2,
  X
} from 'lucide-react'
import { Button } from '@heroui/react/button'
import { Spinner } from '@heroui/react/spinner'
import { toast } from '@heroui/react/toast'
import EditableSlideSurface from '@renderer/components/Common/EditableSlideSurface'
import { useContextMenu } from '@renderer/contexts/ContextMenuContext'
import {
  addElementToSlide,
  applySlideBackgroundToAllSlides,
  createLineElement,
  createShapeElement,
  createTextElement,
  DEFAULT_GRADIENT_BACKGROUND,
  duplicateEditableSlides,
  getSlideBackgroundPrimaryColor,
  insertBlankEditableSlide,
  loadEditablePresentation,
  normalizeSlideBackground,
  removeElementFromSlide,
  removeEditableSlides,
  resetSlideBackground,
  saveEditablePresentation,
  updateElementInSlide,
  updateSlideBackground,
  type EditableGradientDirection,
  type EditableImageElement,
  type EditablePresentationDocument,
  type EditablePresentationElement,
  type EditableSlideBackground,
  type EditableTextAlign
} from '@renderer/lib/editable-presentation'
import { openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import { ensurePresentationPageDocument } from '@renderer/lib/presentation-page-document'
import { readPresentationArrayBuffer } from '@renderer/lib/presentation-source'
import { openPptxViewer, type PptxViewerHandle } from '@renderer/lib/pptx-renderer-service'
import { isPresentationItem } from '@renderer/lib/presentation-media'
import {
  usePresentationWorkspaceStore,
  type PresentationWorkspaceDocument
} from '@renderer/stores/presentation-workspace'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { isFileItem } from '@shared/types/folder'
import type { SlideHandle } from '@aiden0z/pptx-renderer'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'failed'
type RibbonTab = 'home' | 'insert' | 'design'

const FONT_FAMILIES = ['Inter Variable', 'Noto Sans TC Variable', 'Noto Sans SC Variable', 'Arial']
const FONT_SIZES = [12, 14, 16, 18, 24, 32, 44, 56, 72, 96]
const RIBBON_TABS: RibbonTab[] = ['home', 'insert', 'design']
const NATIVE_CONTROL_CLASS =
  'presentation-native-control rounded-lg border border-divider bg-content2 px-3 text-sm text-foreground outline-none'
const RANGE_CLASS = 'presentation-range w-full'

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
      </main>
    </div>
  )
}

function EditableDocumentView({
  deck,
  activeRibbon,
  isRibbonOpen
}: {
  deck: PresentationWorkspaceDocument
  activeRibbon: RibbonTab
  isRibbonOpen: boolean
}): React.JSX.Element {
  const { t } = useTranslation()
  const { showMenu } = useContextMenu()
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
  const [copiedSlideIds, setCopiedSlideIds] = useState<string[]>([])
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(() => new Set())
  const [selectionAnchorIndex, setSelectionAnchorIndex] = useState(0)
  const [insertionIndex, setInsertionIndex] = useState<number | null>(null)
  const [isBackgroundPanelOpen, setIsBackgroundPanelOpen] = useState(false)
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

  const addElement = (element: EditablePresentationElement): void => {
    if (!document || !activeSlideId) return
    commitDocument(addElementToSlide(document, activeSlideId, element))
    setSelectedElementId(element.id)
  }

  const addSlide = (): void => {
    if (!document) return
    const result = insertBlankEditableSlide(document, document.slideOrder.length)
    commitDocument(result.document)
    setActiveSlide(deck.itemId, result.document.slideOrder.indexOf(result.slideId))
    setSelectedSlideIds(new Set([result.slideId]))
    setSelectedElementId(null)
  }

  const addSlideAfter = (index: number): void => {
    if (!document) return
    const result = insertBlankEditableSlide(document, index + 1)
    commitDocument(result.document)
    setActiveSlide(deck.itemId, index + 1)
    setSelectedSlideIds(new Set([result.slideId]))
    setSelectionAnchorIndex(index + 1)
    setSelectedElementId(null)
    setInsertionIndex(null)
  }

  const selectSlide = (index: number, event: React.MouseEvent | React.KeyboardEvent): void => {
    if (!document) return
    const slideId = document.slideOrder[index]
    if (!slideId) return

    if (event.shiftKey) {
      const start = Math.min(selectionAnchorIndex, index)
      const end = Math.max(selectionAnchorIndex, index)
      setSelectedSlideIds(new Set(document.slideOrder.slice(start, end + 1)))
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
      setSelectionAnchorIndex(index)
    } else {
      setSelectedSlideIds(new Set([slideId]))
      setSelectionAnchorIndex(index)
    }

    setActiveSlide(deck.itemId, index)
    setSelectedElementId(null)
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
    setActiveSlide(deck.itemId, result.document.slideOrder.indexOf(result.slideIds[0]))
    setInsertionIndex(null)
    setSelectedElementId(null)
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
    setActiveSlide(deck.itemId, nextIndex)
    setSelectedSlideIds(nextSlideId ? new Set([nextSlideId]) : new Set())
    setSelectedElementId(null)
    setInsertionIndex(null)
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
          <Button
            size="sm"
            variant={isBackgroundPanelOpen ? 'primary' : 'tertiary'}
            isDisabled={!activeSlide}
            onPress={() => setIsBackgroundPanelOpen(true)}
          >
            <Palette size={16} />
            {t('presentationWorkspace.formatBackground', 'Format Background')}
          </Button>
          <label className="flex items-center gap-2 text-default-500">
            <span>{t('presentationWorkspace.slideSize', 'Slide Size')}</span>
            <select
              className={`h-9 ${NATIVE_CONTROL_CLASS}`}
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
          className={`h-9 w-44 disabled:opacity-40 ${NATIVE_CONTROL_CLASS}`}
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
          className={`h-9 w-20 disabled:opacity-40 ${NATIVE_CONTROL_CLASS}`}
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
                className={`h-8 w-16 px-2 ${NATIVE_CONTROL_CLASS}`}
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
      const isSlideSidebar = Boolean(target?.closest('[data-slide-sidebar]'))
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
      <div
        className={`grid min-h-0 flex-1 ${
          isBackgroundPanelOpen
            ? 'grid-cols-[240px_minmax(0,1fr)_300px]'
            : 'grid-cols-[240px_minmax(0,1fr)]'
        }`}
      >
        <aside
          data-slide-sidebar
          className="min-h-0 overflow-y-auto border-r border-divider bg-content1/40 px-2 py-3"
          onContextMenu={showSlideSidebarMenu}
        >
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
                    className="group flex h-4 w-full items-center px-2"
                    onClick={() => setInsertionIndex(index)}
                    aria-label={`Insert before slide ${index + 1}`}
                  >
                    <span
                      className={`h-0.5 w-full rounded-full ${
                        insertionIndex === index
                          ? 'animate-pulse bg-primary'
                          : 'bg-transparent group-hover:bg-primary/40 group-focus-visible:bg-primary/60'
                      }`}
                    />
                  </button>
                  <button
                    className="flex w-full gap-2 rounded-xl px-1 py-2 text-left text-default-500 transition-colors hover:bg-content2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/60"
                    onClick={(event) => selectSlide(index, event)}
                    onKeyDown={(event) => {
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
                      className={`flex h-[99px] w-44 overflow-hidden border bg-black shadow-sm ${
                        isSelected ? 'border-primary ring-2 ring-primary/40' : 'border-transparent'
                      }`}
                    >
                      <EditableSlideSurface
                        document={document}
                        slideId={slideId}
                        className="pointer-events-none"
                      />
                    </span>
                  </button>
                </React.Fragment>
              )
            })}
            <button
              type="button"
              className="group flex h-4 w-full items-center px-2"
              onClick={() => setInsertionIndex(document.slideOrder.length)}
              aria-label="Insert after last slide"
            >
              <span
                className={`h-0.5 w-full rounded-full ${
                  insertionIndex === document.slideOrder.length
                    ? 'animate-pulse bg-primary'
                    : 'bg-transparent group-hover:bg-primary/40 group-focus-visible:bg-primary/60'
                }`}
              />
            </button>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col bg-[#111217]">
          <div className="flex flex-1 items-center justify-center overflow-auto p-8">
            <div className="w-full max-w-5xl">
              <EditableSlideSurface
                document={document}
                slideId={activeSlideId}
                editable
                showBorder
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onUpdateElement={(slideId, elementId, updates) =>
                  commitDocument(updateElementInSlide(document, slideId, elementId, updates))
                }
              />
            </div>
          </div>
        </main>
        {isBackgroundPanelOpen && activeSlide && (
          <FormatBackgroundPanel
            background={activeSlide.background}
            onChange={setActiveSlideBackground}
            onApplyToAll={applyActiveBackgroundToAllSlides}
            onReset={resetActiveSlideBackground}
            onClose={() => setIsBackgroundPanelOpen(false)}
          />
        )}
      </div>
    </div>
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
      <div className="relative flex h-10 shrink-0 items-end bg-background px-4">
        {RIBBON_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            aria-selected={activeRibbon === tab}
            className={`h-9 w-14 rounded-t-lg text-sm transition-colors ${
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
          className="pointer-events-none absolute bottom-0 left-4 z-10 h-1 w-14 bg-[#0ea5e9] transition-transform duration-200 ease-out"
          style={{ transform: `translateX(${activeRibbonIndex * 56}px)` }}
        />
      </div>

      {activeDocument ? (
        activeDocument.mode === 'editable' ? (
          <EditableDocumentView
            deck={activeDocument}
            activeRibbon={activeRibbon}
            isRibbonOpen={isRibbonOpen}
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
    </div>
  )
}
