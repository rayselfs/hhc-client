import React, { useEffect, useRef, useState } from 'react'
import { toast } from '@heroui/react/toast'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, AlignJustify, Maximize2 } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { FileItemRecord } from '@shared/types/folder'
import { openFileExplorerDB, getFileBlob } from '@renderer/lib/file-explorer-db'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { usePresenterCommands } from '@renderer/contexts/PresenterCommandContext'

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
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
}

export default function PdfPreview({ item }: PdfPreviewProps): React.JSX.Element {
  const { t } = useTranslation()
  const { sendCommand } = usePresenterCommands()
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const slideCanvasRef = useRef<HTMLCanvasElement>(null)
  const scrollCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([])

  const pdfViewMode = useMediaProjectionStore((s) => s.typeStates['pdf']?.viewMode ?? 'slide')
  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)
  const pan = useMediaProjectionStore((s) => s.pan)

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
        <div className="w-full h-full overflow-y-auto flex flex-col items-center gap-4 py-4">
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
            className="inline-flex items-center rounded-full p-2 presenter-media-control text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => {
              useMediaProjectionStore.getState().setTypeState('pdf', { viewMode: 'slide' })
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
    <div className="w-full h-full relative flex flex-col items-center justify-center bg-black">
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
        className="absolute bottom-0 left-0 right-0 z-20"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-start pl-2 pb-2">
          <div className="inline-flex items-center gap-1 pl-2 pr-3 py-1.5 rounded-full presenter-media-control">
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
                useMediaProjectionStore.getState().setTypeState('pdf', { viewMode: 'scroll' })
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
