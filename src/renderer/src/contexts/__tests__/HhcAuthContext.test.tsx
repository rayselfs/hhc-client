import { act, render, renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HhcAuthAdapter, HhcSession } from '@shared/hhc-auth'
import { createBrowserHhcAssetApi } from '@renderer/lib/hhc-asset-api-browser'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { HhcAuthProvider, useHhcAuth } from '../HhcAuthContext'

const authFactory = vi.hoisted(() => ({
  adapters: [] as HhcAuthAdapter[],
  create: vi.fn(async (): Promise<HhcAuthAdapter> => {
    const adapter = authFactory.adapters.shift()
    if (!adapter) throw new Error('Missing test adapter')
    return adapter
  })
}))

vi.mock('@renderer/lib/hhc-auth', () => ({
  createHhcAuthAdapter: authFactory.create
}))

const SESSION: HhcSession = {
  userId: 'user-1',
  displayName: 'Ada Lovelace',
  roles: ['media_sync_user']
}

type TestAdapter = HhcAuthAdapter & {
  emit(session: HhcSession | null): void
  unsubscribe: ReturnType<typeof vi.fn>
}

function createAdapter(session: HhcSession | null | Error = null): TestAdapter {
  let listener: ((next: HhcSession | null) => void) | null = null
  const unsubscribe = vi.fn(() => {
    listener = null
  })
  return {
    getSession: vi.fn(async () => {
      if (session instanceof Error) throw session
      return session
    }),
    signIn: vi.fn(async () => undefined),
    getAccessToken: vi.fn(async () => 'access-token'),
    refreshAccessToken: vi.fn(async () => 'refreshed-access-token'),
    signOut: vi.fn(async () => undefined),
    subscribe: vi.fn((nextListener) => {
      listener = nextListener
      return unsubscribe
    }),
    dispose: vi.fn(),
    emit(next) {
      listener?.(next)
    },
    unsubscribe
  }
}

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <HhcAuthProvider>{children}</HhcAuthProvider>
}

beforeEach(() => {
  authFactory.adapters = []
  authFactory.create.mockClear()
})

