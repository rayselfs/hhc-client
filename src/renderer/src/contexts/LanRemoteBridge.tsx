import { useEffect } from 'react'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { isElectron } from '@renderer/lib/env'
import {
  createLanRemoteSnapshot,
  executeLanRemoteCommand
} from '@renderer/lib/lan-remote-command-gateway'

const SNAPSHOT_INTERVAL_MS = 1000

export default function LanRemoteBridge(): null {
  const { isProjectionOpen } = useProjection()

  useEffect(() => {
    if (!isElectron() || !window.api?.lanRemote) return
    return window.api.lanRemote.onCommand((command) => {
      void executeLanRemoteCommand(command).then((ack) => window.api.lanRemote.publishAck(ack))
    })
  }, [])

  useEffect(() => {
    if (!isElectron() || !window.api?.lanRemote) return
    const intervalId = window.setInterval(() => {
      void window.api.lanRemote.publishState(createLanRemoteSnapshot(isProjectionOpen))
    }, SNAPSHOT_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
  }, [isProjectionOpen])

  return null
}
