import { useState, useEffect, useRef, useCallback } from 'react'
import { createProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isWeb } from '@renderer/lib/env'
import { useSettingsStore } from '@renderer/stores/settings'
import DefaultProjection from '@renderer/components/Projection/DefaultProjection'
import TimerDisplay from '@renderer/components/Timer/TimerDisplay'
import ClockDisplay from '@renderer/components/Timer/ClockDisplay'
import StopwatchDisplay from '@renderer/components/Timer/StopwatchDisplay'
import GlassDivider from '@renderer/components/GlassDivider'
import type { TimerTickPayload, StopwatchTickPayload } from '@shared/types/timer'
import { formatVerseReference } from '@renderer/lib/bible-utils'
import { useTranslation } from 'react-i18next'

type ActiveContent = 'timer' | 'bible' | null

type BibleChapterData = {
  bookNumber: number
  chapter: number
  chapterVerses: Array<{ number: number; text: string }>
  currentVerse: number
}

export default function ProjectionPage(): React.JSX.Element {
  const { t } = useTranslation()
  const [showDefault, setShowDefault] = useState(true)
  const [activeContent, setActiveContent] = useState<ActiveContent>(null)
  const [timerData, setTimerData] = useState<TimerTickPayload | null>(null)
  const [stopwatchData, setStopwatchData] = useState<StopwatchTickPayload | null>(null)
  const [bibleChapter, setBibleChapter] = useState<BibleChapterData | null>(null)
  const [bibleFontSize, setBibleFontSize] = useState(90)

  useEffect(() => {
    const adapter = createProjectionAdapter('projection')

    const unsubBlank = adapter.on('__system:blank', ({ showDefault: blank }) => {
      setShowDefault(blank)
    })

    const unsubActiveOwner = adapter.on('__system:active-owner', ({ owner }) => {
      setActiveContent(owner === 'bible' ? 'bible' : 'timer')
    })

    const unsubTimerTick = adapter.on('timer:tick', (data) => {
      setTimerData(data)
    })

    const unsubStopwatch = adapter.on('timer:stopwatch', (data) => {
      setStopwatchData(data)
    })

    const unsubBibleChapter = adapter.on('bible:chapter', (data) => {
      setBibleChapter(data)
    })

    const unsubBibleSettings = adapter.on('bible:settings', ({ fontSize }) => {
      setBibleFontSize(fontSize)
    })

    const unsubTimezone = adapter.on('settings:timezone', ({ timezone }) => {
      useSettingsStore.getState().setTimezone(timezone)
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
      unsubBibleSettings()
      unsubTimezone()
      unsubClose()
      unsubPing()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      adapter.dispose()
    }
  }, [])

  if (showDefault) return <DefaultProjection />

  if (activeContent === 'bible' && bibleChapter) {
    return (
      <BibleChapterProjection
        data={bibleChapter}
        fontSize={bibleFontSize}
        t={t as unknown as TFunction}
      />
    )
  }

  if (timerData) {
    return (
      <div className="h-screen w-full bg-black">{renderTimerContent(timerData, stopwatchData)}</div>
    )
  }

  return <DefaultProjection />
}

type TFunction = (key: string) => string

function BibleChapterProjection({
  data,
  fontSize,
  t
}: {
  data: BibleChapterData
  fontSize: number
  t: TFunction
}): React.JSX.Element {
  const { bookNumber, chapter, chapterVerses, currentVerse } = data
  const containerRef = useRef<HTMLDivElement>(null)
  const prevChapterKeyRef = useRef<string>('')
  const isFirstRenderRef = useRef(true)

  const scrollToVerse = useCallback((verseNumber: number, behavior: ScrollBehavior) => {
    const container = containerRef.current
    if (!container) return
    const el = container.querySelector<HTMLElement>(`[data-verse="${verseNumber}"]`)
    if (!el) return
    const top =
      el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop
    container.scrollTo({ top, behavior })
  }, [])

  useEffect(() => {
    const chapterKey = `${bookNumber}-${chapter}`
    const isChapterChange = prevChapterKeyRef.current !== chapterKey
    prevChapterKeyRef.current = chapterKey

    const behavior: ScrollBehavior =
      isFirstRenderRef.current || isChapterChange ? 'instant' : 'smooth'
    isFirstRenderRef.current = false

    const frame = requestAnimationFrame(() => {
      scrollToVerse(currentVerse, behavior)
    })
    return () => cancelAnimationFrame(frame)
  }, [bookNumber, chapter, currentVerse, scrollToVerse])

  const reference = formatVerseReference(
    t as Parameters<typeof formatVerseReference>[0],
    bookNumber,
    chapter,
    currentVerse
  )
  const referenceSize = Math.max(16, fontSize * 0.35)

  return (
    <div className="h-screen w-full bg-black flex flex-col overflow-hidden">
      <div
        className="shrink-0 flex items-center justify-center bg-black/80 px-8"
        style={{ height: '60px' }}
      >
        <span className="text-white font-bold" style={{ fontSize: `${referenceSize}px` }}>
          {reference}
        </span>
      </div>

      <GlassDivider />

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto min-h-0"
        style={{ scrollbarWidth: 'none', pointerEvents: 'none' }}
      >
        {chapterVerses.map((verse) => (
          <div
            key={verse.number}
            data-verse={verse.number}
            className="flex items-start gap-4 px-5 py-3"
            style={{
              fontSize: `${fontSize}px`,
              lineHeight: '150%',
              color: '#ffffff'
            }}
          >
            <span
              className="shrink-0 font-bold text-right"
              style={{ minWidth: '1.2em', marginRight: '0.5rem' }}
            >
              {verse.number}
            </span>
            <span className="flex-1 text-justify">{verse.text}</span>
          </div>
        ))}
        <div style={{ height: '100vh' }} />
      </div>
    </div>
  )
}

function renderTimerContent(
  timerData: TimerTickPayload,
  stopwatchData: StopwatchTickPayload | null
): React.JSX.Element {
  const { mode, progress, mainDisplay, subDisplay, phase, overtimeMessage, reminderColor } =
    timerData

  const isFinishedWithMessage = phase === 'overtime' && overtimeMessage

  if (isFinishedWithMessage) {
    return (
      <div className="flex items-center justify-center w-full h-full @container">
        <span
          className="timer-digits text-[14cqi] text-center"
          style={{ color: reminderColor || '#ffffff' }}
        >
          {overtimeMessage}
        </span>
      </div>
    )
  }

  if (mode === 'timer') {
    return (
      <TimerDisplay
        progress={progress}
        mainDisplay={mainDisplay}
        subDisplay={subDisplay}
        phase={phase}
        size={700}
        responsive
        warningColor={reminderColor}
      />
    )
  }

  if (mode === 'clock') {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <ClockDisplay className="text-white" />
      </div>
    )
  }

  if (mode === 'both') {
    return (
      <div className="flex items-center w-full h-full px-8">
        <div className="w-[40%] h-full">
          <TimerDisplay
            progress={progress}
            mainDisplay={mainDisplay}
            subDisplay={subDisplay}
            phase={phase}
            size={700}
            responsive
            warningColor={reminderColor}
          />
        </div>
        <GlassDivider vertical className="mx-4" />
        <div className="w-[60%] flex items-center justify-center">
          <ClockDisplay className="text-white" />
        </div>
      </div>
    )
  }

  const formattedTime = stopwatchData?.formattedTime ?? '00:00'
  return (
    <StopwatchDisplay formattedTime={formattedTime} size={700} responsive className="text-white" />
  )
}
