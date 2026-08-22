import { describe, expect, it } from 'vitest'
import {
  isPrivateLanAddress,
  parseLanRemoteCommand,
  sanitizeLanRemoteSnapshot
} from '../lan-remote'

describe('LAN remote contract', () => {
  it('accepts only supported commands', () => {
    expect(parseLanRemoteCommand({ requestId: 'r1', type: 'presentation:next' })).toEqual({
      requestId: 'r1',
      type: 'presentation:next'
    })
    expect(parseLanRemoteCommand({ requestId: 'r2', type: 'presentation:jump', index: 2 })).toEqual(
      {
        requestId: 'r2',
        type: 'presentation:jump',
        index: 2
      }
    )
    expect(
      parseLanRemoteCommand({ requestId: 'r3', type: 'filesystem:delete', path: '/tmp/x' })
    ).toBeNull()
    expect(
      parseLanRemoteCommand({ requestId: 'r4', type: 'projection:blank', enabled: true })
    ).toBeNull()
  })

  it('sanitizes snapshots by whitelisting fields', () => {
    const snapshot = sanitizeLanRemoteSnapshot({
      revision: 1,
      presentation: {
        currentIndex: 0,
        total: 2,
        currentName: 'Slide',
        nextName: 'Next',
        canPrevious: false,
        canNext: true,
        isPlaying: false,
        nativeUrl: 'hhc-media://file/secret',
        notes: 'hidden'
      },
      projection: { isOpen: true, isBlanked: false },
      timer: { status: 'running', remainingSeconds: 30 },
      stopwatch: { status: 'stopped', elapsedMs: 0 }
    } as never)

    expect(JSON.stringify(snapshot)).not.toContain('nativeUrl')
    expect(JSON.stringify(snapshot)).not.toContain('hidden')
    expect(snapshot.projection).toEqual({ isOpen: true })
    expect(snapshot.presentation.currentName).toBe('Slide')
  })

  it('allows only private LAN addresses by default', () => {
    expect(isPrivateLanAddress('192.168.1.10')).toBe(true)
    expect(isPrivateLanAddress('10.0.0.5')).toBe(true)
    expect(isPrivateLanAddress('172.16.0.5')).toBe(true)
    expect(isPrivateLanAddress('172.32.0.5')).toBe(false)
    expect(isPrivateLanAddress('8.8.8.8')).toBe(false)
    expect(isPrivateLanAddress('127.0.0.1')).toBe(false)
  })
})
