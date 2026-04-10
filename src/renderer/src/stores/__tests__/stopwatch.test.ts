import { describe, it, expect, beforeEach } from 'vitest'
import { useStopwatchStore } from '@renderer/stores/stopwatch'
import { selectFormattedTime, selectElapsedSeconds } from '@renderer/stores/selectors/stopwatch'
import type { StopwatchStatus } from '@shared/types/timer'

const INITIAL_STATE = {
  status: 'stopped' as StopwatchStatus,
  elapsedMs: 0,
  startTimestamp: null,
  accumulatedMs: 0
}

beforeEach(() => {
  useStopwatchStore.setState(INITIAL_STATE)
})

describe('initial state', () => {
  it('starts stopped with 0ms elapsed', () => {
    const s = useStopwatchStore.getState()
    expect(s.status).toBe('stopped')
    expect(s.elapsedMs).toBe(0)
    expect(s.startTimestamp).toBeNull()
    expect(s.accumulatedMs).toBe(0)
    expect(selectFormattedTime(s)).toBe('00:00')
    expect(selectElapsedSeconds(s)).toBe(0)
  })
})

describe('selectors', () => {
  it('isStopped() returns true initially', () => {
    expect(useStopwatchStore.getState().isStopped()).toBe(true)
  })

  it('isRunning() returns false initially', () => {
    expect(useStopwatchStore.getState().isRunning()).toBe(false)
  })

  it('isPaused() returns false initially', () => {
    expect(useStopwatchStore.getState().isPaused()).toBe(false)
  })
})

describe('start()', () => {
  it('transitions from stopped to running', () => {
    useStopwatchStore.getState().start()
    expect(useStopwatchStore.getState().status).toBe('running')
  })

  it('sets startTimestamp when starting', () => {
    const before = Date.now()
    useStopwatchStore.getState().start()
    const after = Date.now()
    const ts = useStopwatchStore.getState().startTimestamp
    expect(ts).not.toBeNull()
    expect(ts!).toBeGreaterThanOrEqual(before)
    expect(ts!).toBeLessThanOrEqual(after)
  })

  it('resets elapsed to 0 on start', () => {
    useStopwatchStore.setState({ elapsedMs: 5000, accumulatedMs: 5000 })
    useStopwatchStore.getState().start()
    expect(useStopwatchStore.getState().elapsedMs).toBe(0)
    expect(useStopwatchStore.getState().accumulatedMs).toBe(0)
    expect(selectFormattedTime(useStopwatchStore.getState())).toBe('00:00')
  })

  it('is a no-op when already running', () => {
    useStopwatchStore.getState().start()
    const tsFirst = useStopwatchStore.getState().startTimestamp
    useStopwatchStore.getState().start()
    const tsSecond = useStopwatchStore.getState().startTimestamp
    expect(tsSecond).toBe(tsFirst)
  })

  it('sets isRunning() to true', () => {
    useStopwatchStore.getState().start()
    expect(useStopwatchStore.getState().isRunning()).toBe(true)
  })
})

describe('pause()', () => {
  it('transitions from running to paused', () => {
    useStopwatchStore.getState().start()
    useStopwatchStore.getState().pause()
    expect(useStopwatchStore.getState().status).toBe('paused')
  })

  it('preserves elapsed time on pause', () => {
    const startTime = 1000
    useStopwatchStore.setState({
      status: 'running',
      startTimestamp: startTime,
      accumulatedMs: 0
    })
    useStopwatchStore.getState().tick(startTime + 2000)
    useStopwatchStore.getState().pause()
    const s = useStopwatchStore.getState()
    expect(s.elapsedMs).toBeGreaterThanOrEqual(2000)
    expect(s.startTimestamp).toBeNull()
  })

  it('is a no-op when already paused', () => {
    useStopwatchStore.getState().start()
    useStopwatchStore.getState().pause()
    const elapsed1 = useStopwatchStore.getState().elapsedMs
    useStopwatchStore.getState().pause()
    expect(useStopwatchStore.getState().elapsedMs).toBe(elapsed1)
    expect(useStopwatchStore.getState().status).toBe('paused')
  })

  it('is a no-op when stopped', () => {
    useStopwatchStore.getState().pause()
    expect(useStopwatchStore.getState().status).toBe('stopped')
  })

  it('sets isPaused() to true', () => {
    useStopwatchStore.getState().start()
    useStopwatchStore.getState().pause()
    expect(useStopwatchStore.getState().isPaused()).toBe(true)
  })
})

describe('resume()', () => {
  it('transitions from paused to running', () => {
    useStopwatchStore.getState().start()
    useStopwatchStore.getState().pause()
    useStopwatchStore.getState().resume()
    expect(useStopwatchStore.getState().status).toBe('running')
  })

  it('sets a new startTimestamp on resume', () => {
    useStopwatchStore.getState().start()
    useStopwatchStore.getState().pause()
    const before = Date.now()
    useStopwatchStore.getState().resume()
    const after = Date.now()
    const ts = useStopwatchStore.getState().startTimestamp
    expect(ts).not.toBeNull()
    expect(ts!).toBeGreaterThanOrEqual(before)
    expect(ts!).toBeLessThanOrEqual(after)
  })

  it('is a no-op when already running', () => {
    useStopwatchStore.getState().start()
    const ts1 = useStopwatchStore.getState().startTimestamp
    useStopwatchStore.getState().resume()
    expect(useStopwatchStore.getState().status).toBe('running')
    expect(useStopwatchStore.getState().startTimestamp).toBe(ts1)
  })

  it('is a no-op when stopped', () => {
    useStopwatchStore.getState().resume()
    expect(useStopwatchStore.getState().status).toBe('stopped')
  })
})