describe('HhcAuthContext', () => {
  it.each([
    ['authenticated', SESSION, 'authenticated'],
    ['anonymous', null, 'anonymous']
  ] as const)('bootstraps an %s session', async (_name, session, status) => {
    authFactory.adapters.push(createAdapter(session))
    const { result } = renderHook(() => useHhcAuth(), { wrapper })

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe(status))
    expect(result.current.session).toEqual(session)
  })

  it('becomes unavailable without mutating local or OneDrive folders when bootstrap fails', async () => {
    const folders = {
      local: {
        id: 'local',
        name: 'Local',
        parentId: null,
        sortIndex: 0,
        createdAt: 1,
        expiresAt: null
      },
      onedrive: {
        id: 'onedrive',
        name: 'OneDrive',
        parentId: null,
        sortIndex: 1,
        createdAt: 1,
        expiresAt: null,
        syncLink: {
          providerConnectionId: 'connection-1',
          remoteFolderId: 'remote-1',
          providerType: 'onedrive' as const
        }
      }
    }
    useFileExplorerStore.setState({ folders })
    authFactory.adapters.push(createAdapter(new Error('Account unavailable')))
    const { result } = renderHook(() => useHhcAuth(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('unavailable'))
    expect(result.current.session).toBeNull()
    expect(useFileExplorerStore.getState().folders).toEqual(folders)
  })

  it('updates from subscriptions and forwards sign-in and sign-out', async () => {
    const adapter = createAdapter(null)
    authFactory.adapters.push(adapter)
    const { result } = renderHook(() => useHhcAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    await act(() => result.current.signIn())
    expect(adapter.signIn).toHaveBeenCalledOnce()

    act(() => adapter.emit(SESSION))
    expect(result.current.status).toBe('authenticated')
    expect(result.current.session).toEqual(SESSION)

    await act(() => result.current.signOut())
    expect(adapter.signOut).toHaveBeenCalledOnce()
    act(() => adapter.emit(null))
    expect(result.current.status).toBe('anonymous')
  })

  it('keeps a newer subscription session when bootstrap finishes late', async () => {
    const adapter = createAdapter(null)
    let resolveSession: (session: HhcSession | null) => void = () => undefined
    vi.mocked(adapter.getSession).mockReturnValue(
      new Promise<HhcSession | null>((resolve) => {
        resolveSession = resolve
      })
    )
    authFactory.adapters.push(adapter)
    const { result } = renderHook(() => useHhcAuth(), { wrapper })
    await waitFor(() => expect(adapter.subscribe).toHaveBeenCalledOnce())

    act(() => adapter.emit(SESSION))
    expect(result.current.status).toBe('authenticated')

    await act(async () => resolveSession(null))
    expect(result.current.status).toBe('authenticated')
    expect(result.current.session).toEqual(SESSION)
  })

  it('coalesces concurrent access-token requests', async () => {
    const adapter = createAdapter(SESSION)
    let resolveToken: (token: string) => void = () => undefined
    vi.mocked(adapter.getAccessToken).mockReturnValue(
      new Promise<string>((resolve) => {
        resolveToken = resolve
      })
    )
    authFactory.adapters.push(adapter)
    const { result } = renderHook(() => useHhcAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    const first = result.current.getAccessToken()
    const second = result.current.getAccessToken()
    expect(first).toBe(second)
    expect(adapter.getAccessToken).toHaveBeenCalledOnce()

    resolveToken('shared-token')
    await expect(Promise.all([first, second])).resolves.toEqual(['shared-token', 'shared-token'])
  })

  it('discards an access token completed after the session changes', async () => {
    const adapter = createAdapter(SESSION)
    let resolveToken: (token: string) => void = () => undefined
    vi.mocked(adapter.getAccessToken).mockReturnValue(
      new Promise<string>((resolve) => {
        resolveToken = resolve
      })
    )
    authFactory.adapters.push(adapter)
    const { result } = renderHook(() => useHhcAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    const token = result.current.getAccessToken()
    act(() => adapter.emit({ ...SESSION, userId: 'user-2' }))
    resolveToken('stale-token')

    await expect(token).resolves.toBeNull()
  })

  it('coalesces concurrent refreshes and discards tokens after logout or account switch', async () => {
    const adapter = createAdapter(SESSION)
    let resolveRefresh: (token: string) => void = () => undefined
    vi.mocked(adapter.refreshAccessToken).mockReturnValue(
      new Promise<string>((resolve) => {
        resolveRefresh = resolve
      })
    )
    authFactory.adapters.push(adapter)
    const { result } = renderHook(() => useHhcAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    const first = result.current.refreshAccessToken()
    const second = result.current.refreshAccessToken()
    expect(first).toBe(second)
    expect(adapter.refreshAccessToken).toHaveBeenCalledOnce()

    act(() => adapter.emit(null))
    resolveRefresh('stale-token')
    await expect(Promise.all([first, second])).resolves.toEqual([null, null])

    let resolveSwitchedRefresh: (token: string) => void = () => undefined
    vi.mocked(adapter.refreshAccessToken).mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveSwitchedRefresh = resolve
      })
    )
    act(() => adapter.emit(SESSION))
    const switched = result.current.refreshAccessToken()
    act(() => adapter.emit({ ...SESSION, userId: 'user-2' }))
    resolveSwitchedRefresh('other-stale-token')
    await expect(switched).resolves.toBeNull()
  })

  it('shares one context refresh across concurrent Asset 401 retries', async () => {
    const adapter = createAdapter(SESSION)
    let resolveRefresh: (token: string) => void = () => undefined
    vi.mocked(adapter.refreshAccessToken).mockReturnValue(
      new Promise<string>((resolve) => {
        resolveRefresh = resolve
      })
    )
    const fetcher = vi.fn<typeof fetch>(async (_url, init) => {
      const token = new Headers(init?.headers).get('authorization')
      return token === 'Bearer refreshed-access-token'
        ? new Response(JSON.stringify({ collections: [], hasMore: false }))
        : new Response('{}', { status: 401 })
    })
    authFactory.adapters.push(adapter)
    const { result } = renderHook(() => useHhcAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    const api = createBrowserHhcAssetApi({
      getAccessToken: result.current.getAccessToken,
      refreshAccessToken: result.current.refreshAccessToken,
      fetcher
    })

    const requests = [api.listCollections(), api.listCollections()]
    await waitFor(() => expect(adapter.refreshAccessToken).toHaveBeenCalledOnce())
    resolveRefresh('refreshed-access-token')

    await expect(Promise.all(requests)).resolves.toEqual([
      { collections: [], hasMore: false },
      { collections: [], hasMore: false }
    ])
    expect(adapter.refreshAccessToken).toHaveBeenCalledOnce()
  })

  it('unsubscribes every subscription and disposes every adapter under StrictMode', async () => {
    const first = createAdapter(null)
    const second = createAdapter(null)
    authFactory.adapters.push(first, second)
    const Probe = (): React.JSX.Element => <div>{useHhcAuth().status}</div>
    const { getByText, unmount } = render(
      <StrictMode>
        <HhcAuthProvider>
          <Probe />
        </HhcAuthProvider>
      </StrictMode>
    )
    await waitFor(() => expect(getByText('anonymous')).toBeInTheDocument())

    unmount()

    expect(authFactory.create).toHaveBeenCalledTimes(2)
    expect(first.dispose).toHaveBeenCalledOnce()
    expect(second.dispose).toHaveBeenCalledOnce()
    expect(first.unsubscribe).toHaveBeenCalledTimes(vi.mocked(first.subscribe).mock.calls.length)
    expect(second.unsubscribe).toHaveBeenCalledTimes(vi.mocked(second.subscribe).mock.calls.length)
  })
})
