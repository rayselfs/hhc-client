import { beforeEach, expect, it, vi } from 'vitest'
import { executeLanRemoteCommand } from '@renderer/lib/lan-remote-command-gateway'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import type { FileItemRecord } from '@shared/types/folder'

function makeFile(id: string, mimeType = 'image/png'): FileItemRecord {
  return {
    id,
    name: id,
    mimeType,
    type: 'file',
    sortIndex: 0,
    parentId: 'root',
    size: 1,
    url: `blob:${id}`,
    createdAt: 1,
    expiresAt: null
  }
}

beforeEach(() => {
  useMediaProjectionStore.getState().exit()
})

it('executes presentation commands through media projection store', async () => {
  const next = vi.fn()
  useMediaProjectionStore.setState({
    next,
    playlist: [makeFile('first'), makeFile('second')],
    currentIndex: 0,
    isPresenting: true
  } as never)

  const ack = await executeLanRemoteCommand({ requestId: 'r1', type: 'presentation:next' })

  expect(next).toHaveBeenCalled()
  expect(ack).toEqual({ requestId: 'r1', status: 'accepted' })
})

it('rejects stale jump commands', async () => {
  const ack = await executeLanRemoteCommand({
    requestId: 'r2',
    type: 'presentation:jump',
    index: 1,
    requiredRevision: -1
  })

  expect(ack.status).toBe('rejected')
})

it('rejects presentation navigation when no presentation is active', async () => {
  const ack = await executeLanRemoteCommand({ requestId: 'inactive', type: 'presentation:next' })

  expect(ack).toEqual({
    requestId: 'inactive',
    status: 'rejected',
    reason: 'presentation-not-active'
  })
})

it('rejects presentation navigation at playlist boundaries', async () => {
  useMediaProjectionStore.setState({
    playlist: [makeFile('only')],
    currentIndex: 0,
    isPresenting: true,
    isEnded: false
  })

  await expect(
    executeLanRemoteCommand({ requestId: 'prev', type: 'presentation:prev' })
  ).resolves.toEqual({
    requestId: 'prev',
    status: 'rejected',
    reason: 'previous-unavailable'
  })
  await expect(
    executeLanRemoteCommand({ requestId: 'next', type: 'presentation:next' })
  ).resolves.toEqual({
    requestId: 'next',
    status: 'rejected',
    reason: 'next-unavailable'
  })
})

it('rejects presentation jumps outside the playlist', async () => {
  useMediaProjectionStore.setState({
    playlist: [makeFile('only')],
    currentIndex: 0,
    isPresenting: true
  })

  await expect(
    executeLanRemoteCommand({
      requestId: 'jump',
      type: 'presentation:jump',
      index: 1
    })
  ).resolves.toEqual({
    requestId: 'jump',
    status: 'rejected',
    reason: 'index-out-of-range'
  })
})

it('rejects media playback commands unless the active item is a video', async () => {
  useMediaProjectionStore.setState({
    playlist: [makeFile('image')],
    currentIndex: 0,
    isPresenting: true
  })

  await expect(
    executeLanRemoteCommand({ requestId: 'play', type: 'media:play' })
  ).resolves.toEqual({
    requestId: 'play',
    status: 'rejected',
    reason: 'video-not-active'
  })
})

it('rejects redundant video playback commands', async () => {
  useMediaProjectionStore.setState({
    playlist: [makeFile('video', 'video/mp4')],
    currentIndex: 0,
    isPresenting: true,
    typeStates: {
      video: { hasStarted: true, isPlaying: true, isEnded: false }
    }
  })

  await expect(
    executeLanRemoteCommand({ requestId: 'play', type: 'media:play' })
  ).resolves.toEqual({
    requestId: 'play',
    status: 'rejected',
    reason: 'already-playing'
  })

  useMediaProjectionStore.setState({
    typeStates: {
      video: { hasStarted: true, isPlaying: false, isEnded: false }
    }
  })
  await expect(
    executeLanRemoteCommand({ requestId: 'pause', type: 'media:pause' })
  ).resolves.toEqual({
    requestId: 'pause',
    status: 'rejected',
    reason: 'already-paused'
  })
})
