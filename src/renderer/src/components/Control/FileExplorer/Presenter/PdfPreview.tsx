import React, { useEffect, useRef, useState } from 'react'
import { toast } from '@heroui/react/toast'
import { useTranslation } from 'react-i18next'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { FileItemRecord } from '@shared/types/folder'
import { openFileExplorerDB, getFileBlob } from '@renderer/lib/file-explorer-db'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

interface PdfPreviewProps {
  item: FileItemRecord
}

async function ensurePdfjsPolyfill(): Promise<void> {
  if (!('getOrInsertComputed' in Map.prototype)) {
    Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
      value<K, V>(this: Map<K, V>, key: K, factory: (key: K) => V): V {
        if (!this.has(key)) this.set(key, factory(key))
        return this.get(key)!
      },
      configurable: true,
      writable: true
    })
  }
}

async function loadPdfjsLib(): Promise<typeof import('pdfjs-dist')> {
  await ensurePdfjsPolyfill()
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).href
  return pdfjsLib
}

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
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageCount, setPageCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const slideCanvasRef = useRef<HTMLCanvasElement>(null)
  const scrollCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([])

  const pdfViewMode = useMediaProjectionStore((s) => s.pdfViewMode)
  const zoomLevel = useMediaProjectionStore((s) => s.zoomLevel)

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

  useEffect(() => {
    if (!pdfDoc || pdfViewMode !== 'scroll') return
    let cancelled = false

    async function renderAll(): Promise<void> {
      for (let i = 0; i < pdfDoc!.numPages; i++) {
        if (cancelled) return
        const canvas = scrollCanvasRefs.current[i]
        if (canvas) {
          await renderPage(pdfDoc!, i + 1, canvas)
        }
      }
    }

    void renderAll()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, pdfViewMode, pageCount])

  useEffect(() => {
    const handleNext = (): void => setCurrentPage((p) => Math.min(p + 1, pageCount))
    const handlePrev = (): void => setCurrentPage((p) => Math.max(p - 1, 1))
    window.addEventListener('media:pdfNextPage', handleNext)
    window.addEventListener('media:pdfPrevPage', handlePrev)
    return () => {
      window.removeEventListener('media:pdfNextPage', handleNext)
      window.removeEventListener('media:pdfPrevPage', handlePrev)
    }
  }, [pageCount])

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/50">
        {t('presenter.loading')}
      </div>
    )
  }

  if (error || !pdfDoc) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white/50">
        {t('presenter.pdfLoadFailed')}
      </div>
    )
  }

  if (pdfViewMode === 'scroll') {
    return (
      <div className="w-full h-full overflow-y-auto bg-black flex flex-col items-center gap-4 py-4">
        {Array.from({ length: pageCount }, (_, i) => (
          <canvas
            key={i + 1}
            ref={(el) => {
              scrollCanvasRefs.current[i] = el
            }}
            style={{ maxWidth: '100%' }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black">
      <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}>
        <canvas
          ref={slideCanvasRef}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      </div>
      <div className="text-white/70 text-sm mt-2">
        {currentPage} / {pageCount}
      </div>
    </div>
  )
}
