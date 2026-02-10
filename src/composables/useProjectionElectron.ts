import type { AppMessage } from '@/types/common'

export const useProjectionElectron = () => {
  const isElectron = (): boolean => {
    return typeof window !== 'undefined' && !!window.electronAPI
  }

  const onProjectionMessage = (callback: (data: AppMessage) => void): void => {
    if (isElectron()) {
      window.electronAPI.onProjectionMessage(callback)
    }
  }

  const onGetCurrentState = (callback: () => void): void => {
    if (isElectron()) {
      window.electronAPI.onGetCurrentState(callback)
    }
  }

  const removeAllListeners = (channel: string): void => {
    if (isElectron()) {
      window.electronAPI.removeAllListeners(channel)
    }
  }

  const handleMessage = (callback: (data: AppMessage) => void): (() => void) | void => {
    if (isElectron()) {
      onProjectionMessage(callback)
    } else {
      const messageHandler = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return
        }
        callback(event.data)
      }
      window.addEventListener('message', messageHandler)

      return () => {
        window.removeEventListener('message', messageHandler)
      }
    }
  }

  const requestCurrentState = (): void => {
    if (isElectron()) {
      onGetCurrentState(() => {
        // Main window will automatically send current state
      })
    } else if (window.opener) {
      window.opener.postMessage({ type: 'REQUEST_STATE' }, window.location.origin)
    }
  }

  return {
    isElectron,
    handleMessage,
    requestCurrentState,
    removeAllListeners,
  }
}
