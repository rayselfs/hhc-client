import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { HhcAuthAdapter, HhcSession } from '@shared/hhc-auth'
import { createHhcAuthAdapter } from '@renderer/lib/hhc-auth'

export type HhcAuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'unavailable'

type HhcAuthContextValue = {
  status: HhcAuthStatus
  session: HhcSession | null
  signIn(): Promise<void>
  signOut(): Promise<void>
  getAccessToken(): Promise<string | null>
  refreshAccessToken(): Promise<string | null>
}

const HhcAuthContext = createContext<HhcAuthContextValue | null>(null)

export function HhcAuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<HhcAuthStatus>('loading')
  const [session, setSession] = useState<HhcSession | null>(null)
  const adapterRef = useRef<HhcAuthAdapter | null>(null)
  const sessionRef = useRef<HhcSession | null>(null)
  const sessionRevisionRef = useRef(0)
  const accessTokenPromiseRef = useRef<Promise<string | null> | null>(null)
  const refreshTokenPromiseRef = useRef<Promise<string | null> | null>(null)

  useEffect(() => {
    let active = true
    let adapter: HhcAuthAdapter | null = null
    let unsubscribe: (() => void) | null = null

    void createHhcAuthAdapter()
      .then(async (createdAdapter) => {
        adapter = createdAdapter
        if (!active) {
          createdAdapter.dispose()
          return
        }

        adapterRef.current = createdAdapter
        const bootstrapRevision = sessionRevisionRef.current
        unsubscribe = createdAdapter.subscribe((nextSession) => {
          if (!active) return
          sessionRevisionRef.current += 1
          sessionRef.current = nextSession
          accessTokenPromiseRef.current = null
          refreshTokenPromiseRef.current = null
          setSession(nextSession)
          setStatus(nextSession ? 'authenticated' : 'anonymous')
        })

        try {
          const nextSession = await createdAdapter.getSession()
          if (!active || sessionRevisionRef.current !== bootstrapRevision) return
          sessionRef.current = nextSession
          setSession(nextSession)
          setStatus(nextSession ? 'authenticated' : 'anonymous')
        } catch {
          if (!active || sessionRevisionRef.current !== bootstrapRevision) return
          sessionRef.current = null
          setSession(null)
          setStatus('unavailable')
        }
      })
      .catch(() => {
        if (!active) return
        setSession(null)
        setStatus('unavailable')
      })

    return () => {
      active = false
      unsubscribe?.()
      if (adapterRef.current === adapter) adapterRef.current = null
      sessionRef.current = null
      sessionRevisionRef.current += 1
      accessTokenPromiseRef.current = null
      refreshTokenPromiseRef.current = null
      adapter?.dispose()
    }
  }, [])

  const signIn = useCallback(async (): Promise<void> => {
    const adapter = adapterRef.current
    if (!adapter) throw new Error('HHC account is unavailable')
    await adapter.signIn()
  }, [])

  const signOut = useCallback(async (): Promise<void> => {
    const adapter = adapterRef.current
    if (!adapter) throw new Error('HHC account is unavailable')
    await adapter.signOut()
  }, [])

  const getAccessToken = useCallback((): Promise<string | null> => {
    const adapter = adapterRef.current
    if (!adapter) return Promise.resolve(null)
    if (accessTokenPromiseRef.current) return accessTokenPromiseRef.current

    const revision = sessionRevisionRef.current
    const request = adapter
      .getAccessToken()
      .then((token) =>
        adapterRef.current === adapter && sessionRevisionRef.current === revision ? token : null
      )
      .catch((error: unknown) => {
        if (adapterRef.current === adapter && sessionRevisionRef.current === revision) {
          sessionRef.current = null
          setSession(null)
          setStatus('unavailable')
        }
        throw error
      })
    accessTokenPromiseRef.current = request
    request.then(
      () => {
        if (accessTokenPromiseRef.current === request) accessTokenPromiseRef.current = null
      },
      () => {
        if (accessTokenPromiseRef.current === request) accessTokenPromiseRef.current = null
      }
    )
    return request
  }, [])

  const refreshAccessToken = useCallback((): Promise<string | null> => {
    const adapter = adapterRef.current
    if (!adapter || !sessionRef.current) return Promise.resolve(null)
    if (refreshTokenPromiseRef.current) return refreshTokenPromiseRef.current

    const revision = sessionRevisionRef.current
    const request = adapter
      .refreshAccessToken()
      .then((token) =>
        adapterRef.current === adapter &&
        sessionRevisionRef.current === revision &&
        sessionRef.current
          ? token
          : null
      )
    refreshTokenPromiseRef.current = request
    request.then(
      () => {
        if (refreshTokenPromiseRef.current === request) refreshTokenPromiseRef.current = null
      },
      () => {
        if (refreshTokenPromiseRef.current === request) refreshTokenPromiseRef.current = null
      }
    )
    return request
  }, [])

  const value = useMemo(
    () => ({ status, session, signIn, signOut, getAccessToken, refreshAccessToken }),
    [getAccessToken, refreshAccessToken, session, signIn, signOut, status]
  )

  return <HhcAuthContext.Provider value={value}>{children}</HhcAuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHhcAuth(): HhcAuthContextValue {
  const context = useContext(HhcAuthContext)
  if (!context) throw new Error('useHhcAuth must be used within HhcAuthProvider')
  return context
}
