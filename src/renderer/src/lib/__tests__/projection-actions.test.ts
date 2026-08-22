import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, DEFAULT_STATE, useTimerStore } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { useSettingsStore } from '@renderer/stores/settings'
import { startTimerProjection } from '../projection-actions'

describe('projection actions', () => {
  beforeEach(() => {
    useTimerStore.setState({
      ...DEFAULT_SETTINGS,
      ...DEFAULT_STATE,
      mode: 'timer',
      targetEndTime: null,
      presets: []
    })
    useStopwatchStore.setState({
      status: 'stopped',
      elapsedMs: 0,
      startTimestamp: null,
      accumulatedMs: 0,
      showOnProjection: false
    })
    useSettingsStore.setState({
      timezone: 'Asia/Taipei',
      timerRingColor: '#22c55e',
      timerRingColorEnabled: true
    })
  })

  it('starts timer projection with an immediate timer snapshot', async () => {
    const startProjection = vi.fn(() => Promise.resolve())

    await startTimerProjection({ startProjection })

    expect(startProjection).toHaveBeenCalledWith(
      'timer',
      expect.arrayContaining([
        [
          'timer:tick',
          expect.objectContaining({
            mode: 'timer',
            phase: 'idle',
            reminderColor: null
          })
        ],
        ['settings:timezone', { timezone: 'Asia/Taipei' }],
        ['settings:timer-ring-color', { color: '#22c55e' }]
      ])
    )
  })

  it('includes stopwatch payload when stopwatch is projected', async () => {
    const startProjection = vi.fn(() => Promise.resolve())
    useTimerStore.setState({ mode: 'stopwatch' })
    useStopwatchStore.setState({
      status: 'running',
      elapsedMs: 1234,
      showOnProjection: true
    })

    await startTimerProjection({ startProjection })

    expect(startProjection).toHaveBeenCalledWith(
      'timer',
      expect.arrayContaining([
        [
          'timer:tick',
          expect.objectContaining({
            mode: 'stopwatch'
          })
        ],
        [
          'timer:stopwatch',
          expect.objectContaining({
            elapsedMs: 1234,
            formattedTime: '00:01',
            status: 'running'
          })
        ]
      ])
    )
  })
})
