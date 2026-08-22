interface PlayOptions {
  padId: string
  buffer: AudioBuffer
  loop: boolean
  volume: number
}

interface PlayingCue {
  source: AudioBufferSourceNode
  gain: GainNode
}

export interface SoundboardAudioEngine {
  load: (assetId: string, blob: Blob) => Promise<AudioBuffer>
  play: (options: PlayOptions) => void
  stop: (padId: string) => void
  fadeOut: (padId: string, fadeMs: number) => void
  stopAll: () => void
  setMasterVolume: (volume: number) => void
  isPlaying: (padId: string) => boolean
  dispose: () => void
}

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function createSoundboardAudioEngine(context = new AudioContext()): SoundboardAudioEngine {
  const master = context.createGain()
  const buffers = new Map<string, AudioBuffer>()
  const playing = new Map<string, PlayingCue[]>()
  master.connect(context.destination)

  function removeCue(padId: string, cue: PlayingCue): void {
    const cues = playing.get(padId) ?? []
    const next = cues.filter((item) => item !== cue)
    if (next.length === 0) {
      playing.delete(padId)
    } else {
      playing.set(padId, next)
    }
  }

  function stop(padId: string): void {
    const cues = playing.get(padId) ?? []
    for (const cue of cues) cue.source.stop()
    playing.delete(padId)
  }

  function fadeOut(padId: string, fadeMs: number): void {
    const cues = playing.get(padId) ?? []
    const endAt = context.currentTime + fadeMs / 1000
    for (const cue of cues) {
      cue.gain.gain.setValueAtTime(cue.gain.gain.value, context.currentTime)
      cue.gain.gain.linearRampToValueAtTime(0, endAt)
      cue.source.stop(endAt)
    }
    playing.delete(padId)
  }

  return {
    async load(assetId, blob) {
      const cached = buffers.get(assetId)
      if (cached) return cached
      const buffer = await context.decodeAudioData(await blob.arrayBuffer())
      buffers.set(assetId, buffer)
      return buffer
    },
    play({ padId, buffer, loop, volume }) {
      void context.resume()
      const source = context.createBufferSource()
      const gain = context.createGain()
      const cue: PlayingCue = { source, gain }
      source.buffer = buffer
      source.loop = loop
      gain.gain.value = clampVolume(volume)
      source.connect(gain)
      gain.connect(master)
      source.onended = () => removeCue(padId, cue)
      playing.set(padId, [...(playing.get(padId) ?? []), cue])
      source.start()
    },
    stop,
    fadeOut,
    stopAll() {
      for (const padId of [...playing.keys()]) stop(padId)
    },
    setMasterVolume(volume) {
      master.gain.value = clampVolume(volume)
    },
    isPlaying: (padId) => (playing.get(padId)?.length ?? 0) > 0,
    dispose() {
      for (const padId of [...playing.keys()]) stop(padId)
      buffers.clear()
      void context.close?.()
    }
  }
}
