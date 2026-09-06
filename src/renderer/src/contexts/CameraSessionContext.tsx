import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useProjection } from './ProjectionContext'
import { createCameraSession } from '@renderer/lib/camera-session'
import { createCameraPeer } from '@renderer/lib/camera-peer'
import { createCameraCover } from '@renderer/lib/camera-transform'
import { useCameraStore } from '@renderer/stores/camera'
import type { CameraState } from '@shared/camera'

interface CameraContextValue {
  stream: MediaStream | null
  selectSource(deviceId: string): Promise<void>
  enable(): Promise<void>
  start(): Promise<void>
  stop(): Promise<void>
  reset(): void
  retry(): void
}
const Context = createContext<CameraContextValue | null>(null)

export function CameraSessionProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const { pathname } = useLocation()
  const {
    activeOwner,
    isProjectionOpen,
    recovery,
    projectionReadyCount,
    startProjection,
    stopProjection,
    on,
    send
  } = useProjection()
  const session = useRef<ReturnType<typeof createCameraSession> | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [retry, setRetry] = useState(0)
  const projecting = activeOwner === 'camera' && isProjectionOpen

  useEffect(() => {
    session.current = createCameraSession()
    return () => {
      session.current?.dispose()
      session.current = null
    }
  }, [])

  const listDevices = useCallback(async (): Promise<void> => {
    const devices = await navigator.mediaDevices?.enumerateDevices()
    useCameraStore.setState({
      devices:
        devices
          ?.filter((d) => d.kind === 'videoinput')
          .map((d, index) => ({ id: d.deviceId, label: d.label || `Camera ${index + 1}` })) ?? []
    })
  }, [])
  useEffect(() => {
    const changed = (): void => {
      void listDevices().catch(() => undefined)
    }
    navigator.mediaDevices?.addEventListener('devicechange', changed)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', changed)
  }, [listDevices])

  const selectSource = useCallback(
    async (deviceId: string): Promise<void> => {
      const current = session.current
      if (!current || !navigator.mediaDevices) {
        useCameraStore.setState({ error: 'unavailable' })
        return
      }
      useCameraStore.setState({ busy: true, error: null })
      setStream(null)
      try {
        const next = await current.selectSource(deviceId)
        if (session.current !== current) return
        const track = next.getVideoTracks()[0]
        const settings = track.getSettings()
        const cover = createCameraCover(settings.width ?? 1920, settings.height ?? 1080)
        useCameraStore.setState({
          cover,
          transform: cover,
          deviceId: settings.deviceId ?? deviceId,
          lastDeviceId: settings.deviceId ?? deviceId,
          busy: false
        })
        track.addEventListener(
          'ended',
          () => {
            if (session.current !== current || current.getStream() !== next) return
            setStream(null)
            useCameraStore.setState({ error: 'ended', connection: 'unavailable' })
          },
          { once: true }
        )
        setStream(next)
        await listDevices()
      } catch (error) {
        if (
          session.current !== current ||
          (error instanceof DOMException && error.name === 'AbortError')
        )
          return
        useCameraStore.setState({
          busy: false,
          error: error instanceof Error ? error.name : 'unavailable'
        })
      }
    },
    [listDevices]
  )

  useEffect(() => {
    if (pathname === '/camera' || projecting) return
    session.current?.dispose()
    session.current = createCameraSession()
    setStream(null)
    useCameraStore.setState({ busy: false, deviceId: '', connection: 'idle' })
  }, [pathname, projecting])

  useEffect(() => {
    if (pathname !== '/camera' || session.current?.getStream()) return
    let cancelled = false
    const restore = async (): Promise<void> => {
      await listDevices()
      if (cancelled) return
      const { lastDeviceId, devices } = useCameraStore.getState()
      if (!lastDeviceId) return
      if (devices.some((device) => device.id === lastDeviceId)) {
        await selectSource(lastDeviceId)
      } else {
        useCameraStore.setState({ error: 'NotFoundError' })
      }
    }
    void restore().catch(() => {
      if (!cancelled) useCameraStore.setState({ error: 'unavailable' })
    })
    return () => {
      cancelled = true
    }
  }, [pathname, listDevices, selectSource])

  useEffect(() => {
    if (!projecting || recovery.status !== 'ready' || !stream) {
      useCameraStore.setState({ connection: projecting ? 'unavailable' : 'idle' })
      return
    }
    let disposed = false
    let peer: ReturnType<typeof createCameraPeer> | null = null
    let sessionId = ''
    let retries = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let watchdog: ReturnType<typeof setTimeout> | undefined
    let frame: number | undefined
    const publish = (status: CameraState['status']): void => {
      send('camera:state', { sessionId, transform: useCameraStore.getState().transform, status })
    }
    const fail = (): void => {
      if (disposed || timer) return
      if (watchdog) clearTimeout(watchdog)
      useCameraStore.setState({ connection: 'unavailable' })
      publish('unavailable')
      if (retries++ >= 3) {
        useCameraStore.setState({ error: 'connection' })
        return
      }
      timer = setTimeout(() => {
        timer = undefined
        connect()
      }, 1000)
    }
    const connect = (): void => {
      if (disposed) return
      peer?.dispose()
      sessionId = crypto.randomUUID()
      useCameraStore.setState({ connection: 'connecting', error: null })
      peer = createCameraPeer({
        role: 'main',
        sessionId,
        sendSignal: (signal) => send('camera:signal', signal),
        onStream: () => undefined,
        onStateChange: (state) => {
          if (disposed) return
          if (state === 'connected') {
            if (watchdog) clearTimeout(watchdog)
            if (timer) {
              clearTimeout(timer)
              timer = undefined
            }
            useCameraStore.setState({ connection: 'live' })
            publish('live')
          }
          if (state === 'failed' || state === 'disconnected') fail()
        }
      })
      publish('connecting')
      watchdog = setTimeout(fail, 8000)
    }
    const unready = on('camera:ready', (message) => {
      if (message.sessionId === sessionId) void peer?.start(stream).catch(fail)
    })
    const unsignal = on('camera:signal', (message) => {
      void peer?.acceptSignal(message).catch(fail)
    })
    const unstore = useCameraStore.subscribe((next, previous) => {
      if (next.transform === previous.transform || frame !== undefined) return
      frame = requestAnimationFrame(() => {
        frame = undefined
        const status = useCameraStore.getState().connection
        publish(
          status === 'live' ? 'live' : status === 'unavailable' ? 'unavailable' : 'connecting'
        )
      })
    })
    connect()
    return () => {
      disposed = true
      if (timer) clearTimeout(timer)
      if (watchdog) clearTimeout(watchdog)
      if (frame !== undefined) cancelAnimationFrame(frame)
      publish('unavailable')
      peer?.dispose()
      unready()
      unsignal()
      unstore()
    }
  }, [
    projecting,
    recovery.status,
    recovery.generation,
    projectionReadyCount,
    stream,
    retry,
    on,
    send
  ])

  const start = async (): Promise<void> => {
    if (!stream) return
    const result = await startProjection('camera', [
      [
        'camera:state',
        {
          sessionId: crypto.randomUUID(),
          transform: useCameraStore.getState().transform,
          status: 'connecting'
        }
      ]
    ])
    if (!result.ok) useCameraStore.setState({ error: 'connection' })
  }
  return (
    <Context.Provider
      value={{
        stream,
        selectSource,
        enable: () => selectSource(''),
        start,
        stop: stopProjection,
        reset: () => useCameraStore.getState().updateTransform(useCameraStore.getState().cover),
        retry: () => setRetry((value) => value + 1)
      }}
    >
      {children}
    </Context.Provider>
  )
}
// eslint-disable-next-line react-refresh/only-export-components
export function useCameraSession(): CameraContextValue {
  const context = useContext(Context)
  if (!context) throw new Error('CameraSessionProvider is required')
  return context
}
