import { beforeEach, expect, it, vi } from 'vitest'
import { executeLanRemoteCommand } from '@renderer/lib/lan-remote-command-gateway'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'

beforeEach(() => {
  useMediaProjectionStore.getState().exit()
})

it('executes presentation commands through media projection store', async () => {
  const next = vi.fn()
  useMediaProjectionStore.setState({ next } as never)

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
