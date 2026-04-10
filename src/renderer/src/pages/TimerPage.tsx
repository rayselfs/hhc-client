import React from 'react'
import { useTimerStore, getDisplayValues } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { selectFormattedTime } from '@renderer/stores/selectors/stopwatch'
import TimerDisplay from '@renderer/components/Timer/TimerDisplay'
import StopwatchDisplay from '@renderer/components/Timer/StopwatchDisplay'
import TimerControls from '@renderer/components/Timer/TimerControls'
import TimeAdjustment from '@renderer/components/Timer/TimeAdjustment'
import PresetChips from '@renderer/components/Timer/PresetChips'
import TimerSettings from '@renderer/components/Timer/TimerSettings'

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
    <div data-testid="timer-page" className="flex flex-col items-center gap-4 h-full">
      {isTimerLike && (
        <div className="flex flex-col items-center gap-4 flex-1 w-full">
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
          <TimeAdjustment className="mb-3" />
          <TimerControls mode={mode} disableStart={isClock} />
          <PresetChips className="self-start my-3" />
          <TimerSettings mode={mode} className="self-start mb-3" />
        </div>
      )}

      {mode === 'stopwatch' && (
        <div className="flex flex-col items-center gap-4 flex-1 w-full">
          <StopwatchDisplay formattedTime={swFormattedTime} size={80} />
          <TimerControls mode="stopwatch" />
          <TimerSettings mode="stopwatch" className="self-start mt-3" />
        </div>
      )}
    </div>
  )
}