describe('reset()', () => {
  it('transitions from stopped to stopped', () => {
    useStopwatchStore.getState().reset()
    expect(useStopwatchStore.getState().status).toBe('stopped')
  })

  it('stops and clears elapsed when running', () => {
    useStopwatchStore.getState().start()
    useStopwatchStore.setState({ elapsedMs: 5000, accumulatedMs: 5000 })
    useStopwatchStore.getState().reset()
    const s = useStopwatchStore.getState()
    expect(s.status).toBe('stopped')
    expect(s.elapsedMs).toBe(0)
    expect(s.accumulatedMs).toBe(0)
    expect(s.startTimestamp).toBeNull()
    expect(selectFormattedTime(s)).toBe('00:00')
    expect(selectElapsedSeconds(s)).toBe(0)
  })

  it('stops and clears elapsed when paused', () => {
    useStopwatchStore.getState().start()
    useStopwatchStore.getState().pause()
    useStopwatchStore.getState().reset()
    const s = useStopwatchStore.getState()
    expect(s.status).toBe('stopped')
    expect(s.elapsedMs).toBe(0)
    expect(selectFormattedTime(s)).toBe('00:00')
  })

  it('sets isStopped() to true after reset from any state', () => {
    useStopwatchStore.getState().start()
    useStopwatchStore.getState().reset()
    expect(useStopwatchStore.getState().isStopped()).toBe(true)
  })
})

describe('tick()', () => {
  it('updates elapsedMs when running', () => {
    const startTime = 10000
    useStopwatchStore.setState({
      status: 'running',
      startTimestamp: startTime,
      accumulatedMs: 0
    })
    useStopwatchStore.getState().tick(startTime + 3000)
    expect(useStopwatchStore.getState().elapsedMs).toBe(3000)
  })

  it('is a no-op when paused', () => {
    const startTime = 10000
    useStopwatchStore.setState({
      status: 'running',
      startTimestamp: startTime,
      accumulatedMs: 0
    })
    useStopwatchStore.getState().tick(startTime + 1000)
    useStopwatchStore.getState().pause()
    const elapsedAfterPause = useStopwatchStore.getState().elapsedMs

    useStopwatchStore.getState().tick(startTime + 5000)
    expect(useStopwatchStore.getState().elapsedMs).toBe(elapsedAfterPause)
  })

  it('is a no-op when stopped', () => {
    useStopwatchStore.getState().tick(10000)
    expect(useStopwatchStore.getState().elapsedMs).toBe(0)
  })

  it('accumulates correctly across pause/resume', () => {
    const t0 = 10000
    useStopwatchStore.setState({
      status: 'running',
      startTimestamp: t0,
      accumulatedMs: 0
    })
    useStopwatchStore.getState().tick(t0 + 2000)
    useStopwatchStore.getState().pause()
    expect(useStopwatchStore.getState().elapsedMs).toBeGreaterThanOrEqual(2000)

    const t1 = Date.now()
    useStopwatchStore.setState({
      status: 'running',
      startTimestamp: t1,
      accumulatedMs: useStopwatchStore.getState().elapsedMs
    })
    useStopwatchStore.getState().tick(t1 + 3000)
    expect(useStopwatchStore.getState().elapsedMs).toBeGreaterThanOrEqual(5000)
  })

  it('updates elapsedSeconds correctly', () => {
    const startTime = 20000
    useStopwatchStore.setState({
      status: 'running',
      startTimestamp: startTime,
      accumulatedMs: 0
    })
    useStopwatchStore.getState().tick(startTime + 4500)
    expect(selectElapsedSeconds(useStopwatchStore.getState())).toBe(4)
  })
})

describe('formattedTime', () => {
  it('shows 00:00 at 0ms', () => {
    expect(selectFormattedTime(useStopwatchStore.getState())).toBe('00:00')
  })

  it('shows 00:01 at 1000ms', () => {
    const startTime = 5000
    useStopwatchStore.setState({
      status: 'running',
      startTimestamp: startTime,
      accumulatedMs: 0
    })
    useStopwatchStore.getState().tick(startTime + 1000)
    expect(selectFormattedTime(useStopwatchStore.getState())).toBe('00:01')
  })

  it('shows 01:30 at 90500ms', () => {
    const startTime = 0
    useStopwatchStore.setState({
      status: 'running',
      startTimestamp: startTime,
      accumulatedMs: 0
    })
    useStopwatchStore.getState().tick(90500)
    expect(selectFormattedTime(useStopwatchStore.getState())).toBe('01:30')
  })

  it('shows 61:01 at 3661234ms (no hours, just keeps counting minutes)', () => {
    const startTime = 0
    useStopwatchStore.setState({
      status: 'running',
      startTimestamp: startTime,
      accumulatedMs: 0
    })
    useStopwatchStore.getState().tick(3661234)
    expect(selectFormattedTime(useStopwatchStore.getState())).toBe('61:01')
  })

  it('updates formattedTime on tick', () => {
    const startTime = 0
    useStopwatchStore.setState({
      status: 'running',
      startTimestamp: startTime,
      accumulatedMs: 0
    })
    useStopwatchStore.getState().tick(500)
    expect(selectFormattedTime(useStopwatchStore.getState())).toBe('00:00')
  })

  it('preserves formattedTime after pause', () => {
    const startTime = 0
    useStopwatchStore.setState({
      status: 'running',
      startTimestamp: startTime,
      accumulatedMs: 0
    })
    useStopwatchStore.getState().tick(2500)
    useStopwatchStore.getState().pause()
    expect(selectFormattedTime(useStopwatchStore.getState())).toBe('00:02')
  })
})
