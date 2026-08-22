export type LibrePresenterProtocolAction =
  | { kind: 'account-auth'; code: string; state: string }
  | { kind: 'onedrive-auth'; url: string }
  | { kind: 'ignore' }

type ProtocolHandlers = {
  onAccountAuth: (action: Extract<LibrePresenterProtocolAction, { kind: 'account-auth' }>) => void
  onOneDriveAuth: (url: string) => void
}

export function parseLibrePresenterProtocolUrl(value: string): LibrePresenterProtocolAction {
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'librepresenter:' ||
      url.hostname !== 'auth' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash
    ) {
      return { kind: 'ignore' }
    }

    if (url.pathname === '/onedrive') return { kind: 'onedrive-auth', url: value }
    if (url.pathname !== '/account') return { kind: 'ignore' }

    const keys = [...url.searchParams.keys()]
    const codes = url.searchParams.getAll('code')
    const states = url.searchParams.getAll('state')
    if (
      keys.some((key) => key !== 'code' && key !== 'state') ||
      codes.length !== 1 ||
      states.length !== 1 ||
      !codes[0].trim() ||
      !states[0].trim()
    ) {
      return { kind: 'ignore' }
    }

    return { kind: 'account-auth', code: codes[0], state: states[0] }
  } catch {
    return { kind: 'ignore' }
  }
}

export function createLibrePresenterProtocolDispatcher(handlers: ProtocolHandlers): {
  dispatch(value: string): boolean
  dispatchArgv(argv: string[]): boolean
} {
  const dispatch = (value: string): boolean => {
    const action = parseLibrePresenterProtocolUrl(value)
    if (action.kind === 'account-auth') handlers.onAccountAuth(action)
    else if (action.kind === 'onedrive-auth') handlers.onOneDriveAuth(action.url)
    else return false
    return true
  }

  return {
    dispatch,
    dispatchArgv: (argv) => argv.some(dispatch)
  }
}
