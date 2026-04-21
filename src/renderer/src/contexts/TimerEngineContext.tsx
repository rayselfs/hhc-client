import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createTimerAdapter } from '@renderer/lib/timer-adapter'
import type { TimerAdapter } from '@renderer/lib/timer-adapter'
import { useTimerStore } from '@renderer/stores/timer'
import { useStopwatchStore } from '@renderer/stores/stopwatch'

const TimerEngineContext = createContext<TimerAdapter | null>(null)

export function TimerEngineProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const adapterRef = useRef<TimerAdapter | null>(null)
  const [adapter, setAdapter] = useState<TimerAdapter | null>(null)

  const timerStatus = useTimerStore((s) => s.status)
  const totalDuration = useTimerStore((s) => s.totalDuration)
  const swStatus = useStopwatchStore((s) => s.status)

  const prevTimerStatus = useRef(timerStatus)
  const prevSwStatus = useRef(swStatus)

  useEffect(() => {
    const a = createTimerAdapter()
    adapterRef.current = a
    // Resource created in effect (Worker lifecycle requires cleanup) — expose via state for context
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAdapter(a)

    a.onTick(() => {
      useTimerStore.getState().tick(Date.now())
    })

    a.onFinished(() => {
      useTimerStore.getState().tick(Date.now())
    })

    a.onStopwatchTick(() => {
      useStopwatchStore.getState().tick(Date.now())
    })

    return () => {
      a.dispose()
      adapterRef.current = null
      setAdapter(null)
    }
  }, [])

  useEffect(() => {
    const prev = prevTimerStatus.current
    prevTimerStatus.current = timerStatus

    const a = adapterRef.current
    if (!a) return

    if (prev === 'stopped' && timerStatus === 'running') {
      a.sendCommand({ type: 'start', durationMs: totalDuration * 1000 })
    } else if (prev === 'running' && timerStatus === 'paused') {
      a.sendCommand({ type: 'pause' })
    } else if (prev === 'paused' && timerStatus === 'running') {
      a.sendCommand({ type: 'resume' })
    } else if (prev !== 'stopped' && timerStatus === 'stopped') {
      a.sendCommand({ type: 'reset' })
    }
  }, [timerStatus, totalDuration])

  useEffect(() => {
    const prev = prevSwStatus.current
    prevSwStatus.current = swStatus

    const a = adapterRef.current
    if (!a) return

    if (prev === 'stopped' && swStatus === 'running') {
      a.sendCommand({ type: 'startStopwatch' })
    } else if (prev === 'running' && swStatus === 'paused') {
      a.sendCommand({ type: 'pauseStopwatch' })
    } else if (prev === 'paused' && swStatus === 'running') {
      a.sendCommand({ type: 'resumeStopwatch' })
    } else if (prev !== 'stopped' && swStatus === 'stopped') {
      a.sendCommand({ type: 'resetStopwatch' })
    }
  }, [swStatus])

  useEffect(() => {
    if (swStatus !== 'running') return
    const id = setInterval(() => {
      useStopwatchStore.getState().tick(Date.now())
    }, 100)
    return () => clearInterval(id)
  }, [swStatus])

  return <TimerEngineContext.Provider value={adapter}>{children}</TimerEngineContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTimerEngine(): TimerAdapter | null {
  return useContext(TimerEngineContext)
}
