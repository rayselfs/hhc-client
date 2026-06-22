import { describe, expect, it } from 'vitest'
import { parseMidiMessage } from '@renderer/lib/soundboard-midi'

describe('parseMidiMessage', () => {
  it('normalizes note on, note off, and cc messages', () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 36, 127]))).toEqual({
      type: 'note-on',
      channel: 1,
      note: 36,
      velocity: 127
    })
    expect(parseMidiMessage(new Uint8Array([0x90, 36, 0]))).toEqual({
      type: 'note-off',
      channel: 1,
      note: 36,
      velocity: 0
    })
    expect(parseMidiMessage(new Uint8Array([0xb0, 1, 64]))).toEqual({
      type: 'cc',
      channel: 1,
      controller: 1,
      value: 64
    })
  })
})
