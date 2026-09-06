import { isCameraSignalFrom, type CameraSignal } from '@shared/camera'

interface CameraPeerOptions {
  role: 'main' | 'projection'
  sessionId: string
  sendSignal(signal: CameraSignal): void
  onStream(stream: MediaStream): void
  onStateChange?(state: RTCPeerConnectionState): void
  createPeer?: () => RTCPeerConnection
}

export function createCameraPeer(options: CameraPeerOptions): {
  start(stream?: MediaStream): Promise<void>
  acceptSignal(signal: unknown): Promise<void>
  dispose(): void
} {
  const pc = options.createPeer?.() ?? new RTCPeerConnection({ iceServers: [] })
  const candidates: RTCIceCandidateInit[] = []
  let disposed = false
  let started = false
  let negotiating = false
  let pending: Promise<void> = Promise.resolve()

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const result = pending.then(async () => {
      if (!disposed) await operation()
    })
    pending = result.catch(() => undefined)
    return result
  }

  async function sendDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (disposed) return
    await pc.setLocalDescription(description)
    if (disposed) return
    const local = pc.localDescription
    if (local?.sdp && (local.type === 'offer' || local.type === 'answer')) {
      options.sendSignal({ sessionId: options.sessionId, kind: local.type, sdp: local.sdp })
    }
  }

  pc.onicecandidate = ({ candidate }) => {
    if (!disposed && candidate)
      options.sendSignal({
        sessionId: options.sessionId,
        kind: 'ice',
        candidate: { ...candidate.toJSON(), candidate: candidate.candidate }
      })
  }
  pc.ontrack = ({ streams, track }) => {
    if (!disposed && track.kind === 'video')
      options.onStream(streams[0] ?? new MediaStream([track]))
  }
  pc.onconnectionstatechange = () => {
    if (!disposed) options.onStateChange?.(pc.connectionState)
  }

  return {
    start(stream?: MediaStream): Promise<void> {
      return enqueue(async () => {
        if (started || options.role !== 'main') return
        const track = stream?.getVideoTracks()[0]
        if (!stream || !track || track.readyState !== 'live')
          throw new Error('Live camera video is required')
        started = true
        const sender = pc.addTrack(track, stream)
        await sender.setParameters({
          ...sender.getParameters(),
          degradationPreference: 'maintain-resolution'
        })
        if (disposed) return
        await sendDescription(await pc.createOffer())
      })
    },
    acceptSignal(signal: unknown): Promise<void> {
      const sender = options.role === 'main' ? 'projection' : 'main'
      if (!isCameraSignalFrom(signal, sender)) return Promise.resolve()
      const message = signal as CameraSignal
      if (message.sessionId !== options.sessionId) return Promise.resolve()
      return enqueue(async () => {
        if (message.kind === 'ice') {
          if (pc.remoteDescription) await pc.addIceCandidate(message.candidate)
          else if (candidates.length < 256) candidates.push(message.candidate)
          else throw new Error('Too many camera ICE candidates')
          return
        }
        if (negotiating || (options.role === 'main' && !started)) return
        negotiating = true
        await pc.setRemoteDescription({ type: message.kind, sdp: message.sdp })
        while (!disposed && candidates.length) await pc.addIceCandidate(candidates.shift())
        if (!disposed && message.kind === 'offer') await sendDescription(await pc.createAnswer())
      })
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      candidates.length = 0
      pc.onicecandidate = null
      pc.ontrack = null
      pc.onconnectionstatechange = null
      pc.close()
    }
  }
}
