import { useEffect } from 'react'
import { useTimerStore, getDisplayValues } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { useSettingsStore } from '@renderer/stores/settings'
import { selectFormattedTime } from '@renderer/stores/selectors/stopwatch'
import { useProjection } from '@renderer/contexts/ProjectionContext'

export default function TimerProjectionBridge(): null {
  const mode = useTimerStore((s) => s.mode)
  const phase = useTimerStore((s) => s.phase)
  const progress = useTimerStore((s) => s.progress)
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds)
  const overtimeSeconds = useTimerStore((s) => s.overtimeSeconds)
  const totalDuration = useTimerStore((s) => s.totalDuration)
  const reminderEnabled = useTimerStore((s) => s.reminderEnabled)
  const reminderDuration = useTimerStore((s) => s.reminderDuration)
  const reminderColor = useTimerStore((s) => s.reminderColor)
  const overtimeMessageEnabled = useTimerStore((s) => s.overtimeMessageEnabled)
  const overtimeMessage = useTimerStore((s) => s.overtimeMessage)
  const timerStatus = useTimerStore((s) => s.status)

  const swStatus = useStopwatchStore((s) => s.status)
  const swElapsedMs = useStopwatchStore((s) => s.elapsedMs)
  const swFormattedTime = useStopwatchStore(selectFormattedTime)
  const showSwOnProjection = useStopwatchStore((s) => s.showOnProjection)

  const timezone = useSettingsStore((s) => s.timezone)

  const { project, send, isProjectionOpen } = useProjection()

  useEffect(() => {
    if (mode !== 'stopwatch') return
    if (!showSwOnProjection) return
    const autoShow = swStatus === 'running' || swStatus === 'paused'
    project(
      'timer:stopwatch',
      {
        elapsedMs: swElapsedMs,
        formattedTime: swFormattedTime,
        status: swStatus
      },
      { autoOpen: autoShow, autoShow }
    )
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
    const autoShow = timerStatus === 'running' || timerStatus === 'paused'

    project(
      'timer:tick',
      {
        mode: projectionMode,
        remainingSeconds,
        phase,
        mainDisplay: displayValues.mainDisplay,
        subDisplay: displayValues.subDisplay,
        progress,
        overtimeSeconds,
        overtimeMessage: overtimeMessageEnabled ? overtimeMessage : null,
        reminderColor: reminderEnabled ? reminderColor : null
      },
      { autoOpen: autoShow, autoShow }
    )
  }, [
    timerStatus,
    mode,
    phase,
    progress,
    remainingSeconds,
    overtimeSeconds,
    totalDuration,
    reminderEnabled,
    reminderDuration,
    reminderColor,
    overtimeMessageEnabled,
    overtimeMessage,
    showSwOnProjection,
    project
  ])

  useEffect(() => {
    if (!isProjectionOpen) return
    send('settings:timezone', { timezone })
  }, [timezone, isProjectionOpen, send])

  return null
}
