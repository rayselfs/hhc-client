export type SoundboardMidiMessage =
  | { type: 'note-on'; channel: number; note: number; velocity: number }
  | { type: 'note-off'; channel: number; note: number; velocity: number }
  | { type: 'cc'; channel: number; controller: number; value: number }

export interface SoundboardMidiInputInfo {
  id: string
  name: string
}

export type SoundboardMidiInput = MIDIInput
export type SoundboardMidiAccess = MIDIAccess

export function parseMidiMessage(data: Uint8Array): SoundboardMidiMessage | null {
  const status = data[0]
  const command = status & 0xf0
  const channel = (status & 0x0f) + 1

  if (command === 0x90) {
    const note = data[1]
    const velocity = data[2]
    return velocity === 0
      ? { type: 'note-off', channel, note, velocity }
      : { type: 'note-on', channel, note, velocity }
  }

  if (command === 0x80) {
    return { type: 'note-off', channel, note: data[1], velocity: data[2] }
  }

  if (command === 0xb0) {
    return { type: 'cc', channel, controller: data[1], value: data[2] }
  }

  return null
}

export async function requestMidiAccess(): Promise<SoundboardMidiAccess | null> {
  if (typeof navigator.requestMIDIAccess !== 'function') return null
  return navigator.requestMIDIAccess()
}

export function listMidiInputs(access: SoundboardMidiAccess): SoundboardMidiInputInfo[] {
  return [...access.inputs.values()].map((input) => ({
    id: input.id,
    name: input.name || input.id
  }))
}

export function ccValueToVolume(value: number): number {
  return Math.min(1, Math.max(0, value / 127))
}
