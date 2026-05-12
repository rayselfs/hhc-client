import React from 'react'
import { Dropdown, Button } from '@heroui/react'
import { ArrowUpDown, ArrowUp, ArrowDown, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SortField, SortDir } from '@renderer/stores/file-explorer'

export interface SortDropdownProps {
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

export default function SortDropdown({ sortField, sortDir, onSortChange }: SortDropdownProps): React.JSX.Element {
  const { t } = useTranslation()
  const isActive = sortDir !== 'none'

  const handleFieldPress = (field: SortField): void => {
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
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu aria-label={t('fileExplorer.sort.title', 'Sort')}>
          <Dropdown.Item
            key="none"
            onPress={() => onSortChange(sortField, 'none')}
          >
            <div className="flex items-center justify-between w-full">
              <span>{t('fileExplorer.sort.none', 'None')}</span>
              {!isActive && <Check size={14} className="text-primary ml-4" />}
            </div>
          </Dropdown.Item>
          {SORT_FIELDS.map((field) => {
            const isFieldActive = isActive && sortField === field
            return (
              <Dropdown.Item key={field} onPress={() => handleFieldPress(field)}>
                <div className="flex items-center justify-between w-full">
                  <span>{t(FIELD_KEY[field])}</span>
                  {isFieldActive && (
                    sortDir === 'asc'
                      ? <ArrowUp size={14} className="text-primary ml-4" />
                      : <ArrowDown size={14} className="text-primary ml-4" />
                  )}
                </div>
              </Dropdown.Item>
            )
          })}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
