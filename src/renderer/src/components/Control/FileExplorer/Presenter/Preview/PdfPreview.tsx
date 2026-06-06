import React, { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@heroui/react/toast'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, AlignJustify, Maximize2 } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { FileItemRecord } from '@shared/types/folder'
import { openFileExplorerDB, getFileBlob } from '@renderer/lib/file-explorer-db'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { usePresenterCommands } from '@renderer/contexts/PresenterCommandContext'
import { usePreviewCacheContext } from '@renderer/contexts/PreviewCacheContext'

interface PdfPreviewProps {
  item: FileItemRecord
}

import { loadPdfjsLib } from '@renderer/lib/pdfjs-loader'

async function renderPage(
  pdf: PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale = 1.5
): Promise<void> {
  const page = await pdf.getPage(pageNum)
  const viewport = page.getViewport({ scale })
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  try {
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
  } catch (e) {
    if ((e as { name?: string })?.name === 'RenderingCancelledException') return
    throw e
  }
}

export default function PdfPreview({ item }: PdfPreviewProps): React.JSX.Element {
  const { t } = useTranslation()
  const { sendCommand } = usePresenterCommands()
  const { pdfPageThumbs } = usePreviewCacheContext()
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const slideCanvasRef = useRef<HTMLCanvasElement>(null)
  const scrollCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const thumbButtonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const pdfViewMode = useMediaProjectionStore((s) => s.typeStates['pdf']?.viewMode ?? 'slide')
  const thumbsCollapsed = useMediaProjectionStore((s) => s.typeStates['pdf']?.thumbsCollapsed ?? false)
  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)
  const pan = useMediaProjectionStore((s) => s.pan)

  const thumbs = pdfPageThumbs[item.id] ?? []

  const setPdfState = useCallback(
    (partial: Partial<{ viewMode: 'slide' | 'scroll'; thumbsCollapsed: boolean }>) => {
      const current = useMediaProjectionStore.getState().typeStates['pdf']
      useMediaProjectionStore.getState().setTypeState('pdf', {
        viewMode: current?.viewMode ?? 'slide',
        thumbsCollapsed: current?.thumbsCollapsed ?? false,
        ...partial
      })
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null
    let doc: PDFDocumentProxy | null = null

    async function load(): Promise<void> {
      setLoading(true)
      setError(false)
      try {
        const db = await openFileExplorerDB()
        const blob = await getFileBlob(db, item.id)
        if (cancelled || !blob) {
          if (!cancelled) {
            setError(true)
            setLoading(false)
            toast.warning(t('fileExplorer.blobLoadFailed'))
            const store = useMediaProjectionStore.getState()
            if (store.canNext()) {
              store.next()
            } else {
              store.exit()
            }
          }
          return
        }

        objectUrl = URL.createObjectURL(blob)
        const pdfjsLib = await loadPdfjsLib()
        const pdf = await pdfjsLib.getDocument(objectUrl).promise
        if (cancelled) {
          pdf.destroy()
          return
        }
        doc = pdf
        setPdfDoc(pdf)
        setPageCount(pdf.numPages)
        setCurrentPage(1)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setError(true)
          setLoading(false)
          toast.warning(t('fileExplorer.blobLoadFailed'))
          const store = useMediaProjectionStore.getState()
          if (store.canNext()) {
            store.next()
          } else {
            store.exit()
          }
        }
      }
    }

    void load()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      if (doc) doc.destroy()
      setPdfDoc(null)
    }
  }, [item.id, t])

  useEffect(() => {
    if (!pdfDoc || pdfViewMode !== 'slide') return
    const canvas = slideCanvasRef.current
    if (!canvas) return
    let cancelled = false

    void renderPage(pdfDoc, currentPage, canvas).then(() => {
      if (cancelled) return
    })

    return () => {
      cancelled = true
    }
  }, [pdfDoc, currentPage, pdfViewMode])

  const renderedPagesRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!pdfDoc || pdfViewMode !== 'scroll') return

    renderedPagesRef.current = new Set()

    const firstCanvas = scrollCanvasRefs.current[0]
    if (firstCanvas) {
      renderedPagesRef.current.add(0)
      void renderPage(pdfDoc, 1, firstCanvas)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const canvas = entry.target as HTMLCanvasElement
            const pageIndex = Number(canvas.dataset.pageIndex)
            if (!renderedPagesRef.current.has(pageIndex)) {
              renderedPagesRef.current.add(pageIndex)
              void renderPage(pdfDoc!, pageIndex + 1, canvas)
            }
            observer.unobserve(canvas)
          }
        }
      },
      { rootMargin: '200px' }
    )

    scrollCanvasRefs.current.forEach((canvas) => {
      if (canvas) observer.observe(canvas)
    })

    return () => observer.disconnect()
  }, [pdfDoc, pdfViewMode, pageCount])

  useEffect(() => {
    const handleNext = (): void => {
      setCurrentPage((p) => {
        const next = Math.min(p + 1, pageCount)
        sendCommand({ action: 'pdfPage', value: next })
        return next
      })
    }
    const handlePrev = (): void => {
      setCurrentPage((p) => {
        const prev = Math.max(p - 1, 1)
        sendCommand({ action: 'pdfPage', value: prev })
        return prev
      })
    }
    window.addEventListener('media:pdfNextPage', handleNext)
    window.addEventListener('media:pdfPrevPage', handlePrev)
    return () => {
      window.removeEventListener('media:pdfNextPage', handleNext)
      window.removeEventListener('media:pdfPrevPage', handlePrev)
    }
  }, [pageCount, sendCommand])

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const el = scrollContainerRef.current
      const canvases = scrollCanvasRefs.current
      if (!el || !canvases.length) return
      const containerTop = el.getBoundingClientRect().top
      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i]
        if (!canvas) continue
        const rect = canvas.getBoundingClientRect()
        if (rect.bottom > containerTop && rect.height > 0) {
          const fraction = Math.max(0, (containerTop - rect.top)) / rect.height
          sendCommand({ action: 'pdfScroll', value: i + fraction })
          return
        }
      }
      sendCommand({ action: 'pdfScroll', value: Math.max(0, canvases.length - 1) })
    })
  }, [sendCommand])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    if (thumbsCollapsed) return
    const el = thumbButtonRefs.current[currentPage - 1]
    if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [currentPage, thumbsCollapsed])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-foreground/50">
        {t('presenter.loading')}
      </div>
    )
  }

  if (error || !pdfDoc) {
    return (
      <div className="w-full h-full flex items-center justify-center text-foreground/50">
        {t('presenter.pdfLoadFailed')}
      </div>
    )
  }

  if (pdfViewMode === 'scroll') {
    return (
      <div className="w-full h-full relative bg-black">
        <div
          ref={scrollContainerRef}
          className="w-full h-full overflow-y-auto flex flex-col items-center gap-4 py-4"
          onScroll={handleScroll}
        >
          {Array.from({ length: pageCount }, (_, i) => (
            <canvas
              key={i + 1}
              ref={(el) => {
                scrollCanvasRefs.current[i] = el
              }}
              data-page-index={i}
              style={{ maxWidth: '100%' }}
            />
          ))}
        </div>
        <div className="absolute bottom-2 left-2 z-20" onMouseDown={(e) => e.stopPropagation()}>
          <button
            className="inline-flex items-center rounded-full p-2 pdf-sidebar-bg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => {
              setPdfState({ viewMode: 'slide' })
              sendCommand({ action: 'pdfViewMode', value: 'single' })
            }}
          >
            <Maximize2 size={20} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          transform:
            zoomLevel !== 1
              ? `scale(${zoomLevel}) translate(${(pan.x / zoomLevel) * 100}%, ${(pan.y / zoomLevel) * 100}%)`
              : undefined,
          transformOrigin: 'center center',
          transition: 'transform 0.15s ease'
        }}
      >
        <canvas
          ref={slideCanvasRef}
          style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }}
        />
      </div>

      <div
        className="absolute top-0 left-0 bottom-0 z-20 overflow-hidden"
        style={{ width: '25%', pointerEvents: thumbsCollapsed ? 'none' : 'auto' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="w-full h-full flex flex-col pdf-sidebar-bg rounded-tr-xl rounded-br-xl transition-transform duration-200 ease-in-out"
          style={{ transform: thumbsCollapsed ? 'translateX(-100%)' : 'translateX(0)' }}
        >
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 p-4">
            {thumbs.map((url, i) => (
              <button
                key={i}
                ref={(el) => {
                  thumbButtonRefs.current[i] = el
                }}
                className={`relative rounded overflow-hidden border-2 transition-colors shrink-0 ${
                  currentPage === i + 1 ? 'border-white/80' : 'border-transparent'
                }`}
                onClick={() => {
                  setCurrentPage(i + 1)
                  sendCommand({ action: 'pdfPage', value: i + 1 })
                }}
              >
                <img src={url} alt={`page ${i + 1}`} style={{ width: '100%', display: 'block' }} />
                <span className="absolute bottom-0.5 right-1 text-white/60 text-xs">{i + 1}</span>
              </button>
            ))}
          </div>

          <div className="shrink-0 flex items-center justify-center gap-1 p-1.5 border-t border-white/10">
            <button
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => window.dispatchEvent(new CustomEvent('media:pdfPrevPage'))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-white/70 text-sm tabular-nums px-1">
              {currentPage} / {pageCount}
            </span>
            <button
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => window.dispatchEvent(new CustomEvent('media:pdfNextPage'))}
              disabled={currentPage >= pageCount}
            >
              <ChevronRight size={20} />
            </button>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors"
              onClick={() => {
                setPdfState({ viewMode: 'scroll' })
                sendCommand({ action: 'pdfViewMode', value: 'continuous' })
              }}
            >
              <AlignJustify size={20} />
            </button>
          </div>
        </div>
      </div>

      <div
        className="absolute top-1/2 -translate-y-1/2 z-30 transition-[left] duration-200 ease-in-out"
        style={{ left: thumbsCollapsed ? 0 : '25%' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className="flex items-center justify-center w-5 h-10 pdf-sidebar-bg rounded-r-lg text-white/70 hover:text-white transition-colors"
          onClick={() => setPdfState({ thumbsCollapsed: !thumbsCollapsed })}
        >
          {thumbsCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-200 ${
          thumbsCollapsed ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-start pl-2 pb-2">
          <div className="inline-flex items-center gap-1 pl-2 pr-3 py-1.5 rounded-full pdf-sidebar-bg">
            <button
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => window.dispatchEvent(new CustomEvent('media:pdfPrevPage'))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-white/70 text-sm tabular-nums px-1">
              {currentPage} / {pageCount}
            </span>
            <button
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              onClick={() => window.dispatchEvent(new CustomEvent('media:pdfNextPage'))}
              disabled={currentPage >= pageCount}
            >
              <ChevronRight size={20} />
            </button>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition-colors"
              onClick={() => {
                setPdfState({ viewMode: 'scroll' })
                sendCommand({ action: 'pdfViewMode', value: 'continuous' })
              }}
            >
              <AlignJustify size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
