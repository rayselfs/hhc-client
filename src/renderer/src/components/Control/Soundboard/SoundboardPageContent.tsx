import { useCallback, useEffect, useRef } from 'react'
import SoundboardGrid from '@renderer/components/Control/Soundboard/SoundboardGrid'
import SoundboardInspector from '@renderer/components/Control/Soundboard/SoundboardInspector'
import SoundboardLibrary from '@renderer/components/Control/Soundboard/SoundboardLibrary'
import { getFileBlob, getFileSource, openFileExplorerDB } from '@renderer/lib/file-explorer-db'
import {
  createSoundboardAudioEngine,
  type SoundboardAudioEngine
} from '@renderer/lib/soundboard-audio'
import { useSoundboardStore } from '@renderer/stores/soundboard'

export default function SoundboardPageContent(): React.JSX.Element {
  const engineRef = useRef<SoundboardAudioEngine | null>(null)
  const board = useSoundboardStore((state) => state.getSelectedBoard())
  const scene = useSoundboardStore((state) => state.getSelectedScene())
  const mode = useSoundboardStore((state) => state.mode)
  const setMode = useSoundboardStore((state) => state.setMode)
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

  return (
    <main
      className="flex h-full min-h-0 flex-col bg-background text-foreground"
      data-testid="soundboard-page-content"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">Soundboard</h1>
          <p className="text-xs text-muted">
            {board.name} / {scene?.name ?? 'No scene'}
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1 text-sm"
          onClick={() => setMode(mode === 'performance' ? 'edit' : 'performance')}
        >
          {mode === 'performance' ? 'Performance' : 'Edit'}
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        {mode === 'edit' && <SoundboardLibrary />}
        <SoundboardGrid
          onTriggerPad={(padId) => void triggerPad(padId)}
          onReleasePad={releasePad}
        />
        {mode === 'edit' && <SoundboardInspector />}
      </div>
    </main>
  )
}
