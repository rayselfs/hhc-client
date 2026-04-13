import { Button, ListBox, Select, Spinner, toast } from '@heroui/react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { switchVersionIndex } from '@renderer/lib/bible-search-singleton'
import { Key } from 'react-aria-components'

interface BibleSelectorProps {
  onOpenDialog: () => void
}

export default function BibleSelector({ onOpenDialog }: BibleSelectorProps): React.JSX.Element {
  const { t } = useTranslation()
  const versions = useBibleStore((state) => state.versions)
  const isLoading = useBibleStore((state) => state.isLoading)
  const selectedVersionId = useBibleSettingsStore((state) => state.selectedVersionId)
  const { setSelectedVersionId } = useBibleSettingsStore.getState()
  const { fetchVersionContent } = useBibleStore.getState()
  const [isSwitching, setIsSwitching] = useState(false)

  const handleChangeAsync = async (versionId: number): Promise<void> => {
    setIsSwitching(true)
    setSelectedVersionId(versionId)
    try {
      await fetchVersionContent(versionId)
      const version = versions.find((v) => v.id === versionId)
      const books = useBibleStore.getState().content.get(versionId)
      if (version && books && books.length > 0) {
        await switchVersionIndex(versionId, version, books).catch(() =>
          toast.warning(t('toast.bibleIndexFailed'))
        )
      }
    } finally {
      setIsSwitching(false)
    }
  }

  const handleChange = (key: Key | null): void => {
    if (!key) return
    void handleChangeAsync(Number(key))
  }

  const effectiveValue = selectedVersionId || versions[0]?.id || 0
  const busy = isLoading || isSwitching

  return (
    <div className="flex flex-row items-center gap-2">
      <Select
        value={effectiveValue}
        onChange={handleChange}
        aria-label={t('bible.selector.selectVersion')}
        isDisabled={busy}
        className="w-44"
      >
        <Select.Trigger className="rounded-full h-10 items-center">
          <Select.Value className="justify-center flex" />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {versions.map((v) => (
              <ListBox.Item key={v.id} id={v.id} textValue={v.name}>
                {v.name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <Button isIconOnly onPress={onOpenDialog} isDisabled={busy} variant="tertiary">
        {busy ? <Spinner size="sm" /> : '📖'}
      </Button>
    </div>
  )
}
