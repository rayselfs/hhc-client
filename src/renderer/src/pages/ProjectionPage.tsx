import { useState, useEffect } from 'react'
import { createProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isWeb } from '@renderer/lib/env'
import { useSettingsStore } from '@renderer/stores/settings'
import DefaultProjection from '@renderer/components/projection/DefaultProjection'
import TimerDisplay from '@renderer/components/Timer/TimerDisplay'
import ClockDisplay from '@renderer/components/Timer/ClockDisplay'
import StopwatchDisplay from '@renderer/components/Timer/StopwatchDisplay'
import GlassDivider from '@renderer/components/GlassDivider'
import type { TimerTickPayload, StopwatchTickPayload } from '@shared/types/timer'

type ActiveContent = 'timer' | 'bible' | null

export default function ProjectionPage(): React.JSX.Element {
  const [showDefault, setShowDefault] = useState(true)
  const [activeContent, setActiveContent] = useState<ActiveContent>(null)
  const [timerData, setTimerData] = useState<TimerTickPayload | null>(null)
  const [stopwatchData, setStopwatchData] = useState<StopwatchTickPayload | null>(null)
  const [bibleVerse, setBibleVerse] = useState<{
    reference: string
    text: string
    fontSize: number
  } | null>(null)

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

    const unsubBibleVerse = adapter.on('bible:verse', (data) => {
      setBibleVerse(data)
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
      unsubBibleVerse()
      unsubTimezone()
      unsubClose()
      unsubPing()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      adapter.dispose()
    }
  }, [])

  if (showDefault) return <DefaultProjection />

  if (activeContent === 'bible' && bibleVerse) {
    const fontSize = bibleVerse.fontSize || 90
    const referenceSize = Math.max(16, fontSize * 0.4)
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center px-16">
        <p className="text-white leading-relaxed text-center" style={{ fontSize: `${fontSize}px` }}>
          {bibleVerse.text}
        </p>
        <p className="text-white/60 mt-8" style={{ fontSize: `${referenceSize}px` }}>
          {bibleVerse.reference}
        </p>
      </div>
    )
  }

  if (timerData) {
    return (
      <div className="h-screen w-full bg-black">{renderTimerContent(timerData, stopwatchData)}</div>
    )
  }

  return <DefaultProjection />
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
