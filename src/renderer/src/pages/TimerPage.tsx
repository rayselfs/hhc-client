import React, { useEffect, useRef } from 'react'
import { useTimerStore, getDisplayValues } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { selectFormattedTime } from '@renderer/stores/selectors/stopwatch'
import TimerDisplay from '@renderer/components/Timer/TimerDisplay'
import StopwatchDisplay from '@renderer/components/Timer/StopwatchDisplay'
import TimerControls from '@renderer/components/Timer/TimerControls'
import TimeAdjustment from '@renderer/components/Timer/TimeAdjustment'
import PresetChips from '@renderer/components/Timer/PresetChips'
import { useProjection } from '@renderer/contexts/ProjectionContext'

export default function TimerPage(): React.JSX.Element {
  const mode = useTimerStore((s) => s.mode)
  const phase = useTimerStore((s) => s.phase)
  const progress = useTimerStore((s) => s.progress)
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds)
  const overtimeSeconds = useTimerStore((s) => s.overtimeSeconds)
  const totalDuration = useTimerStore((s) => s.totalDuration)
  const reminderEnabled = useTimerStore((s) => s.reminderEnabled)
  const reminderDuration = useTimerStore((s) => s.reminderDuration)
  const reminderColor = useTimerStore((s) => s.reminderColor)
  const timerStatus = useTimerStore((s) => s.status)
  const setDuration = useTimerStore((s) => s.setDuration)

  const swFormattedTime = useStopwatchStore(selectFormattedTime)

  const { claimProjection, isProjectionOpen } = useProjection()

  const isTimerActive = timerStatus === 'running' || timerStatus === 'paused'
  const isTimerActiveRef = useRef(isTimerActive)
  useEffect(() => {
    isTimerActiveRef.current = isTimerActive
  })

  useEffect(() => {
    if (!isProjectionOpen) return
    claimProjection('timer', { unblank: isTimerActiveRef.current })
  }, [isProjectionOpen, claimProjection])

  const displayValues = getDisplayValues({
    phase,
    remainingSeconds,
    reminderDuration,
    overtimeSeconds,
    totalDuration,
    reminderEnabled
  })

  const isTimerLike = mode === 'timer' || mode === 'clock' || mode === 'both'
  const isClock = mode === 'clock'

  return (
    <div data-testid="timer-page" className="flex h-full gap-4">
      {isTimerLike && (
        <>
          <div className="w-18 shrink-0" />
          <div className="flex flex-col items-center gap-4 flex-1">
            <TimerDisplay
              progress={progress}
              mainDisplay={displayValues.mainDisplay}
              subDisplay={displayValues.subDisplay}
              phase={phase}
              overtimeDisplay={displayValues.overtimeDisplay}
              warningColor={reminderEnabled ? reminderColor : null}
              canEditTime={timerStatus === 'stopped' && phase !== 'overtime'}
              onTimeConfirm={(seconds) => setDuration(seconds)}
            />
            <TimerControls className="mb-3" mode={mode} disableStart={isClock} />
            <TimeAdjustment />
          </div>
          <PresetChips className="shrink-0" />
        </>
      )}

      {mode === 'stopwatch' && (
        <div className="flex flex-col items-center gap-4 flex-1 w-full">
          <StopwatchDisplay formattedTime={swFormattedTime} />
          <TimerControls mode="stopwatch" />
        </div>
      )}
    </div>
  )
}
