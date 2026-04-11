import { createContext, useContext, useRef, useState } from 'react'

export type ConfirmDialogStatus = 'warning' | 'danger' | 'info'

export interface ConfirmOptions {
  status?: ConfirmDialogStatus
  title?: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
}

interface PendingConfirm {
  options: ConfirmOptions
  resolve: (confirmed: boolean) => void
}

interface ConfirmDialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  pending: PendingConfirm | null
  settle: (confirmed: boolean) => void
}

const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null)

export function ConfirmDialogProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null)

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setPending({ options, resolve })
    })
  }

  const settle = (confirmed: boolean): void => {
    resolveRef.current?.(confirmed)
    resolveRef.current = null
    setPending(null)
  }

  return (
    <ConfirmDialogContext.Provider value={{ confirm, pending, settle }}>
      {children}
    </ConfirmDialogContext.Provider>
  )
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmDialogContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmDialogProvider')
  return ctx.confirm
}

export function useConfirmDialogState(): Pick<ConfirmDialogContextValue, 'pending' | 'settle'> {
  const ctx = useContext(ConfirmDialogContext)
  if (!ctx) throw new Error('useConfirmDialogState must be used within ConfirmDialogProvider')
  return { pending: ctx.pending, settle: ctx.settle }
}
