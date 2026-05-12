import React from 'react'
import { Dropdown } from '@heroui/react'
import { ArrowUpDown, ArrowUp, ArrowDown, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SortField, SortDir } from '@renderer/stores/file-explorer'

export interface SortDropdownProps {
  sortField: SortField
  sortDir: SortDir
  onSortChange: (field: SortField, dir: SortDir) => void
}

export default function SortDropdown({
  sortField,
  sortDir,
  onSortChange
}: SortDropdownProps): React.JSX.Element {
  const { t } = useTranslation()

  const isDefault = sortField === 'createdAt' && sortDir === 'asc'
  const ActiveIcon = isDefault ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown

  const items: { field: SortField; dir: SortDir; labelKey: string; defaultLabel: string }[] = [
    { field: 'name', dir: 'asc', labelKey: 'fileExplorer.sort.nameAsc', defaultLabel: 'Name A–Z' },
    { field: 'name', dir: 'desc', labelKey: 'fileExplorer.sort.nameDesc', defaultLabel: 'Name Z–A' },
    { field: 'createdAt', dir: 'asc', labelKey: 'fileExplorer.sort.createdAsc', defaultLabel: 'Oldest First' },
    { field: 'createdAt', dir: 'desc', labelKey: 'fileExplorer.sort.createdDesc', defaultLabel: 'Newest First' },
    { field: 'size', dir: 'asc', labelKey: 'fileExplorer.sort.sizeAsc', defaultLabel: 'Smallest First' },
    { field: 'size', dir: 'desc', labelKey: 'fileExplorer.sort.sizeDesc', defaultLabel: 'Largest First' },
    { field: 'kind', dir: 'asc', labelKey: 'fileExplorer.sort.kindAsc', defaultLabel: 'Kind A–Z' },
    { field: 'kind', dir: 'desc', labelKey: 'fileExplorer.sort.kindDesc', defaultLabel: 'Kind Z–A' }
  ]

  return (
    <Dropdown>
      <Dropdown.Trigger>
        <div
          aria-label={t('fileExplorer.sort.title', 'Sort')}
          className={`flex items-center justify-center w-10 h-10 rounded-full border border-border transition-colors cursor-default ${
            isDefault
              ? 'text-muted-fg hover:text-foreground hover:bg-default/60'
              : 'text-primary border-primary/30 bg-primary/10 hover:bg-primary/20'
          }`}
        >
          <ActiveIcon size={16} />
        </div>
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu aria-label={t('fileExplorer.sort.title', 'Sort')}>
          {items.map((item) => {
            const isActive = sortField === item.field && sortDir === item.dir
            return (
              <Dropdown.Item
                key={`${item.field}-${item.dir}`}
                onPress={() => onSortChange(item.field, item.dir)}
                className="flex items-center justify-between"
              >
                <div className="flex items-center justify-between w-full">
                  <span>{t(item.labelKey, item.defaultLabel)}</span>
                  {isActive && <Check size={16} className="text-primary ml-4" />}
                </div>
              </Dropdown.Item>
            )
          })}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
