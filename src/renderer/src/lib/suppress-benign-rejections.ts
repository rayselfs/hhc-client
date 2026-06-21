function getErrorName(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.name
  }

  if (typeof reason === 'object' && reason !== null && 'name' in reason) {
    return String(reason.name)
  }

  return ''
}

function getErrorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message
  }

  if (typeof reason === 'object' && reason !== null && 'message' in reason) {
    return String(reason.message)
  }

  return String(reason)
}

export function isBenignTransitionAbort(reason: unknown): boolean {
  return (
    getErrorName(reason) === 'AbortError' && getErrorMessage(reason) === 'Transition was skipped'
  )
}

export function suppressBenignTransitionAbortErrors(target: Window = window): () => void {
  const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    // ponytail: React Aria toast can reject canceled transition promises in normal UI flow.
    if (isBenignTransitionAbort(event.reason)) {
      event.preventDefault()
    }
  }

  target.addEventListener('unhandledrejection', handleUnhandledRejection)

  return () => {
    target.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }
}
