import { useState, useEffect } from 'react'
import { createProjectionAdapter } from '@renderer/lib/projection-adapter'
import { isElectron } from '@renderer/lib/env'
import DefaultProjection from '@renderer/components/projection/DefaultProjection'
import TimerDisplay from '@renderer/components/Timer/TimerDisplay'
import ClockDisplay from '@renderer/components/Timer/ClockDisplay'
import StopwatchDisplay from '@renderer/components/Timer/StopwatchDisplay'
import type { TimerTickPayload, StopwatchTickPayload } from '@shared/types/timer'

export default function ProjectionPage(): React.JSX.Element {
  const [showDefault, setShowDefault] = useState(true)
  const [timerData, setTimerData] = useState<TimerTickPayload | null>(null)
  const [stopwatchData, setStopwatchData] = useState<StopwatchTickPayload | null>(null)

  useEffect(() => {
    const adapter = createProjectionAdapter('projection')

    const unsubBlank = adapter.on('__system:blank', ({ showDefault: blank }) => {
      setShowDefault(blank)
    })

    const unsubTimerTick = adapter.on('timer:tick', (data) => {
      setTimerData(data)
    })

    const unsubStopwatch = adapter.on('timer:stopwatch', (data) => {
      setStopwatchData(data)
    })

    let unsubClose = (): void => {}
    let unsubPing = (): void => {}

    if (!isElectron()) {
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
      if (!isElectron()) {
        adapter.send('__system:closed', null)
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      unsubBlank()
      unsubTimerTick()
      unsubStopwatch()
      unsubClose()
      unsubPing()
      window.removeEventListener('beforeunload', handleBeforeUnload)
      adapter.dispose()
    }
  }, [])

  if (showDefault) return <DefaultProjection />

  if (timerData) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        {renderTimerContent(timerData, stopwatchData)}
      </div>
    )
  }

  return <DefaultProjection />
}

function renderTimerContent(
  timerData: TimerTickPayload,
  stopwatchData: StopwatchTickPayload | null
): React.JSX.Element {
  const { mode, progress, mainDisplay, subDisplay, phase, overtimeMessage } = timerData

  if (mode === 'timer') {
    return (
      <TimerDisplay
        progress={progress}
        mainDisplay={mainDisplay}
        subDisplay={subDisplay}
        phase={phase}
        overtimeMessage={overtimeMessage ?? undefined}
        size={700}
      />
    )
  }

  if (mode === 'clock') {
    return <ClockDisplay size={120} className="text-white" />
  }

  if (mode === 'both') {
    return (
      <div className="flex flex-row items-center justify-center gap-16 w-full">
        <TimerDisplay
          progress={progress}
          mainDisplay={mainDisplay}
          subDisplay={subDisplay}
          phase={phase}
          overtimeMessage={overtimeMessage ?? undefined}
          size={500}
        />
        <ClockDisplay size={80} className="text-white" />
      </div>
    )
  }

  const formattedTime = stopwatchData?.formattedTime ?? '00:00.00'
  return <StopwatchDisplay formattedTime={formattedTime} size={120} className="text-white" />
}
