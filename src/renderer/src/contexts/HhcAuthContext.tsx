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
}

const HhcAuthContext = createContext<HhcAuthContextValue | null>(null)

export function HhcAuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<HhcAuthStatus>('loading')
  const [session, setSession] = useState<HhcSession | null>(null)
  const adapterRef = useRef<HhcAuthAdapter | null>(null)
  const accessTokenPromiseRef = useRef<Promise<string | null> | null>(null)

  useEffect(() => {
    let active = true
    let adapter: HhcAuthAdapter | null = null
    let unsubscribe: (() => void) | null = null
    let sessionRevision = 0

    void createHhcAuthAdapter()
      .then(async (createdAdapter) => {
        adapter = createdAdapter
        if (!active) {
          createdAdapter.dispose()
          return
        }

        adapterRef.current = createdAdapter
        const bootstrapRevision = sessionRevision
        unsubscribe = createdAdapter.subscribe((nextSession) => {
          if (!active) return
          sessionRevision += 1
          setSession(nextSession)
          setStatus(nextSession ? 'authenticated' : 'anonymous')
        })

        try {
          const nextSession = await createdAdapter.getSession()
          if (!active || sessionRevision !== bootstrapRevision) return
          setSession(nextSession)
          setStatus(nextSession ? 'authenticated' : 'anonymous')
        } catch {
          if (!active || sessionRevision !== bootstrapRevision) return
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
      accessTokenPromiseRef.current = null
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

    const request = adapter.getAccessToken().catch((error: unknown) => {
      setSession(null)
      setStatus('unavailable')
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

  const value = useMemo(
    () => ({ status, session, signIn, signOut, getAccessToken }),
    [getAccessToken, session, signIn, signOut, status]
  )

  return <HhcAuthContext.Provider value={value}>{children}</HhcAuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHhcAuth(): HhcAuthContextValue {
  const context = useContext(HhcAuthContext)
  if (!context) throw new Error('useHhcAuth must be used within HhcAuthProvider')
  return context
}
