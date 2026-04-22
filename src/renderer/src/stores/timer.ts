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

export function useTimerStore(): TimerStore
export function useTimerStore<T>(selector: (s: TimerStore) => T): T
export function useTimerStore<T>(selector?: (s: TimerStore) => T): TimerStore | T {
  const config = useTimerConfigStore()
  const runtime = useTimerRuntimeStore()
  const combined = { ...config, ...runtime } as TimerStore
  if (selector) return selector(combined)
  return combined
}

useTimerStore.getState = (): TimerStore =>
  ({ ...useTimerConfigStore.getState(), ...useTimerRuntimeStore.getState() }) as TimerStore

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

useTimerStore.subscribe = (
  listener: (state: TimerStore, prevState: TimerStore) => void
): (() => void) => {
  let latestConfig = useTimerConfigStore.getState()
  let latestRuntime = useTimerRuntimeStore.getState()

  const unsubConfig = useTimerConfigStore.subscribe((config) => {
    const prev = { ...latestConfig, ...latestRuntime } as TimerStore
    latestConfig = config
    listener({ ...latestConfig, ...latestRuntime } as TimerStore, prev)
  })

  const unsubRuntime = useTimerRuntimeStore.subscribe((runtime) => {
    const prev = { ...latestConfig, ...latestRuntime } as TimerStore
    latestRuntime = runtime
    listener({ ...latestConfig, ...latestRuntime } as TimerStore, prev)
  })

  return () => {
    unsubConfig()
    unsubRuntime()
  }
}

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
