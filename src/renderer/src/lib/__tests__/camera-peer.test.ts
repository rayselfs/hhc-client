import { createCameraPeer } from '../camera-peer'

const fakePeer = vi.fn(() => {
  const pc = {
    remoteDescription: null as RTCSessionDescriptionInit | null,
    localDescription: null as RTCSessionDescriptionInit | null,
    onicecandidate: null,
    ontrack: null,
    onconnectionstatechange: null,
    close: vi.fn(),
    addTrack: vi.fn(() => ({
      getParameters: () => ({ encodings: [] }),
      setParameters: vi.fn().mockResolvedValue(undefined)
    })),
    addIceCandidate: vi.fn().mockResolvedValue(undefined),
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer' }),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer' }),
    setLocalDescription: vi.fn(async (description: RTCSessionDescriptionInit) => {
      pc.localDescription = description
    }),
    setRemoteDescription: vi.fn(async (description: RTCSessionDescriptionInit) => {
      pc.remoteDescription = description
    })
  }
  return pc
})

it('queues ICE until remote description and rejects stale or wrong-direction signals', async () => {
  const pc = fakePeer()
  const sendSignal = vi.fn()
  const peer = createCameraPeer({
    role: 'projection',
    sessionId: 'current',
    sendSignal,
    onStream: vi.fn(),
    createPeer: () => pc as unknown as RTCPeerConnection
  })
  await peer.acceptSignal({ sessionId: 'old', kind: 'offer', sdp: 'old' })
  await peer.acceptSignal({ sessionId: 'current', kind: 'answer', sdp: 'wrong' })
  expect(pc.setRemoteDescription).not.toHaveBeenCalled()
  await peer.acceptSignal({ sessionId: 'current', kind: 'ice', candidate: { candidate: 'ice' } })
  expect(pc.addIceCandidate).not.toHaveBeenCalled()
  await peer.acceptSignal({ sessionId: 'current', kind: 'offer', sdp: 'offer' })
  expect(pc.addIceCandidate).toHaveBeenCalledWith({ candidate: 'ice' })
  expect(sendSignal).toHaveBeenCalledWith({ sessionId: 'current', kind: 'answer', sdp: 'answer' })
  peer.dispose()
  expect(pc.close).toHaveBeenCalledOnce()
})

it('only offers a video track, once, and never owns the capture track', async () => {
  const pc = fakePeer()
  const sendSignal = vi.fn()
  const track = { kind: 'video', stop: vi.fn(), readyState: 'live' } as unknown as MediaStreamTrack
  const stream = {
    getVideoTracks: () => [track],
    getAudioTracks: () => []
  } as unknown as MediaStream
  const peer = createCameraPeer({
    role: 'main',
    sessionId: 'one',
    sendSignal,
    onStream: vi.fn(),
    createPeer: () => pc as unknown as RTCPeerConnection
  })
  await peer.start(stream)
  await peer.start(stream)
  expect(pc.addTrack).toHaveBeenCalledTimes(1)
  expect(pc.addTrack.mock.results[0].value.setParameters).toHaveBeenCalledWith({
    encodings: [],
    degradationPreference: 'maintain-resolution'
  })
  expect(sendSignal).toHaveBeenCalledWith({ sessionId: 'one', kind: 'offer', sdp: 'offer' })
  peer.dispose()
  expect(track.stop).not.toHaveBeenCalled()
})

it('does not emit a late offer after disposal', async () => {
  const pc = fakePeer()
  let resolve!: (value: RTCSessionDescriptionInit) => void
  pc.createOffer.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r
      })
  )
  const sendSignal = vi.fn()
  const peer = createCameraPeer({
    role: 'main',
    sessionId: 'one',
    sendSignal,
    onStream: vi.fn(),
    createPeer: () => pc as unknown as RTCPeerConnection
  })
  const stream = {
    getVideoTracks: () => [{ kind: 'video', readyState: 'live' }]
  } as unknown as MediaStream
  const pending = peer.start(stream)
  await vi.waitFor(() => expect(pc.createOffer).toHaveBeenCalledOnce())
  peer.dispose()
  resolve({ type: 'offer', sdp: 'late' })
  await pending
  expect(sendSignal).not.toHaveBeenCalled()
  expect(pc.setLocalDescription).not.toHaveBeenCalled()
})
