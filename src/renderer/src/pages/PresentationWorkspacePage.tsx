import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Home,
  ImagePlus,
  Palette,
  Play,
  X
} from 'lucide-react'
import { Button } from '@heroui/react/button'
import { Spinner } from '@heroui/react/spinner'
import { getBlobId } from '@renderer/lib/blob-identity'
import { getFileSource, openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import { ensurePresentationPageDocument } from '@renderer/lib/presentation-page-document'
import { openPptxViewer, type PptxViewerHandle } from '@renderer/lib/pptx-renderer-service'
import { getPresentationWorkspacePath, isPresentationItem } from '@renderer/lib/presentation-media'
import {
  usePresentationWorkspaceStore,
  type PresentationWorkspaceDocument
} from '@renderer/stores/presentation-workspace'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { isFileItem } from '@shared/types/folder'
import type { SlideHandle } from '@aiden0z/pptx-renderer'

type LoadStatus = 'idle' | 'loading' | 'ready' | 'failed'

async function readPresentationBuffer(
  deck: Pick<PresentationWorkspaceDocument, 'itemId' | 'url' | 'mimeType'>
): Promise<ArrayBuffer> {
  const db = await openFileExplorerDB()
  const source = await getFileSource(
    db,
    getBlobId({ id: deck.itemId, url: deck.url }),
    deck.mimeType
  )
  if (!source) throw new Error('Presentation source is unavailable')
  try {
    const response = await fetch(source.url)
    if (!response.ok) throw new Error(`Failed to read presentation source: ${response.status}`)
    return response.arrayBuffer()
  } finally {
    source.revoke()
  }
}

function RibbonButton({
  icon,
  label
}: {
  icon: React.ReactNode
  label: string
}): React.JSX.Element {
  return (
    <button className="flex h-14 min-w-20 flex-col items-center justify-center gap-1 rounded-lg px-3 text-xs text-default-500 transition-colors hover:bg-content2 hover:text-foreground">
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

function PresentationDocumentView({
  deck
}: {
  deck: PresentationWorkspaceDocument
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
        const buffer = await readPresentationBuffer({
          itemId: deckItemId,
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
        <RibbonButton icon={<Play size={18} />} label={t('presentationWorkspace.present')} />
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
        <PresentationDocumentView deck={activeDocument} />
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
