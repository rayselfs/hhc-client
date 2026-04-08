import React, { useEffect, useRef, useState } from 'react'
import { useTimerStore, getDisplayValues } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { createTimerAdapter } from '@renderer/lib/timer-adapter'
import type { TimerAdapter } from '@renderer/lib/timer-adapter'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import ModeSelector from '@renderer/components/Timer/ModeSelector'
import TimerDisplay from '@renderer/components/Timer/TimerDisplay'
import ClockDisplay from '@renderer/components/Timer/ClockDisplay'
import StopwatchDisplay from '@renderer/components/Timer/StopwatchDisplay'
import TimerControls from '@renderer/components/Timer/TimerControls'
import TimeAdjustment from '@renderer/components/Timer/TimeAdjustment'
import PresetChips from '@renderer/components/Timer/PresetChips'
import TimerSettings from '@renderer/components/Timer/TimerSettings'
import TimeInputDialog from '@renderer/components/Timer/TimeInputDialog'

export default function TimerPage(): React.JSX.Element {
  const mode = useTimerStore((s) => s.mode)
  const phase = useTimerStore((s) => s.phase)
  const progress = useTimerStore((s) => s.progress)
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds)
  const overtimeSeconds = useTimerStore((s) => s.overtimeSeconds)
  const totalDuration = useTimerStore((s) => s.totalDuration)
  const reminderEnabled = useTimerStore((s) => s.reminderEnabled)
  const reminderDuration = useTimerStore((s) => s.reminderDuration)
  const overtimeMessageEnabled = useTimerStore((s) => s.overtimeMessageEnabled)
  const overtimeMessage = useTimerStore((s) => s.overtimeMessage)
  const timerStatus = useTimerStore((s) => s.status)

  const swStatus = useStopwatchStore((s) => s.status)
  const swElapsedMs = useStopwatchStore((s) => s.elapsedMs)
  const swFormattedTime = useStopwatchStore((s) => s.formattedTime)
  const formattedTime = swFormattedTime

  const { project } = useProjection()

  const [dialogOpen, setDialogOpen] = useState(false)

  const adapterRef = useRef<TimerAdapter | null>(null)
  const prevTimerStatus = useRef(timerStatus)
  const prevSwStatus = useRef(swStatus)

  useEffect(() => {
    useTimerStore.getState().loadPresets()

    const adapter = createTimerAdapter()
    adapterRef.current = adapter

    adapter.onTick(() => {
      useTimerStore.getState().tick(Date.now())
    })

    adapter.onFinished(() => {
      useTimerStore.getState().tick(Date.now())
    })

    adapter.onStopwatchTick(() => {
      useStopwatchStore.getState().tick(Date.now())
    })

    return () => {
      adapter.dispose()
      adapterRef.current = null
    }
  }, [])

  useEffect(() => {
    const prev = prevTimerStatus.current
    prevTimerStatus.current = timerStatus

    const adapter = adapterRef.current
    if (!adapter) return

    if (prev === 'stopped' && timerStatus === 'running') {
      adapter.sendCommand({ type: 'start', durationMs: totalDuration * 1000 })
    } else if (prev === 'running' && timerStatus === 'paused') {
      adapter.sendCommand({ type: 'pause' })
    } else if (prev === 'paused' && timerStatus === 'running') {
      adapter.sendCommand({ type: 'resume' })
    } else if (prev !== 'stopped' && timerStatus === 'stopped') {
      adapter.sendCommand({ type: 'reset' })
    }
  }, [timerStatus, totalDuration])

  useEffect(() => {
    const prev = prevSwStatus.current
    prevSwStatus.current = swStatus

    const adapter = adapterRef.current
    if (!adapter) return

    if (prev === 'stopped' && swStatus === 'running') {
      adapter.sendCommand({ type: 'startStopwatch' })
    } else if (prev === 'running' && swStatus === 'paused') {
      adapter.sendCommand({ type: 'pauseStopwatch' })
    } else if (prev === 'paused' && swStatus === 'running') {
      adapter.sendCommand({ type: 'resumeStopwatch' })
    } else if (prev !== 'stopped' && swStatus === 'stopped') {
      adapter.sendCommand({ type: 'resetStopwatch' })
    }
  }, [swStatus])

  useEffect(() => {
    if (mode !== 'stopwatch') return
    project('timer:stopwatch', {
      elapsedMs: swElapsedMs,
      formattedTime: swFormattedTime,
      status: swStatus
    })
  }, [mode, swElapsedMs, swFormattedTime, swStatus, project])

  useEffect(() => {
    const displayValues = getDisplayValues({
      phase,
      remainingSeconds,
      reminderDuration,
      overtimeSeconds,
      totalDuration,
      reminderEnabled
    })

    project('timer:tick', {
      mode,
      remainingSeconds,
      phase,
      mainDisplay: displayValues.mainDisplay,
      subDisplay: displayValues.subDisplay,
      progress,
      overtimeSeconds,
      overtimeMessage: overtimeMessageEnabled ? overtimeMessage : null
    })
  }, [
    mode,
    phase,
    progress,
    remainingSeconds,
    overtimeSeconds,
    totalDuration,
    reminderEnabled,
    reminderDuration,
    overtimeMessageEnabled,
    overtimeMessage,
    project
  ])

  const displayValues = getDisplayValues({
    phase,
    remainingSeconds,
    reminderDuration,
    overtimeSeconds,
    totalDuration,
    reminderEnabled
  })

  return (
    <div data-testid="timer-page" className="flex flex-col items-center gap-4 p-6 h-full">
      <ModeSelector className="w-full justify-center" />

      {mode === 'timer' && (
        <div className="flex flex-col items-center gap-4 flex-1">
          <TimerDisplay
            progress={progress}
            mainDisplay={displayValues.mainDisplay}
            subDisplay={displayValues.subDisplay}
            phase={phase}
            overtimeDisplay={displayValues.overtimeDisplay}
            overtimeMessage={overtimeMessageEnabled ? overtimeMessage : undefined}
            onTimeClick={() => setDialogOpen(true)}
          />
          <TimerControls mode={mode} />
          <TimeAdjustment />
          <PresetChips />
          <TimerSettings />
        </div>
      )}

      {mode === 'clock' && (
        <div className="flex flex-1 items-center justify-center">
          <ClockDisplay size={96} />
        </div>
      )}

      {mode === 'both' && (
        <div className="flex flex-row flex-1 w-full items-center">
          <div className="flex items-center justify-center" style={{ flex: '0 0 42%' }}>
            <TimerDisplay
              progress={progress}
              mainDisplay={displayValues.mainDisplay}
              subDisplay={displayValues.subDisplay}
              phase={phase}
              overtimeDisplay={displayValues.overtimeDisplay}
              overtimeMessage={overtimeMessageEnabled ? overtimeMessage : undefined}
              onTimeClick={() => setDialogOpen(true)}
            />
          </div>
          <div className="flex items-center justify-center" style={{ flex: '0 0 58%' }}>
            <ClockDisplay size={80} />
          </div>
        </div>
      )}

      {mode === 'stopwatch' && (
        <div className="flex flex-col items-center gap-4 flex-1">
          <StopwatchDisplay formattedTime={formattedTime} size={80} />
          <TimerControls mode="stopwatch" />
        </div>
      )}

      <TimeInputDialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onConfirm={(seconds) => {
          useTimerStore.getState().setDuration(seconds)
          setDialogOpen(false)
        }}
      />
    </div>
  )
}
