import { useState, useEffect, useRef, useCallback } from 'react'
import { createProjectionAdapter } from '@renderer/lib/projection-adapter'
import { openFileExplorerDB, getFileBlob } from '@renderer/lib/file-explorer-db'
import type { AppMessages, FileControlPayload } from '@shared/projection-messages'

type FileShowPayload = AppMessages['file:show']

type FileProjectionProps = {
  fileName?: string
  initialFileId?: string
  initialMimeType?: string
}

type PdfState = {
  pages: HTMLCanvasElement[]
  currentPage: number
  viewMode: 'single' | 'continuous'
}

export default function FileProjection({
  fileName,
  initialFileId,
  initialMimeType
}: FileProjectionProps): React.JSX.Element {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [pdfState, setPdfState] = useState<PdfState | null>(null)
  const [displayName, setDisplayName] = useState(fileName ?? '')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const pdfContainerRef = useRef<HTMLDivElement | null>(null)
  const currentFileIdRef = useRef<string | null>(null)

  const loadFile = useCallback(async (fileId: string, fileMimeType: string) => {
    currentFileIdRef.current = fileId
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setPdfState(null)
    const db = await openFileExplorerDB()
    const blob = await getFileBlob(db, fileId)
    if (!blob || currentFileIdRef.current !== fileId) return

    setMimeType(fileMimeType)

    if (fileMimeType === 'application/pdf') {
      await loadPdf(blob)
    } else {
      const url = URL.createObjectURL(blob)
      setObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
    }
  }, [])

  const loadPdf = useCallback(async (blob: Blob) => {
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

    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).href

    const buffer = await blob.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise

    try {
      const pages: HTMLCanvasElement[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const context = canvas.getContext('2d')
        if (context) {
          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, canvas.width, canvas.height)
          await page.render({ canvas, canvasContext: context, viewport }).promise
        }
        pages.push(canvas)
      }
      setPdfState({ pages, currentPage: 1, viewMode: 'single' })
    } finally {
      await pdf.destroy()
    }
  }, [])

  const handleControl = useCallback((data: FileControlPayload) => {
    switch (data.action) {
      case 'play':
        if (videoRef.current) {
          videoRef.current.muted = false
          videoRef.current.play().catch(() => {})
        }
        break
      case 'pause':
        videoRef.current?.pause()
        break
      case 'seek':
        if (videoRef.current) videoRef.current.currentTime = data.value
        break
      case 'zoom':
        setZoom(data.value)
        if (data.value <= 1) setPan({ x: 0, y: 0 })
        break
      case 'pan':
        setPan(data.value)
        break
      case 'pdfPage':
        setPdfState((prev) => (prev ? { ...prev, currentPage: data.value } : prev))
        break
      case 'pdfViewMode':
        setPdfState((prev) => (prev ? { ...prev, viewMode: data.value } : prev))
        break
      case 'volume':
        if (videoRef.current) {
          videoRef.current.muted = false
          videoRef.current.volume = Math.max(0, Math.min(1, data.value))
        }
        break
    }
  }, [])

  useEffect(() => {
    const adapter = createProjectionAdapter('projection')

    const unsubShow = adapter.on('file:show', (data: FileShowPayload) => {
      setDisplayName(data.fileName)
      loadFile(data.fileId, data.mimeType)
    })

    const unsubControl = adapter.on('file:control', (data: FileControlPayload) => {
      handleControl(data)
    })

    return () => {
      unsubShow()
      unsubControl()
      adapter.dispose()
    }
  }, [loadFile, handleControl])

  useEffect(() => {
    if (initialFileId && initialMimeType) {
      loadFile(initialFileId, initialMimeType)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [objectUrl])

  const transform =
    zoom !== 1
      ? `scale(${zoom}) translate(${(pan.x / zoom) * 100}%, ${(pan.y / zoom) * 100}%)`
      : undefined

  if (pdfState) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black overflow-hidden">
        <div
          style={{
            aspectRatio: '16 / 9',
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          <div
            ref={pdfContainerRef}
            className="flex flex-col items-center overflow-auto max-h-full max-w-full"
            style={{ transform, transformOrigin: 'center center' }}
          >
            {pdfState.viewMode === 'single' ? (
              <PdfCanvas canvas={pdfState.pages[pdfState.currentPage - 1]} />
            ) : (
              pdfState.pages.map((canvas, i) => <PdfCanvas key={i} canvas={canvas} />)
            )}
          </div>
        </div>
      </div>
    )
  }

  if (mimeType?.startsWith('image/') && objectUrl) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black overflow-hidden">
        <div
          style={{
            aspectRatio: '16 / 9',
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden'
          }}
        >
          <img
            src={objectUrl}
            alt={displayName}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform,
              transformOrigin: 'center center'
            }}
          />
        </div>
      </div>
    )
  }

  if (mimeType?.startsWith('video/') && objectUrl) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black overflow-hidden">
        <div
          style={{
            aspectRatio: '16 / 9',
            maxWidth: '100%',
            maxHeight: '100%',
            width: '100%',
            overflow: 'hidden'
          }}
        >
          <video
            ref={videoRef}
            src={objectUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform,
              transformOrigin: 'center center'
            }}
            muted
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      <p className="text-white/30 text-sm">{displayName || 'No file loaded'}</p>
    </div>
  )
}

function PdfCanvas({
  canvas
}: {
  canvas: HTMLCanvasElement | undefined
}): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !canvas) return
    container.innerHTML = ''
    Object.assign(canvas.style, {
      maxWidth: '100%',
      maxHeight: '100vh',
      objectFit: 'contain'
    })
    container.appendChild(canvas)
    return () => {
      container.innerHTML = ''
    }
  }, [canvas])

  if (!canvas) return null
  return <div ref={containerRef} className="flex items-center justify-center" />
}
