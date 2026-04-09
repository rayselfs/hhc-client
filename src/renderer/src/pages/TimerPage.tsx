import React, { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useTimerStore, getDisplayValues } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { createTimerAdapter } from '@renderer/lib/timer-adapter'
import type { TimerAdapter } from '@renderer/lib/timer-adapter'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import TimerDisplay from '@renderer/components/Timer/TimerDisplay'
import StopwatchDisplay from '@renderer/components/Timer/StopwatchDisplay'
import TimerControls from '@renderer/components/Timer/TimerControls'
import TimeAdjustment from '@renderer/components/Timer/TimeAdjustment'
import PresetChips from '@renderer/components/Timer/PresetChips'
import TimerSettings from '@renderer/components/Timer/TimerSettings'
import { Switch } from '@heroui/react'

export default function TimerPage(): React.JSX.Element {
  const { t } = useTranslation()
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
  const showSwOnProjection = useStopwatchStore((s) => s.showOnProjection)

  const { project } = useProjection()

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
    if (!showSwOnProjection) return
    project('timer:stopwatch', {
      elapsedMs: swElapsedMs,
      formattedTime: swFormattedTime,
      status: swStatus
    })
  }, [mode, swElapsedMs, swFormattedTime, swStatus, showSwOnProjection, project])

  useEffect(() => {
    const displayValues = getDisplayValues({
      phase,
      remainingSeconds,
      reminderDuration,
      overtimeSeconds,
      totalDuration,
      reminderEnabled
    })

    const projectionMode = mode === 'stopwatch' && !showSwOnProjection ? 'clock' : mode

    project('timer:tick', {
      mode: projectionMode,
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
    showSwOnProjection,
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
            overtimeMessage={overtimeMessageEnabled ? overtimeMessage : undefined}
            canEditTime={timerStatus === 'stopped'}
            onTimeConfirm={(seconds) => useTimerStore.getState().setDuration(seconds)}
          />
          <TimeAdjustment className="mb-3" />
          <TimerControls mode={mode} disableStart={isClock} />
          <PresetChips className="self-start my-3" />
          <TimerSettings className="self-start mb-3" />
        </div>
      )}

      {mode === 'stopwatch' && (
        <div className="flex flex-col items-center gap-4 flex-1">
          <StopwatchDisplay formattedTime={swFormattedTime} size={80} />
          <TimerControls mode="stopwatch" />
          <div className="self-start mt-3" data-testid="stopwatch-settings">
            <h3 className="text-sm font-medium text-default-500 mb-2">
              {t('timer.timerSettings')}
            </h3>
            <Switch
              size="sm"
              isSelected={showSwOnProjection}
              onChange={() => useStopwatchStore.getState().setShowOnProjection(!showSwOnProjection)}
              aria-label={t('timer.stopwatch.showOnProjection')}
              data-testid="switch-show-stopwatch-projection"
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <span className="text-sm">{t('timer.stopwatch.showOnProjection')}</span>
            </Switch>
          </div>
        </div>
      )}
    </div>
  )
}
