import { Button, ListBox, Select } from '@heroui/react'
import React from 'react'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { Key } from 'react-aria-components'

interface BibleSelectorProps {
  onOpenDialog: () => void
}

export default function BibleSelector({ onOpenDialog }: BibleSelectorProps): React.JSX.Element {
  const versions = useBibleStore((state) => state.versions)
  const selectedVersionId = useBibleSettingsStore((state) => state.selectedVersionId)
  const { setSelectedVersionId } = useBibleSettingsStore.getState()
  const { fetchVersionContent } = useBibleStore.getState()

  const handleSelectionChange = (key: Key | null): void => {
    if (key) {
      const versionId = key.toString()
      setSelectedVersionId(versionId)
      fetchVersionContent(versionId)
    }
  }

  return (
    <div className="flex flex-row items-center gap-2">
      <Select
        selectedKey={selectedVersionId}
        onSelectionChange={handleSelectionChange}
        aria-label="Select Bible version"
      >
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {versions.map((v) => (
              <ListBox.Item key={v.id} id={v.id}>
                {v.name}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <Button size="sm" isIconOnly onPress={onOpenDialog}>
        📖
      </Button>
    </div>
  )
}
