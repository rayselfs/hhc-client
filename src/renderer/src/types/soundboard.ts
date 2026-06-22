export type SoundboardMode = 'performance' | 'edit'
export type SoundboardTriggerMode = 'one-shot' | 'toggle' | 'hold'
export type SoundboardPadStatus = 'idle' | 'loading' | 'playing' | 'error'

export interface SoundboardGridSize {
  rows: number
  columns: number
}

export interface SoundboardAssetRef {
  assetId: string
  name: string
  mimeType: string
  size: number
}

export interface SoundboardMidiNoteMapping {
  inputId: string
  channel: number
  note: number
}

export interface SoundboardMidiCcMapping {
  inputId: string
  channel: number
  controller: number
}

export interface SoundboardPad {
  id: string
  label: string
  color: string
  asset: SoundboardAssetRef | null
  triggerMode: SoundboardTriggerMode
  loop: boolean
  volume: number
  midiNote: SoundboardMidiNoteMapping | null
  midiVolume: SoundboardMidiCcMapping | null
}

export interface SoundboardScene {
  id: string
  name: string
  pads: Record<string, SoundboardPad>
  padOrder: string[]
}

export interface SoundboardBoard {
  id: string
  name: string
  scenes: Record<string, SoundboardScene>
  sceneOrder: string[]
}

export interface SoundboardLivePadState {
  status: SoundboardPadStatus
  startedAt: number | null
  error: string | null
}

export interface SoundboardSettings {
  defaultTriggerMode: SoundboardTriggerMode
  defaultLoop: boolean
  globalFadeMs: number
  masterVolume: number
  midiEnabled: boolean
  preferredMidiInputId: string | null
}
