import { createContext, useContext } from 'react'
import type { FileControlPayload } from '@shared/projection-messages'

interface PresenterCommandContextValue {
  sendCommand: (command: FileControlPayload) => void
}

export const PresenterCommandContext = createContext<PresenterCommandContextValue | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function usePresenterCommands(): PresenterCommandContextValue {
  const ctx = useContext(PresenterCommandContext)
  if (!ctx) {
    throw new Error('usePresenterCommands must be used within a PresenterCommandContext.Provider')
  }
  return ctx
}
