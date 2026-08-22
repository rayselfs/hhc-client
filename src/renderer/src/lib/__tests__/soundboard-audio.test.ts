import { describe, expect, it, vi } from 'vitest'
import { createSoundboardAudioEngine } from '@renderer/lib/soundboard-audio'

class FakeGain {
  gain = {
    value: 1,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn()
  }

  connect = vi.fn()
}

class FakeBufferSource {
  buffer: unknown = null
  loop = false
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
  onended: (() => void) | null = null
}

class FakeAudioContext {
  currentTime = 0
  destination = {}
  createGain = vi.fn(() => new FakeGain())
  createBufferSource = vi.fn(() => new FakeBufferSource())
  decodeAudioData = vi.fn(async () => ({ duration: 1 }))
  resume = vi.fn(async () => undefined)
}

describe('soundboard audio engine', () => {
  it('starts and stops a cue', async () => {
    const context = new FakeAudioContext()
    const engine = createSoundboardAudioEngine(context as unknown as AudioContext)
    const buffer = await engine.load('pad-1', new Blob(['audio'], { type: 'audio/mpeg' }))

    engine.play({ padId: 'pad-1', buffer, loop: true, volume: 0.5 })

    expect(context.createBufferSource).toHaveBeenCalled()
    expect(engine.isPlaying('pad-1')).toBe(true)

    engine.stop('pad-1')
    expect(engine.isPlaying('pad-1')).toBe(false)
  })
})
