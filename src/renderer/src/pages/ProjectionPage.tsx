import { useState, useEffect } from 'react'
import { createProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isWeb } from '@renderer/lib/env'
import { useSettingsStore } from '@renderer/stores/settings'
import DefaultProjection from '@renderer/components/Projection/DefaultProjection'
import BibleProjection from '@renderer/components/Projection/BibleProjection'
import TimerProjection from '@renderer/components/Projection/TimerProjection'
import FileProjection from '@renderer/components/Projection/FileProjection'
import SlideProjection from '@renderer/components/Projection/SlideProjection'
import type { BibleChapterData } from '@renderer/components/Projection/BibleProjection'
import type { TimerTickPayload, StopwatchTickPayload } from '@shared/types/timer'
import type { FileControlPayload } from '@shared/projection-messages'
import type { SlideDocument } from '@shared/types/slides'

type ActiveContent = 'timer' | 'bible' | 'file' | 'slide' | null

export default function ProjectionPage(): React.JSX.Element {
  const [showDefault, setShowDefault] = useState(true)
  const [activeContent, setActiveContent] = useState<ActiveContent>(null)
  const [timerData, setTimerData] = useState<TimerTickPayload | null>(null)
  const [stopwatchData, setStopwatchData] = useState<StopwatchTickPayload | null>(null)
  const [bibleChapter, setBibleChapter] = useState<BibleChapterData | null>(null)
  const [bibleFontSize, setBibleFontSize] = useState(90)
  const [fileData, setFileData] = useState<{
    itemId: string
    blobId: string
    fileName: string
    mimeType: string
    streamUrl?: string
    playbackMode?: 'native' | 'vlc-embedded'
    seekable?: boolean
    durationMs?: number
  } | null>(null)
  const [fileControlEvent, setFileControlEvent] = useState<{
    id: number
    data: FileControlPayload
  } | null>(null)
  const [slideData, setSlideData] = useState<{
    document: SlideDocument
    slideIndex: number
    resolvedImageUrls?: Record<string, string>
  } | null>(null)
  const [timerRingColor, setTimerRingColor] = useState<string | null>(() => {
    const s = useSettingsStore.getState()
    return s.timerRingColorEnabled ? s.timerRingColor : null
  })

  useEffect(() => {
    const mountedAt = performance?.now?.() ?? Date.now()
    const adapter = createProjectionAdapter('projection')

    const unsubBlank = adapter.on('__system:blank', ({ showDefault: blank }) => {
      setShowDefault(blank)
    })

    const unsubActiveOwner = adapter.on('__system:active-owner', ({ owner }) => {
      if (owner === 'bible') setActiveContent('bible')
      else if (owner === 'media') setActiveContent('file')
      else if (owner === 'slide') setActiveContent('slide')
      else setActiveContent('timer')
    })

    const unsubTimerTick = adapter.on('timer:tick', (data) => {
      setTimerData(data)
    })

    const unsubStopwatch = adapter.on('timer:stopwatch', (data) => {
      setStopwatchData(data)
    })

    const unsubBibleChapter = adapter.on('bible:chapter', (data) => {
      setBibleChapter(data)
      setActiveContent('bible')
    })

    const unsubFileShow = adapter.on('file:show', (data) => {
      setFileData({
        itemId: data.itemId,
        blobId: data.blobId,
        fileName: data.fileName,
        mimeType: data.mimeType,
        streamUrl: data.streamUrl,
        playbackMode: data.playbackMode,
        seekable: data.seekable,
        durationMs: data.durationMs
      })
      setActiveContent('file')
    })

    const unsubSlideShow = adapter.on('slide:show', (data) => {
      setSlideData(data)
      setActiveContent('slide')
    })

    let fileControlEventId = 0
    const unsubFileControl = adapter.on('file:control', (data) => {
      fileControlEventId += 1
      setFileControlEvent({ id: fileControlEventId, data })
    })

    const unsubBibleSettings = adapter.on('bible:settings', ({ fontSize }) => {
      setBibleFontSize(fontSize)
    })

    const unsubTimezone = adapter.on('settings:timezone', ({ timezone }) => {
      useSettingsStore.getState().setTimezone(timezone)
    })

    const unsubTimerRingColor = adapter.on('settings:timer-ring-color', ({ color }) => {
      setTimerRingColor(color)
    })

    let unsubClose = (): void => {}
    let unsubPing = (): void => {}

    if (isWeb()) {
      unsubClose = adapter.on('__system:close', () => {
        window.close()
      })
      unsubPing = adapter.on('__system:ping', () => {
        adapter.send('__system:pong', null)
      })
      adapter.send('__system:pong', null)
    }

    console.info('[ProjectionDiagnostics]', {
      event: 'projection-route-ready',
      elapsedMs: Math.round((performance?.now?.() ?? Date.now()) - mountedAt),
      environment: isWeb() ? 'web' : 'electron'
    })
    adapter.send('__system:ready', null)

    const handleBeforeUnload = (): void => {
      if (isWeb()) {
        adapter.send('__system:closed', null)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      unsubBlank()
      unsubActiveOwner()
      unsubTimerTick()
      unsubStopwatch()
      unsubBibleChapter()
      unsubFileShow()
      unsubSlideShow()
      unsubFileControl()
      unsubBibleSettings()
      unsubTimezone()
      unsubTimerRingColor()
      unsubClose()
      unsubPing()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      adapter.dispose()
    }
  }, [])

  useEffect(() => {
    if (showDefault || activeContent !== 'file') void window.api?.projectionVlc?.stop()
  }, [activeContent, showDefault])

  if (showDefault) return <DefaultProjection />

  if (activeContent === 'bible' && bibleChapter) {
    return <BibleProjection data={bibleChapter} fontSize={bibleFontSize} />
  }

  if (activeContent === 'file' && fileData) {
    return (
      <FileProjection
        fileName={fileData.fileName}
        initialItemId={fileData.itemId}
        initialBlobId={fileData.blobId}
        initialMimeType={fileData.mimeType}
        initialStreamUrl={fileData.streamUrl}
        initialPlaybackMode={fileData.playbackMode}
        initialSeekable={fileData.seekable}
        initialDurationMs={fileData.durationMs}
        controlEvent={fileControlEvent}
      />
    )
  }

  if (activeContent === 'slide' && slideData) {
    return (
      <SlideProjection
        document={slideData.document}
        slideIndex={slideData.slideIndex}
        resolvedImageUrls={slideData.resolvedImageUrls}
      />
    )
  }

  if (timerData) {
    return (
      <TimerProjection
        timerData={timerData}
        stopwatchData={stopwatchData}
        ringColor={timerRingColor ?? undefined}
      />
    )
  }

  return <DefaultProjection />
}
