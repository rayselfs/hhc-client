import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createProjectionAdapter } from '@renderer/lib/projection-adapter'
import { getFileSource, openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import { loadPdfjsLib } from '@renderer/lib/pdfjs-loader'
import type { FileControlPayload, ProjectionPayload } from '@shared/projection-messages'
import PptxSlideSurface from '@renderer/components/Common/PptxSlideSurface'
import EditableSlideSurface from '@renderer/components/Common/EditableSlideSurface'
import {
  loadEditablePresentation,
  type EditablePresentationDocument
} from '@renderer/lib/editable-presentation'
import {
  isEditablePresentationMimeType,
  isPresentationMimeType
} from '@renderer/lib/presentation-media'

type FileProjectionProps = {
  fileName?: string
  initialItemId?: string
  initialBlobId?: string
  initialMimeType?: string
  initialStreamUrl?: string
  initialPlaybackMode?: 'native' | 'vlc-embedded'
  initialSeekable?: boolean
  initialDurationMs?: number
  initialPresentation?: {
    slideIndex: number
    slideCount?: number
  }
  initialEditablePresentation?: ProjectionPayload<'file:show'>['editablePresentation']
  controlEvent?: { id: number; data: FileControlPayload } | null
}

type LoadFileOptions = {
  streamUrl?: string
  playbackMode?: 'native' | 'vlc-embedded'
  seekable?: boolean
  durationMs?: number
}

type PdfState = {
  pages: Array<HTMLCanvasElement | undefined>
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
  initialMimeType,
  initialStreamUrl,
  initialPlaybackMode,
  initialSeekable,
  initialDurationMs,
  initialPresentation,
  initialEditablePresentation,
  controlEvent
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
  const adapterSendRef = useRef<ReturnType<typeof createProjectionAdapter>['send'] | null>(null)
  const currentItemIdRef = useRef<string | null>(null)
  const sourceRevokeRef = useRef<(() => void) | null>(null)
  const pendingVideoControlRef = useRef<PendingVideoControl | null>(null)
  const seekableRef = useRef(true)
  const playbackModeRef = useRef<FileProjectionProps['initialPlaybackMode']>('native')
  const durationMsRef = useRef<number | undefined>(initialDurationMs)
  const loadSequenceRef = useRef(0)

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
      if (!seekableRef.current) {
        delete pending.seekTo
      } else {
        if (video.readyState < HAVE_METADATA) return
        try {
          video.currentTime = clampVideoTime(video, pending.seekTo)
          delete pending.seekTo
        } catch {
          return
        }
      }
    }

    if (pending.shouldPlay !== undefined) {
      if (pending.shouldPlay) {
        const mustApplySeekBeforePlay = pending.seekTo !== undefined && seekableRef.current
        if (mustApplySeekBeforePlay && video.readyState < HAVE_METADATA) return
        video.muted = false
        video.play().catch((error) => {
          console.error('[file-projection] Video play failed', error)
        })
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

    const renderPage = async (pageNum: number): Promise<HTMLCanvasElement> => {
      const page = await pdf.getPage(pageNum)
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
      return canvas
    }

    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        if (currentItemIdRef.current !== itemId) return
        const canvas = await renderPage(i)
        if (currentItemIdRef.current !== itemId) return

        setPdfState((prev) => {
          const pages =
            prev?.pages.length === pdf.numPages
              ? [...prev.pages]
              : new Array<HTMLCanvasElement | undefined>(pdf.numPages).fill(undefined)
          pages[i - 1] = canvas
          return {
            pages,
            currentPage: prev?.currentPage ?? 1,
            viewMode: prev?.viewMode ?? 'single'
          }
        })
      }
    } finally {
      await pdf.destroy()
    }
  }, [])

  const sendVideoPlaybackState = useCallback(
    (next?: { isPlaying?: boolean; isEnded?: boolean }): void => {
      const video = videoRef.current
      const itemId = currentItemIdRef.current
      const send = adapterSendRef.current
      if (!video || !itemId || !send) return
      const metadataDuration =
        durationMsRef.current !== undefined && durationMsRef.current > 0
          ? durationMsRef.current / 1000
          : undefined
      const duration =
        metadataDuration ??
        (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0)
      send('file:playback-state', {
        itemId,
        currentTime: Number.isFinite(video.currentTime) ? video.currentTime : 0,
        duration,
        isPlaying: next?.isPlaying ?? !video.paused,
        isEnded: next?.isEnded ?? video.ended
      })
    },
    []
  )

  const loadFile = useCallback(
    async (itemId: string, blobId: string, fileMimeType: string, options: LoadFileOptions = {}) => {
      const loadSequence = loadSequenceRef.current + 1
      loadSequenceRef.current = loadSequence
      if (playbackModeRef.current === 'vlc-embedded') {
        await window.api?.projectionVlc?.stop().catch((error) => {
          console.error('[file-projection] Failed to stop VLC before loading next item', error)
        })
        if (loadSequenceRef.current !== loadSequence) return
      }
      currentItemIdRef.current = itemId
      pendingVideoControlRef.current = null
      playbackModeRef.current = options.playbackMode ?? 'native'
      seekableRef.current = options.seekable !== false
      durationMsRef.current = options.durationMs
      sourceRevokeRef.current?.()
      sourceRevokeRef.current = null
      setObjectUrl(null)
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setPdfState(null)
      setIsEnded(false)
      setMimeType(fileMimeType)
      if (options.playbackMode === 'vlc-embedded') {
        return
      }
      if (options.streamUrl) {
        setObjectUrl(options.streamUrl)
        return
      }
      if (isPresentationMimeType(fileMimeType)) return
      const db = await openFileExplorerDB()
      const source = await getFileSource(db, blobId, fileMimeType, { verifyNativeFile: false })
      if (!source || currentItemIdRef.current !== itemId) {
        source?.revoke()
        return
      }

      sourceRevokeRef.current = source.revoke
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
          if (playbackModeRef.current === 'vlc-embedded') {
            void window.api?.projectionVlc?.control({ action: 'play', itemId: data.itemId })
            break
          }
          queueVideoControl(data, { shouldPlay: true })
          break
        case 'pause':
          if (playbackModeRef.current === 'vlc-embedded') {
            void window.api?.projectionVlc?.control({ action: 'pause', itemId: data.itemId })
            break
          }
          queueVideoControl(data, { shouldPlay: false })
          break
        case 'seek':
          if (!seekableRef.current) break
          if (playbackModeRef.current === 'vlc-embedded') {
            void window.api?.projectionVlc?.control({
              action: 'seek',
              itemId: data.itemId,
              value: data.value
            })
            break
          }
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
          if (playbackModeRef.current === 'vlc-embedded') {
            void window.api?.projectionVlc?.control({
              action: 'volume',
              itemId: data.itemId,
              value: data.value
            })
            break
          }
          queueVideoControl(data, { volume: data.value })
          break
      }
    },
    [queueVideoControl]
  )

  useEffect(() => {
    const adapter = createProjectionAdapter('projection')
    adapterSendRef.current = adapter.send.bind(adapter)

    const unsubEnd = adapter.on('file:end', () => {
      setIsEnded(true)
    })

    return () => {
      unsubEnd()
      adapter.dispose()
      adapterSendRef.current = null
    }
  }, [])

  useEffect(() => {
    if (initialItemId && initialBlobId && initialMimeType) {
      setDisplayName(fileName ?? '')
      loadFile(initialItemId, initialBlobId, initialMimeType, {
        streamUrl: initialStreamUrl,
        playbackMode: initialPlaybackMode,
        seekable: initialSeekable,
        durationMs: initialDurationMs
      })
    }
  }, [
    fileName,
    initialBlobId,
    initialItemId,
    initialMimeType,
    initialPlaybackMode,
    initialSeekable,
    initialDurationMs,
    initialStreamUrl,
    loadFile
  ])

  useEffect(() => {
    if (controlEvent) handleControl(controlEvent.data)
  }, [controlEvent, handleControl])

  useEffect(
    () => () => {
      sourceRevokeRef.current?.()
      sourceRevokeRef.current = null
      void window.api?.projectionVlc?.stop()
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
            preload={seekableRef.current ? 'metadata' : 'none'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform,
              transformOrigin: 'center center'
            }}
            muted
            onLoadedMetadata={() => {
              sendVideoPlaybackState()
              applyPendingVideoControl()
            }}
            onCanPlay={() => {
              sendVideoPlaybackState()
              applyPendingVideoControl()
            }}
            onTimeUpdate={() => sendVideoPlaybackState()}
            onPlay={() => sendVideoPlaybackState({ isPlaying: true, isEnded: false })}
            onPause={() => sendVideoPlaybackState({ isPlaying: false })}
            onEnded={() => sendVideoPlaybackState({ isPlaying: false, isEnded: true })}
          />
        </div>
      </div>
    )
  }

  if (mimeType?.startsWith('video/') && playbackModeRef.current === 'vlc-embedded') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black overflow-hidden">
        <VlcProjectionSurface
          itemId={currentItemIdRef.current}
          blobId={initialBlobId}
          durationMs={durationMsRef.current}
        />
      </div>
    )
  }

  if (isEditablePresentationMimeType(mimeType ?? undefined) && initialItemId && initialBlobId) {
    return (
      <EditableProjectionSurface
        itemId={initialItemId}
        blobId={initialBlobId}
        fileName={displayName}
        slideIndex={initialPresentation?.slideIndex ?? 0}
        editablePresentation={initialEditablePresentation}
      />
    )
  }

  if (isPresentationMimeType(mimeType ?? undefined) && initialItemId && initialBlobId) {
    const presentationMimeType =
      mimeType ?? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    return (
      <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black">
        <div className="h-full w-full">
          <PptxSlideSurface
            source={{
              id: initialItemId,
              url: `blob:${initialBlobId}`,
              mimeType: presentationMimeType
            }}
            slideIndex={initialPresentation?.slideIndex ?? 0}
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

function EditableProjectionSurface({
  itemId,
  blobId,
  fileName,
  slideIndex,
  editablePresentation
}: {
  itemId: string
  blobId: string
  fileName: string
  slideIndex: number
  editablePresentation?: ProjectionPayload<'file:show'>['editablePresentation']
}): React.JSX.Element {
  const payloadDocument = useMemo(
    () =>
      editablePresentation
        ? {
            id: itemId,
            name: fileName,
            width: editablePresentation.width,
            height: editablePresentation.height,
            slideOrder: [editablePresentation.slide.id],
            slides: { [editablePresentation.slide.id]: editablePresentation.slide },
            assets: editablePresentation.assets,
            createdAt: 0,
            updatedAt: 0
          }
        : null,
    [editablePresentation, fileName, itemId]
  )
  const [document, setDocument] = useState<EditablePresentationDocument | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (payloadDocument) {
      setDocument(payloadDocument)
      setError(null)
      return
    }
    let cancelled = false
    void loadEditablePresentation({ id: itemId, url: `blob:${blobId}`, name: fileName })
      .then((loadedDocument) => {
        if (!cancelled) setDocument(loadedDocument)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : String(loadError))
      })
    return () => {
      cancelled = true
    }
  }, [blobId, fileName, itemId, payloadDocument])

  const slideId =
    document?.slideOrder[Math.min(slideIndex, Math.max(0, document.slideOrder.length - 1))]

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black p-6 text-center">
        <p className="text-sm text-danger">{error}</p>
      </div>
    )
  }

  if (!document || !slideId) {
    return <div className="h-screen w-full bg-black" />
  }

  return (
    <div className="flex h-screen w-full items-center justify-center overflow-hidden bg-black">
      <EditableSlideSurface document={document} slideId={slideId} className="h-full max-h-screen" />
    </div>
  )
}

function VlcProjectionSurface({
  itemId,
  blobId,
  durationMs
}: {
  itemId: string | null
  blobId?: string
  durationMs?: number
}): React.JSX.Element {
  useEffect(() => {
    if (!itemId || !blobId) return undefined
    void window.api?.projectionVlc
      ?.start({
        itemId,
        sourceFileId: blobId,
        container: '#vlc-player',
        durationMs
      })
      .catch((error) => {
        console.error('[projection-vlc] Failed to start embedded VLC playback', error)
      })
    return () => {
      void window.api?.projectionVlc?.stop()
    }
  }, [blobId, durationMs, itemId])

  return <div id="vlc-player" className="h-full w-full bg-black" />
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
