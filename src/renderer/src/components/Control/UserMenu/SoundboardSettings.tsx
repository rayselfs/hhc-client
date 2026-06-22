import { useTranslation } from 'react-i18next'
import { useSoundboardStore } from '@renderer/stores/soundboard'
import type { SoundboardTriggerMode } from '@renderer/types/soundboard'

const TRIGGER_MODES: SoundboardTriggerMode[] = ['one-shot', 'toggle', 'hold']

export default function SoundboardSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const settings = useSoundboardStore((state) => state.settings)
  const setDefaultTriggerMode = useSoundboardStore((state) => state.setDefaultTriggerMode)
  const setGlobalFadeMs = useSoundboardStore((state) => state.setGlobalFadeMs)
  const setMasterVolume = useSoundboardStore((state) => state.setMasterVolume)
  const setMidiEnabled = useSoundboardStore((state) => state.setMidiEnabled)

  return (
    <div className="space-y-4 p-5">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t('preferences.soundboard.playback')}</h2>
        <label className="grid gap-1 text-sm">
          {t('preferences.soundboard.defaultTriggerMode')}
          <select
            aria-label={t('preferences.soundboard.defaultTriggerMode')}
            value={settings.defaultTriggerMode}
            onChange={(event) => setDefaultTriggerMode(event.target.value as SoundboardTriggerMode)}
            className="rounded-md border border-border bg-background px-2 py-1"
          >
            {TRIGGER_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {t('preferences.soundboard.globalFade')}
          <input
            aria-label={t('preferences.soundboard.globalFade')}
            type="number"
            min={0}
            value={settings.globalFadeMs}
            onChange={(event) => setGlobalFadeMs(Number(event.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1"
          />
        </label>
        <label className="grid gap-1 text-sm">
          {t('preferences.soundboard.masterVolumeDefault')}
          <input
            aria-label={t('preferences.soundboard.masterVolumeDefault')}
            type="number"
            min={0}
            max={100}
            value={Math.round(settings.masterVolume * 100)}
            onChange={(event) => setMasterVolume(Number(event.target.value) / 100)}
            className="rounded-md border border-border bg-background px-2 py-1"
          />
        </label>
      </section>
      <section className="space-y-3 border-t border-border pt-4">
        <h2 className="text-sm font-semibold">{t('preferences.soundboard.midi')}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.midiEnabled}
            onChange={(event) => setMidiEnabled(event.target.checked)}
          />
          {t('preferences.soundboard.enableMidi')}
        </label>
      </section>
    </div>
  )
}
