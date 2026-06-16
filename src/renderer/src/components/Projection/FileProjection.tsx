import { useState, useEffect, useRef, useCallback } from 'react'
import { createProjectionAdapter } from '@renderer/lib/projection-adapter'
import { getFileSource, openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import { loadPdfjsLib } from '@renderer/lib/pdfjs-loader'
import type { AppMessages, FileControlPayload } from '@shared/projection-messages'

type FileShowPayload = AppMessages['file:show']

type FileProjectionProps = {
  fileName?: string
  initialItemId?: string
  initialBlobId?: string
  initialMimeType?: string
}

type PdfState = {
  pages: HTMLCanvasElement[]
  currentPage: number
  viewMode: 'single' | 'continuous'
}

type PendingVideoControl = {
  itemId: string | null
  seekTo?: number
  shouldPlay?: boolean
  volume?: number
}

const HAVE_METADATA = 1

export default function FileProjection({
  fileName,
  initialItemId,
  initialBlobId,
  initialMimeType
}: FileProjectionProps): React.JSX.Element {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [mimeType, setMimeType] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [pdfState, setPdfState] = useState<PdfState | null>(null)
  const [isEnded, setIsEnded] = useState(false)
  const [displayName, setDisplayName] = useState(fileName ?? '')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const pdfContainerRef = useRef<HTMLDivElement | null>(null)
  const currentItemIdRef = useRef<string | null>(null)
  const sourceRevokeRef = useRef<(() => void) | null>(null)
  const pendingVideoControlRef = useRef<PendingVideoControl | null>(null)

  const isControlForCurrentItem = useCallback((data: FileControlPayload): boolean => {
    if (!('itemId' in data) || data.itemId === undefined) return true
    return data.itemId === currentItemIdRef.current
  }, [])

  const clampVideoTime = useCallback((video: HTMLVideoElement, value: number): number => {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : value
    return Math.max(0, Math.min(value, duration))
  }, [])

  const applyPendingVideoControl = useCallback((): void => {
    const pending = pendingVideoControlRef.current
    const video = videoRef.current
    if (!pending || !video) return
    if (pending.itemId && pending.itemId !== currentItemIdRef.current) {
      pendingVideoControlRef.current = null
      return
    }

    if (pending.volume !== undefined) {
      video.muted = false
      video.volume = Math.max(0, Math.min(1, pending.volume))
      delete pending.volume
    }

    if (pending.seekTo !== undefined) {
      if (video.readyState < HAVE_METADATA) return
      try {
        video.currentTime = clampVideoTime(video, pending.seekTo)
        delete pending.seekTo
      } catch {
        return
      }
    }

    if (pending.shouldPlay !== undefined) {
      if (pending.shouldPlay) {
        if (video.readyState < HAVE_METADATA) return
        video.muted = false
        video.play().catch(() => {})
      } else {
        video.pause()
      }
      delete pending.shouldPlay
    }

    if (
      pending.seekTo === undefined &&
      pending.shouldPlay === undefined &&
      pending.volume === undefined
    ) {
      pendingVideoControlRef.current = null
    }
  }, [clampVideoTime])

  const queueVideoControl = useCallback(
    (data: FileControlPayload, control: Omit<PendingVideoControl, 'itemId'>): void => {
      if (!isControlForCurrentItem(data)) return
      const itemId =
        'itemId' in data && data.itemId !== undefined ? data.itemId : currentItemIdRef.current
      pendingVideoControlRef.current = {
        ...(pendingVideoControlRef.current ?? {}),
        itemId,
        ...control
      }
      applyPendingVideoControl()
    },
    [applyPendingVideoControl, isControlForCurrentItem]
  )

  const loadPdf = useCallback(async (sourceUrl: string, itemId: string) => {
    const pdfjsLib = await loadPdfjsLib()
    const pdf = await pdfjsLib.getDocument(sourceUrl).promise

    try {
      const pages: HTMLCanvasElement[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        if (currentItemIdRef.current !== itemId) return
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
      if (currentItemIdRef.current !== itemId) return
      setPdfState({ pages, currentPage: 1, viewMode: 'single' })
    } finally {
      await pdf.destroy()
    }
  }, [])

  const loadFile = useCallback(
    async (itemId: string, blobId: string, fileMimeType: string) => {
      currentItemIdRef.current = itemId
      pendingVideoControlRef.current = null
      sourceRevokeRef.current?.()
      sourceRevokeRef.current = null
      setObjectUrl(null)
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setPdfState(null)
      setIsEnded(false)
      const db = await openFileExplorerDB()
      const source = await getFileSource(db, blobId, fileMimeType)
      if (!source || currentItemIdRef.current !== itemId) {
        source?.revoke()
        return
      }

      sourceRevokeRef.current = source.revoke
      setMimeType(fileMimeType)

      if (fileMimeType === 'application/pdf') {
        await loadPdf(source.url, itemId)
      } else {
        setObjectUrl(source.url)
      }
    },
    [loadPdf]
  )

  const handleControl = useCallback(
    (data: FileControlPayload) => {
      switch (data.action) {
        case 'play':
          queueVideoControl(data, { shouldPlay: true })
          break
        case 'pause':
          queueVideoControl(data, { shouldPlay: false })
          break
        case 'seek':
          queueVideoControl(data, { seekTo: data.value })
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
        case 'pdfScroll': {
          const el = pdfContainerRef.current
          if (el) {
            const pageFloat = data.value
            const pageIndex = Math.floor(Math.max(0, pageFloat))
            const fraction = pageFloat - pageIndex
            const PY = 16 // py-4
            const GAP = 16 // gap-4
            const children = el.children
            let target = PY
            for (let i = 0; i < pageIndex && i < children.length; i++) {
              target += (children[i] as HTMLElement).clientHeight + GAP
            }
            if (pageIndex < children.length) {
              target += fraction * (children[pageIndex] as HTMLElement).clientHeight
            }
            el.scrollTop = target
          }
          break
        }
        case 'pdfViewMode':
          setPdfState((prev) => (prev ? { ...prev, viewMode: data.value } : prev))
          break
        case 'volume':
          queueVideoControl(data, { volume: data.value })
          break
      }
    },
    [queueVideoControl]
  )

  useEffect(() => {
    const adapter = createProjectionAdapter('projection')

    const unsubShow = adapter.on('file:show', (data: FileShowPayload) => {
      setDisplayName(data.fileName)
      loadFile(data.itemId, data.blobId, data.mimeType)
    })

    const unsubControl = adapter.on('file:control', (data: FileControlPayload) => {
      handleControl(data)
    })

    const unsubEnd = adapter.on('file:end', () => {
      setIsEnded(true)
    })

    return () => {
      unsubShow()
      unsubControl()
      unsubEnd()
      adapter.dispose()
    }
  }, [loadFile, handleControl])

  useEffect(() => {
    if (initialItemId && initialBlobId && initialMimeType) {
      loadFile(initialItemId, initialBlobId, initialMimeType)
    }
  }, [initialBlobId, initialItemId, initialMimeType, loadFile])

  useEffect(
    () => () => {
      sourceRevokeRef.current?.()
      sourceRevokeRef.current = null
    },
    []
  )

  const transform =
    zoom !== 1
      ? `scale(${zoom}) translate(${(pan.x / zoom) * 100}%, ${(pan.y / zoom) * 100}%)`
      : undefined

  const imageTransform =
    zoom !== 1
      ? `scale(${zoom}) translate(${(-pan.x / zoom) * 100}%, ${(-pan.y / zoom) * 100}%)`
      : undefined

  if (isEnded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <span className="text-white/10 text-4xl font-bold tracking-widest">投影結束</span>
      </div>
    )
  }

  if (pdfState) {
    if (pdfState.viewMode === 'continuous') {
      return (
        <div className="flex h-screen w-full bg-black overflow-hidden">
          <div
            ref={pdfContainerRef}
            className="w-full h-full overflow-y-auto flex flex-col items-center gap-4 py-4"
          >
            {pdfState.pages.map((canvas, i) => (
              <PdfCanvas key={i} canvas={canvas} continuous />
            ))}
          </div>
        </div>
      )
    }

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
            className="flex flex-col items-center overflow-hidden w-full h-full"
            style={{ transform, transformOrigin: 'center center' }}
          >
            <PdfCanvas canvas={pdfState.pages[pdfState.currentPage - 1]} />
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
              transform: imageTransform,
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
            onLoadedMetadata={applyPendingVideoControl}
            onCanPlay={applyPendingVideoControl}
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
  canvas,
  continuous = false
}: {
  canvas: HTMLCanvasElement | undefined
  continuous?: boolean
}): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !canvas) return
    container.innerHTML = ''
    Object.assign(canvas.style, {
      maxWidth: '100%',
      maxHeight: continuous ? 'none' : '100%',
      objectFit: 'contain'
    })
    container.appendChild(canvas)
    return () => {
      container.innerHTML = ''
    }
  }, [canvas, continuous])

  if (!canvas) return null
  return (
    <div
      ref={containerRef}
      className={`flex items-center justify-center w-full${continuous ? '' : ' h-full'}`}
    />
  )
}
