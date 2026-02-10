import type { TimerCommand, TimerState } from '@/types/electron'
import { useSentry } from './useSentry'

export const useTimerIPC = () => {
  const { reportError } = useSentry()

  const isElectron = (): boolean => {
    return typeof window !== 'undefined' && !!window.electronAPI
  }

  const timerCommand = (command: TimerCommand): void => {
    if (isElectron()) {
      try {
        window.electronAPI.timerCommand(command)
      } catch (error) {
        reportError(error, {
          operation: 'timer-command',
          component: 'useTimerIPC',
        })
      }
    }
  }

  const onTimerTick = (callback: (state: Partial<TimerState>) => void): void => {
    if (isElectron()) {
      window.electronAPI.onTimerTick(callback)
    }
  }

  const timerInitialize = async (settings: Partial<TimerState>): Promise<void> => {
    if (isElectron()) {
      try {
        await window.electronAPI.timerInitialize(settings)
      } catch (error) {
        reportError(error, {
          operation: 'timer-initialize',
          component: 'useTimerIPC',
        })
      }
    }
  }

  const timerGetState = async (): Promise<TimerState | null> => {
    if (isElectron()) {
      try {
        return await window.electronAPI.timerGetState()
      } catch (error) {
        reportError(error, {
          operation: 'timer-get-state',
          component: 'useTimerIPC',
        })
        return null
      }
    }
    return null
  }

  return {
    timerCommand,
    onTimerTick,
    timerInitialize,
    timerGetState,
  }
}
