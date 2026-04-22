import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTimerStore, getDisplayValues } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { useSettingsStore } from '@renderer/stores/settings'
import { selectFormattedTime } from '@renderer/stores/selectors/stopwatch'
import { useProjection } from '@renderer/contexts/ProjectionContext'

export default function TimerProjectionBridge(): null {
  const {
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
    status: timerStatus
  } = useTimerStore(
    useShallow((s) => ({
      mode: s.mode,
      phase: s.phase,
      progress: s.progress,
      remainingSeconds: s.remainingSeconds,
      overtimeSeconds: s.overtimeSeconds,
      totalDuration: s.totalDuration,
      reminderEnabled: s.reminderEnabled,
      reminderDuration: s.reminderDuration,
      reminderColor: s.reminderColor,
      overtimeMessageEnabled: s.overtimeMessageEnabled,
      overtimeMessage: s.overtimeMessage,
      status: s.status
    }))
  )

  const swStatus = useStopwatchStore((s) => s.status)
  const swElapsedMs = useStopwatchStore((s) => s.elapsedMs)
  const swFormattedTime = useStopwatchStore(selectFormattedTime)
  const showSwOnProjection = useStopwatchStore((s) => s.showOnProjection)

  const timezone = useSettingsStore((s) => s.timezone)

  const { project, send, isProjectionOpen } = useProjection()

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
      overtimeMessage: overtimeMessageEnabled ? overtimeMessage : null,
      reminderColor: reminderEnabled ? reminderColor : null
    })
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
