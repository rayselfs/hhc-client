import { useEffect } from 'react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { isElectron } from '@renderer/lib/env'
import {
  createLanRemoteSnapshot,
  executeLanRemoteCommand
} from '@renderer/lib/lan-remote-command-gateway'

const SNAPSHOT_INTERVAL_MS = 1000

export default function LanRemoteBridge(): null {
  const { isProjectionOpen, isProjectionBlanked, blankProjection } = useProjection()

  useEffect(() => {
    if (!isElectron() || !window.api?.lanRemote) return
    return window.api.lanRemote.onCommand((command) => {
      void executeLanRemoteCommand(command).then((ack) => window.api.lanRemote.publishAck(ack))
    })
  }, [])

  useEffect(() => {
    const handleBlank = (event: Event): void => {
      const enabled = event instanceof CustomEvent ? Boolean(event.detail) : false
      blankProjection(enabled)
    }
    window.addEventListener('librepresenter:lan-remote-blank', handleBlank)
    return () => window.removeEventListener('librepresenter:lan-remote-blank', handleBlank)
  }, [blankProjection])

  useEffect(() => {
    if (!isElectron() || !window.api?.lanRemote) return
    const intervalId = window.setInterval(() => {
      void window.api.lanRemote.publishState(
        createLanRemoteSnapshot(isProjectionOpen, isProjectionBlanked)
      )
    }, SNAPSHOT_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [isProjectionOpen, isProjectionBlanked])

  return null
}
