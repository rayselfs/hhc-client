import { useSyncExternalStore } from 'react'
import { useTimerConfigStore } from './timer-config'
import { useTimerRuntimeStore, formatTime, computeProgress } from './timer-runtime'
import type { TimerConfigState } from './timer-config'
import type { TimerRuntimeState } from './timer-runtime'
import type { TimerMode, TimerStatus, TimerPhase } from '@shared/types/timer'

export { useTimerConfigStore } from './timer-config'
export { useTimerRuntimeStore } from './timer-runtime'
export { DEFAULT_SETTINGS, DEFAULT_PRESETS } from './timer-config'
export { DEFAULT_STATE } from './timer-runtime'
export type { TimerConfigState } from './timer-config'
export type { TimerRuntimeState } from './timer-runtime'

export interface TimerStore extends TimerConfigState, TimerRuntimeState {}

type TimerStoreListener = (state: TimerStore, prevState: TimerStore) => void
type TimerSelectorListener<T> = (selectedState: T, prevSelectedState: T) => void

const CONFIG_KEYS = new Set<string>([
  'mode',
  'totalDuration',
  'reminderEnabled',
  'reminderDuration',
  'reminderColor',
  'overtimeMessageEnabled',
  'overtimeMessage',
  'presets',
  'setOvertimeMessage',
  'addPreset',
  'removePreset'
])

let cachedConfigState = useTimerConfigStore.getState()
let cachedRuntimeState = useTimerRuntimeStore.getState()
let cachedCombinedState = { ...cachedConfigState, ...cachedRuntimeState } as TimerStore

function getCombinedState(): TimerStore {
  const config = useTimerConfigStore.getState()
  const runtime = useTimerRuntimeStore.getState()
  if (config !== cachedConfigState || runtime !== cachedRuntimeState) {
    cachedConfigState = config
    cachedRuntimeState = runtime
    cachedCombinedState = { ...config, ...runtime } as TimerStore
  }
  return cachedCombinedState
}

function subscribeCombined(listener: () => void): () => void {
  const unsubConfig = useTimerConfigStore.subscribe(listener)
  const unsubRuntime = useTimerRuntimeStore.subscribe(listener)
  return () => {
    unsubConfig()
    unsubRuntime()
  }
}

export function useTimerStore(): TimerStore
export function useTimerStore<T>(selector: (s: TimerStore) => T): T
export function useTimerStore<T>(selector?: (s: TimerStore) => T): TimerStore | T {
  return useSyncExternalStore(
    subscribeCombined,
    () => (selector ? selector(getCombinedState()) : getCombinedState()),
    () => (selector ? selector(getCombinedState()) : getCombinedState())
  )
}

useTimerStore.getState = getCombinedState

useTimerStore.setState = (partial: Partial<TimerStore>) => {
  const configPart: Record<string, unknown> = {}
  const runtimePart: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(partial as Record<string, unknown>)) {
    if (CONFIG_KEYS.has(k)) {
      configPart[k] = v
    } else {
      runtimePart[k] = v
    }
  }
  if (Object.keys(configPart).length > 0) {
    useTimerConfigStore.setState(configPart as Partial<TimerConfigState>)
  }
  if (Object.keys(runtimePart).length > 0) {
    useTimerRuntimeStore.setState(runtimePart as Partial<TimerRuntimeState>)
  }
}

function subscribeTimerStore(listener: TimerStoreListener): () => void
function subscribeTimerStore<T>(
  selector: (state: TimerStore) => T,
  listener: TimerSelectorListener<T>
): () => void
function subscribeTimerStore<T>(
  listenerOrSelector: TimerStoreListener | ((state: TimerStore) => T),
  selectorListener?: TimerSelectorListener<T>
): () => void {
  let previousState = getCombinedState()
  let previousSelection = selectorListener
    ? (listenerOrSelector as (state: TimerStore) => T)(previousState)
    : undefined

  return subscribeCombined(() => {
    const nextState = getCombinedState()
    if (selectorListener) {
      const nextSelection = (listenerOrSelector as (state: TimerStore) => T)(nextState)
      if (!Object.is(previousSelection, nextSelection)) {
        const previous = previousSelection as T
        previousSelection = nextSelection
        selectorListener(nextSelection, previous)
      }
    } else {
      ;(listenerOrSelector as TimerStoreListener)(nextState, previousState)
    }
    previousState = nextState
  })
}

useTimerStore.subscribe = subscribeTimerStore

useTimerStore.persist = useTimerConfigStore.persist

useTimerConfigStore.persist.onFinishHydration((state) => {
  const runtime = useTimerRuntimeStore.getState()
  if (runtime.status === 'stopped') {
    useTimerRuntimeStore.setState({
      remainingSeconds: state.totalDuration,
      progress: computeProgress(state.totalDuration, state.totalDuration),
      formattedTime: formatTime(state.totalDuration)
    })
  }
})

export interface DisplayValues {
  mainDisplay: string
  subDisplay: string | null
  overtimeDisplay: string | null
}

export function getDisplayValues(
  state: Pick<
    TimerStore,
    | 'phase'
    | 'remainingSeconds'
    | 'reminderDuration'
    | 'overtimeSeconds'
    | 'totalDuration'
    | 'reminderEnabled'
  >
): DisplayValues {
  const {
    phase,
    remainingSeconds,
    reminderDuration,
    overtimeSeconds,
    totalDuration,
    reminderEnabled
  } = state

  if (phase === 'idle') {
    if (reminderEnabled) {
      const mainSeconds = totalDuration - reminderDuration
      return {
        mainDisplay: formatTime(Math.max(0, mainSeconds)),
        subDisplay: formatTime(reminderDuration),
        overtimeDisplay: null
      }
    }
    return {
      mainDisplay: formatTime(totalDuration),
      subDisplay: null,
      overtimeDisplay: null
    }
  }

  if (phase === 'overtime') {
    return {
      mainDisplay: '00:00',
      subDisplay: null,
      overtimeDisplay: formatTime(overtimeSeconds)
    }
  }

  if (phase === 'warning') {
    return {
      mainDisplay: formatTime(remainingSeconds),
      subDisplay: null,
      overtimeDisplay: null
    }
  }

  if (reminderEnabled) {
    return {
      mainDisplay: formatTime(remainingSeconds - reminderDuration),
      subDisplay: formatTime(reminderDuration),
      overtimeDisplay: null
    }
  }

  return {
    mainDisplay: formatTime(remainingSeconds),
    subDisplay: null,
    overtimeDisplay: null
  }
}

export type { TimerMode, TimerStatus, TimerPhase }
