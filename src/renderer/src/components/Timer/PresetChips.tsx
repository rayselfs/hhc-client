import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Chip, Button, Input } from '@heroui/react'
import { Plus, X, Check } from 'lucide-react'
import { useTimerStore } from '@renderer/stores/timer'

interface PresetChipsProps {
  className?: string
}

export default function PresetChips({ className }: PresetChipsProps): React.JSX.Element {
  const { t } = useTranslation()
  const presets = useTimerStore((s) => s.presets)
  const totalDuration = useTimerStore((s) => s.totalDuration)
  const applyPreset = useTimerStore((s) => s.applyPreset)
  const removePreset = useTimerStore((s) => s.removePreset)
  const addPreset = useTimerStore((s) => s.addPreset)
  const loadPresets = useTimerStore((s) => s.loadPresets)

  const [isAdding, setIsAdding] = useState(false)
  const [newPresetName, setNewPresetName] = useState('')

  useEffect(() => {
    loadPresets()
  }, [loadPresets])

  const handleAddOpen = (): void => {
    setNewPresetName('')
    setIsAdding(true)
  }

  const handleAddConfirm = (): void => {
    const name = newPresetName.trim()
    if (name) {
      addPreset(name, totalDuration)
    }
    setIsAdding(false)
    setNewPresetName('')
  }

  const handleAddCancel = (): void => {
    setIsAdding(false)
    setNewPresetName('')
  }

  const handleAddKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') handleAddConfirm()
    if (e.key === 'Escape') handleAddCancel()
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((preset) => (
          <Chip key={preset.id} className="cursor-pointer">
            <span
              role="button"
              tabIndex={0}
              aria-label={preset.name}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') applyPreset(preset.id)
              }}
              onClick={() => applyPreset(preset.id)}
              className="pr-1"
            >
              {preset.name}
            </span>
            <button
              type="button"
              aria-label={`${t('timer.deletePreset')} ${preset.name}`}
              onClick={(e) => {
                e.stopPropagation()
                removePreset(preset.id)
              }}
              className="ml-1 inline-flex items-center justify-center rounded-full hover:opacity-70"
            >
              <X className="size-3" />
            </button>
          </Chip>
        ))}
        {isAdding ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder={t('timer.addPreset')}
              aria-label={t('timer.addPreset')}
              className="w-28"
            />
            <Button variant="ghost" onPress={handleAddConfirm} aria-label="Confirm Add Preset">
              <Check className="size-4" />
            </Button>
            <Button variant="ghost" onPress={handleAddCancel} aria-label="Cancel Add Preset">
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <Button variant="ghost" onPress={handleAddOpen} aria-label={t('timer.addPreset')}>
            <Plus className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
