import TimerDisplay from '@renderer/components/Control/Timer/TimerDisplay'
import ClockDisplay from '@renderer/components/Control/Timer/ClockDisplay'
import StopwatchDisplay from '@renderer/components/Control/Timer/StopwatchDisplay'
import GlassDivider from '@renderer/components/Common/GlassDivider'
import type { TimerTickPayload, StopwatchTickPayload } from '@shared/types/timer'

interface TimerProjectionProps {
  timerData: TimerTickPayload
  stopwatchData: StopwatchTickPayload | null
}

export default function TimerProjection({
  timerData,
  stopwatchData
}: TimerProjectionProps): React.JSX.Element {
  const { mode, progress, mainDisplay, subDisplay, phase, overtimeMessage, reminderColor } =
    timerData

  const isFinishedWithMessage = phase === 'overtime' && overtimeMessage

  if (isFinishedWithMessage) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center @container">
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
      <div className="h-screen w-full bg-black">
        <TimerDisplay
          progress={progress}
          mainDisplay={mainDisplay}
          subDisplay={subDisplay}
          phase={phase}
          size={700}
          responsive
          warningColor={reminderColor}
          digitClassName="text-accent-foreground"
        />
      </div>
    )
  }

  if (mode === 'clock') {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <ClockDisplay className="text-white" />
      </div>
    )
  }

  if (mode === 'both') {
    return (
      <div className="h-screen w-full bg-black flex items-center px-8">
        <div className="w-[40%] h-full">
          <TimerDisplay
            progress={progress}
            mainDisplay={mainDisplay}
            subDisplay={subDisplay}
            phase={phase}
            size={700}
            responsive
            warningColor={reminderColor}
            digitClassName="text-accent-foreground"
          />
        </div>
        <GlassDivider vertical thickness={3} className="mx-4" />
        <div className="w-[60%] flex items-center justify-center">
          <ClockDisplay className="text-white" />
        </div>
      </div>
    )
  }

  const formattedTime = stopwatchData?.formattedTime ?? '00:00'
  return (
    <div className="h-screen w-full bg-black">
      <StopwatchDisplay
        formattedTime={formattedTime}
        size={700}
        responsive
        className="text-white"
      />
    </div>
  )
}
