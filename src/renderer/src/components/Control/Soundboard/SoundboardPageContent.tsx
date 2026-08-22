import { useCallback, useEffect, useRef } from 'react'
import SoundboardGrid from '@renderer/components/Control/Soundboard/SoundboardGrid'
import SoundboardInspector from '@renderer/components/Control/Soundboard/SoundboardInspector'
import SoundboardLibrary from '@renderer/components/Control/Soundboard/SoundboardLibrary'
import SoundboardMixer from '@renderer/components/Control/Soundboard/SoundboardMixer'
import SoundboardTopBar from '@renderer/components/Control/Soundboard/SoundboardTopBar'
import { getFileBlob, getFileSource, openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import {
  createSoundboardAudioEngine,
  type SoundboardAudioEngine
} from '@renderer/lib/soundboard-audio'
import {
  ccValueToVolume,
  parseMidiMessage,
  requestMidiAccess,
  type SoundboardMidiInput
} from '@renderer/lib/soundboard-midi'
import { useSoundboardStore } from '@renderer/stores/soundboard'

export default function SoundboardPageContent(): React.JSX.Element {
  const engineRef = useRef<SoundboardAudioEngine | null>(null)
  const mode = useSoundboardStore((state) => state.mode)
  const settings = useSoundboardStore((state) => state.settings)
  const setPadLiveState = useSoundboardStore((state) => state.setPadLiveState)

  useEffect(() => {
    engineRef.current = createSoundboardAudioEngine()
    return () => engineRef.current?.dispose()
  }, [])

  useEffect(() => {
    engineRef.current?.setMasterVolume(settings.masterVolume)
  }, [settings.masterVolume])

  const triggerPad = useCallback(
    async (padId: string): Promise<void> => {
      const state = useSoundboardStore.getState()
      const pad = state.getSelectedScene()?.pads[padId]
      if (!pad?.asset || !engineRef.current) return
      const asset = pad.asset

      if (pad.triggerMode === 'toggle' && engineRef.current.isPlaying(padId)) {
        engineRef.current.fadeOut(padId, settings.globalFadeMs)
        setPadLiveState(padId, { status: 'idle', startedAt: null, error: null })
        return
      }

      setPadLiveState(padId, { status: 'loading', startedAt: null, error: null })
      const db = await openFileExplorerDB()
      const blob = await getFileBlob(db, asset.assetId)
      const source = blob
        ? { blob, revoke: () => undefined }
        : await (async () => {
            const fileSource = await getFileSource(db, asset.assetId, asset.mimeType)
            if (!fileSource) return null
            const response = await fetch(fileSource.url)
            return { blob: await response.blob(), revoke: fileSource.revoke }
          })()

      if (!source) {
        setPadLiveState(padId, {
          status: 'error',
          startedAt: null,
          error: 'Audio file is missing'
        })
        return
      }

      try {
        const buffer = await engineRef.current.load(asset.assetId, source.blob)
        if (pad.triggerMode === 'one-shot') engineRef.current.stop(padId)
        engineRef.current.play({ padId, buffer, loop: pad.loop, volume: pad.volume })
        setPadLiveState(padId, { status: 'playing', startedAt: Date.now(), error: null })
      } catch (error) {
        setPadLiveState(padId, {
          status: 'error',
          startedAt: null,
          error: error instanceof Error ? error.message : 'Audio playback failed'
        })
      } finally {
        source.revoke()
      }
    },
    [setPadLiveState, settings.globalFadeMs]
  )

  const releasePad = useCallback(
    (padId: string): void => {
      const pad = useSoundboardStore.getState().getSelectedScene()?.pads[padId]
      if (pad?.triggerMode !== 'hold') return
      engineRef.current?.fadeOut(padId, settings.globalFadeMs)
      setPadLiveState(padId, { status: 'idle', startedAt: null, error: null })
    },
    [setPadLiveState, settings.globalFadeMs]
  )

  const stopAll = useCallback((): void => {
    engineRef.current?.stopAll()
    for (const padId of Object.keys(useSoundboardStore.getState().live)) {
      setPadLiveState(padId, { status: 'idle', startedAt: null, error: null })
    }
  }, [setPadLiveState])

  const fadeAll = useCallback((): void => {
    const live = useSoundboardStore.getState().live
    for (const padId of Object.keys(live)) {
      engineRef.current?.fadeOut(padId, settings.globalFadeMs)
      setPadLiveState(padId, { status: 'idle', startedAt: null, error: null })
    }
  }, [setPadLiveState, settings.globalFadeMs])

  useEffect(() => {
    if (!settings.midiEnabled) return
    let mounted = true
    let inputs: SoundboardMidiInput[] = []

    void requestMidiAccess()
      .then((access) => {
        if (!mounted || !access) return
        inputs = [...access.inputs.values()]

        for (const input of inputs) {
          input.onmidimessage = (event) => {
            if (!event.data) return
            const message = parseMidiMessage(event.data)
            if (!message) return
            const state = useSoundboardStore.getState()
            const scene = state.getSelectedScene()
            if (!scene) return

            for (const pad of Object.values(scene.pads)) {
              const noteInputMatches =
                pad.midiNote?.inputId === 'default' || pad.midiNote?.inputId === input.id
              const ccInputMatches =
                pad.midiVolume?.inputId === 'default' || pad.midiVolume?.inputId === input.id

              if (
                message.type === 'note-on' &&
                noteInputMatches &&
                pad.midiNote?.channel === message.channel &&
                pad.midiNote.note === message.note
              ) {
                void triggerPad(pad.id)
              }

              if (
                message.type === 'note-off' &&
                noteInputMatches &&
                pad.triggerMode === 'hold' &&
                pad.midiNote?.channel === message.channel &&
                pad.midiNote.note === message.note
              ) {
                releasePad(pad.id)
              }

              if (
                message.type === 'cc' &&
                ccInputMatches &&
                pad.midiVolume?.channel === message.channel &&
                pad.midiVolume.controller === message.controller
              ) {
                state.updatePad(pad.id, { volume: ccValueToVolume(message.value) })
              }
            }
          }
        }
      })
      .catch((error) => {
        console.warn('[soundboard-midi] Failed to initialize MIDI access', error)
      })

    return () => {
      mounted = false
      for (const input of inputs) input.onmidimessage = null
    }
  }, [releasePad, settings.midiEnabled, triggerPad])

  return (
    <main
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
      data-testid="soundboard-page-content"
    >
      <SoundboardTopBar />
      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && <SoundboardLibrary />}
        <SoundboardGrid
          onTriggerPad={(padId) => void triggerPad(padId)}
          onReleasePad={releasePad}
        />
        {mode === 'edit' && <SoundboardInspector />}
      </div>
      <SoundboardMixer onStopAll={stopAll} onFadeAll={fadeAll} />
    </main>
  )
}
