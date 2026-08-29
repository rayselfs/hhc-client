import { describe, expect, it, vi } from 'vitest'
import {
  createHhcPresenterProtocolDispatcher,
  parseHhcPresenterProtocolUrl
} from '../protocol-router'

describe('parseHhcPresenterProtocolUrl', () => {
  it('accepts only the exact account callback shape', () => {
    expect(
      parseHhcPresenterProtocolUrl(
        'hhc-presenter://auth/account?code=authorization-code&state=expected-state'
      )
    ).toEqual({
      kind: 'account-auth',
      code: 'authorization-code',
      state: 'expected-state'
    })
  })

  it.each([
    `${['libre', 'presenter'].join('')}://auth/account?code=code&state=state`,
    'hhc-presenter://auth/account?code=&state=state',
    'hhc-presenter://auth/account?code=%20&state=state',
    'hhc-presenter://auth/account?code=code&state=',
    'hhc-presenter://auth/account?code=code&state=%20',
    'hhc-presenter://auth/account?code=first&code=second&state=state',
    'hhc-presenter://auth/account?code=code&state=first&state=second',
    'hhc-presenter://auth/account?code=code&state=state&extra=value',
    'hhc-presenter://user@auth/account?code=code&state=state',
    'hhc-presenter://auth/account?code=code&state=state#fragment',
    'hhc-presenter://auth:123/account?code=code&state=state',
    'hhc-presenter://other/account?code=code&state=state',
    'hhc-presenter://auth/account/?code=code&state=state',
    'hhc-presenter://auth/unknown?code=code&state=state',
    'https://auth/account?code=code&state=state',
    'not a url'
  ])('rejects malformed or non-exact input: %s', (value) => {
    expect(parseHhcPresenterProtocolUrl(value)).toEqual({ kind: 'ignore' })
  })

  it('preserves the complete OneDrive callback URL and provider parameters', () => {
    const url =
      'hhc-presenter://auth/onedrive?code=code&state=state&session_state=session&scope=Files.Read'

    expect(parseHhcPresenterProtocolUrl(url)).toEqual({ kind: 'onedrive-auth', url })
  })
})

describe('createHhcPresenterProtocolDispatcher', () => {
  it('uses one dispatcher for open-url, second-instance argv, and initial argv', () => {
    const onAccountAuth = vi.fn()
    const onOneDriveAuth = vi.fn()
    const dispatcher = createHhcPresenterProtocolDispatcher({ onAccountAuth, onOneDriveAuth })

    expect(
      dispatcher.dispatch('hhc-presenter://auth/account?code=direct-code&state=direct-state')
    ).toBe(true)
    expect(
      dispatcher.dispatchArgv([
        '--flag',
        'hhc-presenter://auth/account?code=argv-code&state=argv-state'
      ])
    ).toBe(true)
    expect(
      dispatcher.dispatchArgv([
        'app',
        'hhc-presenter://auth/onedrive?error=access_denied&state=onedrive-state'
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
      'hhc-presenter://auth/onedrive?error=access_denied&state=onedrive-state'
    )
  })

  it('does not dispatch or log ignored input', () => {
    const onAccountAuth = vi.fn()
    const onOneDriveAuth = vi.fn()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const dispatcher = createHhcPresenterProtocolDispatcher({ onAccountAuth, onOneDriveAuth })

    expect(dispatcher.dispatch('hhc-presenter://auth/unknown?code=secret')).toBe(false)
    expect(dispatcher.dispatchArgv(['--flag', 'invalid secret callback'])).toBe(false)
    expect(onAccountAuth).not.toHaveBeenCalled()
    expect(onOneDriveAuth).not.toHaveBeenCalled()
    expect(consoleError).not.toHaveBeenCalled()
    expect(consoleLog).not.toHaveBeenCalled()

    consoleError.mockRestore()
    consoleLog.mockRestore()
  })
})
