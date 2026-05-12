import React, { useState } from 'react'
import { Button } from '@heroui/react/button'
import { Popover } from '@heroui/react/popover'
import { ArrowUpDown, ArrowUp, ArrowDown, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import GlassDivider from '@renderer/components/Common/GlassDivider'
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
  const [isOpen, setIsOpen] = useState(false)
  const isActive = sortDir !== 'none'

  const handleFieldPress = (field: SortField): void => {
    if (!isActive || sortField !== field) {
      onSortChange(field, 'asc')
    } else if (sortDir === 'asc') {
      onSortChange(field, 'desc')
    } else {
      onSortChange(field, 'asc')
    }
    setIsOpen(false)
  }

  return (
    <Popover isOpen={isOpen} onOpenChange={setIsOpen}>
      <Button
        isIconOnly
        variant="outline"
        size="lg"
        aria-label={t('fileExplorer.sort.title', 'Sort')}
        className={isActive ? 'text-primary' : ''}
      >
        <ArrowUpDown size={16} />
      </Button>
      <Popover.Content placement="bottom start" className="w-44 p-1">
        <Popover.Dialog>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground w-full"
              onClick={() => { onSortChange(sortField, 'none'); setIsOpen(false) }}
            >
              <span>{t('fileExplorer.sort.none', 'None')}</span>
              {!isActive && <Check size={14} className="text-primary ml-4" />}
            </button>
            <GlassDivider className="my-0.5" />
            {SORT_FIELDS.map((field) => {
              const isFieldActive = isActive && sortField === field
              return (
                <button
                  key={field}
                  type="button"
                  className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground w-full"
                  onClick={() => handleFieldPress(field)}
                >
                  <span>{t(FIELD_KEY[field])}</span>
                  {isFieldActive && (
                    sortDir === 'asc'
                      ? <ArrowUp size={14} className="text-primary ml-4" />
                      : <ArrowDown size={14} className="text-primary ml-4" />
                  )}
                </button>
              )
            })}
          </div>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
