import { describe, expect, it, vi } from 'vitest'
import {
  createLibrePresenterProtocolDispatcher,
  parseLibrePresenterProtocolUrl
} from '../protocol-router'

describe('parseLibrePresenterProtocolUrl', () => {
  it('accepts only the exact account callback shape', () => {
    expect(
      parseLibrePresenterProtocolUrl(
        'librepresenter://auth/account?code=authorization-code&state=expected-state'
      )
    ).toEqual({
      kind: 'account-auth',
      code: 'authorization-code',
      state: 'expected-state'
    })
  })

  it.each([
    'librepresenter://auth/account?code=&state=state',
    'librepresenter://auth/account?code=%20&state=state',
    'librepresenter://auth/account?code=code&state=',
    'librepresenter://auth/account?code=code&state=%20',
    'librepresenter://auth/account?code=first&code=second&state=state',
    'librepresenter://auth/account?code=code&state=first&state=second',
    'librepresenter://auth/account?code=code&state=state&extra=value',
    'librepresenter://user@auth/account?code=code&state=state',
    'librepresenter://auth/account?code=code&state=state#fragment',
    'librepresenter://auth:123/account?code=code&state=state',
    'librepresenter://other/account?code=code&state=state',
    'librepresenter://auth/account/?code=code&state=state',
    'librepresenter://auth/unknown?code=code&state=state',
    'https://auth/account?code=code&state=state',
    'not a url'
  ])('rejects malformed or non-exact input: %s', (value) => {
    expect(parseLibrePresenterProtocolUrl(value)).toEqual({ kind: 'ignore' })
  })

  it('preserves the complete OneDrive callback URL and provider parameters', () => {
    const url =
      'librepresenter://auth/onedrive?code=code&state=state&session_state=session&scope=Files.Read'

    expect(parseLibrePresenterProtocolUrl(url)).toEqual({ kind: 'onedrive-auth', url })
  })
})

describe('createLibrePresenterProtocolDispatcher', () => {
  it('uses one dispatcher for open-url, second-instance argv, and initial argv', () => {
    const onAccountAuth = vi.fn()
    const onOneDriveAuth = vi.fn()
    const dispatcher = createLibrePresenterProtocolDispatcher({ onAccountAuth, onOneDriveAuth })

    expect(
      dispatcher.dispatch('librepresenter://auth/account?code=direct-code&state=direct-state')
    ).toBe(true)
    expect(
      dispatcher.dispatchArgv([
        '--flag',
        'librepresenter://auth/account?code=argv-code&state=argv-state'
      ])
    ).toBe(true)
    expect(
      dispatcher.dispatchArgv([
        'app',
        'librepresenter://auth/onedrive?error=access_denied&state=onedrive-state'
      ])
    ).toBe(true)

    expect(onAccountAuth).toHaveBeenNthCalledWith(1, {
      kind: 'account-auth',
      code: 'direct-code',
      state: 'direct-state'
    })
    expect(onAccountAuth).toHaveBeenNthCalledWith(2, {
      kind: 'account-auth',
      code: 'argv-code',
      state: 'argv-state'
    })
    expect(onOneDriveAuth).toHaveBeenCalledWith(
      'librepresenter://auth/onedrive?error=access_denied&state=onedrive-state'
    )
  })

  it('does not dispatch or log ignored input', () => {
    const onAccountAuth = vi.fn()
    const onOneDriveAuth = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const dispatcher = createLibrePresenterProtocolDispatcher({ onAccountAuth, onOneDriveAuth })

    expect(dispatcher.dispatch('librepresenter://auth/unknown?code=secret')).toBe(false)
    expect(dispatcher.dispatchArgv(['--flag', 'invalid secret callback'])).toBe(false)
    expect(onAccountAuth).not.toHaveBeenCalled()
    expect(onOneDriveAuth).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    expect(consoleLog).not.toHaveBeenCalled()

    consoleError.mockRestore()
    consoleLog.mockRestore()
  })
})
