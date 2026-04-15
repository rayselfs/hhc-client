import { useState, useEffect } from 'react'
import { createProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isWeb } from '@renderer/lib/env'
import { useSettingsStore } from '@renderer/stores/settings'
import DefaultProjection from '@renderer/components/Projection/DefaultProjection'
import BibleProjection from '@renderer/components/Projection/BibleProjection'
import TimerProjection from '@renderer/components/Projection/TimerProjection'
import type { BibleChapterData } from '@renderer/components/Projection/BibleProjection'
import type { TimerTickPayload, StopwatchTickPayload } from '@shared/types/timer'

type ActiveContent = 'timer' | 'bible' | null

export default function ProjectionPage(): React.JSX.Element {
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
    return <BibleProjection data={bibleChapter} fontSize={bibleFontSize} />
  }

  if (timerData) {
    return <TimerProjection timerData={timerData} stopwatchData={stopwatchData} />
  }

  return <DefaultProjection />
}
