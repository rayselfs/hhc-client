import React from 'react'
import { Dropdown, Button, Separator } from '@heroui/react'
import { ArrowUpDown, ArrowUp, ArrowDown, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SortField, SortDir, GroupMode } from '@renderer/stores/file-explorer'

export interface SortDropdownProps {
  groupMode?: GroupMode
  onGroupChange?: (mode: GroupMode) => void
  sortField: SortField
  sortDir: SortDir
  onSortChange: (field: SortField, dir: SortDir) => void
}

type SortFieldKey =
  | 'fileExplorer.sort.name'
  | 'fileExplorer.sort.createdAt'
  | 'fileExplorer.sort.size'
  | 'fileExplorer.sort.kind'

const SORT_FIELDS: SortField[] = ['name', 'createdAt', 'size', 'kind']
const FIELD_KEY: Record<SortField, SortFieldKey> = {
  name: 'fileExplorer.sort.name',
  createdAt: 'fileExplorer.sort.createdAt',
  size: 'fileExplorer.sort.size',
  kind: 'fileExplorer.sort.kind'
}

export default function SortDropdown({
  groupMode,
  onGroupChange,
  sortField,
  sortDir,
  onSortChange
}: SortDropdownProps): React.JSX.Element {
  const { t } = useTranslation()
  const isActive = sortDir !== 'none'

  const handleAction = (key: React.Key): void => {
    if (key === 'none') {
      onSortChange(sortField, 'none')
      return
    }
    if (!SORT_FIELDS.includes(key as SortField)) return
    const field = key as SortField
    if (!isActive || sortField !== field) {
      onSortChange(field, 'asc')
    } else if (sortDir === 'asc') {
      onSortChange(field, 'desc')
    } else {
      onSortChange(field, 'asc')
    }
  }

  return (
    <Dropdown>
      <Button
        isIconOnly
        variant="outline"
        size="lg"
        aria-label={t('fileExplorer.sort.title', 'Sort')}
        className={isActive ? 'text-primary' : ''}
      >
        <ArrowUpDown size={16} />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={handleAction}>
          <Dropdown.Section>
            <Dropdown.Item
              id="none"
              className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
            >
              {t('fileExplorer.sort.none', 'None')}
              {!isActive && <Check size={14} className="ml-auto" />}
            </Dropdown.Item>
          </Dropdown.Section>
          <Dropdown.Section>
            {SORT_FIELDS.map((field) => {
              const isFieldActive = isActive && sortField === field
              return (
                <Dropdown.Item
                  key={field}
                  id={field}
                  className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground"
                >
                  {t(FIELD_KEY[field])}
                  {isFieldActive &&
                    (sortDir === 'asc' ? (
                      <ArrowUp size={14} className="text-primary ml-auto" />
                    ) : (
                      <ArrowDown size={14} className="text-primary ml-auto" />
                    ))}
                </Dropdown.Item>
              )
            })}
          </Dropdown.Section>
          {onGroupChange && <Separator />}
          {onGroupChange && (
            <Dropdown.SubmenuTrigger>
              <Dropdown.Item id="group" textValue={t('fileExplorer.group.title')}>
                {t('fileExplorer.group.title')}
                <Dropdown.SubmenuIndicator />
              </Dropdown.Item>
              <Dropdown.Popover placement="right top">
                <Dropdown.Menu
                  aria-label={t('fileExplorer.group.title')}
                  onAction={(key) => onGroupChange(key === 'group-date' ? 'date' : 'none')}
                >
                  {(['none', 'date'] as const).map((mode) => (
                    <Dropdown.Item
                      key={mode}
                      id={`group-${mode}`}
                      textValue={t(`fileExplorer.group.${mode}`)}
                    >
                      {t(`fileExplorer.group.${mode}`)}
                      {groupMode === mode && <Check size={14} className="ml-auto" />}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.SubmenuTrigger>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
