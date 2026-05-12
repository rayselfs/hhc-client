import React from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, Grid2X2, Grid3X3, AlignJustify, Check } from 'lucide-react'
import { Dropdown, Button } from '@heroui/react'
import type { FileExplorerViewMode } from '@shared/types/folder'

type ViewLabelKey =
  | 'fileExplorer.view.largeIcon'
  | 'fileExplorer.view.mediumIcon'
  | 'fileExplorer.view.smallIcon'
  | 'fileExplorer.view.list'

interface ViewModeOption {
  mode: FileExplorerViewMode
  Icon: React.ComponentType<{ size?: number; className?: string }>
  labelKey: ViewLabelKey
}

const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  { mode: 'large-icon', Icon: LayoutGrid, labelKey: 'fileExplorer.view.largeIcon' },
  { mode: 'medium-icon', Icon: Grid2X2, labelKey: 'fileExplorer.view.mediumIcon' },
  { mode: 'small-icon', Icon: Grid3X3, labelKey: 'fileExplorer.view.smallIcon' },
  { mode: 'list', Icon: AlignJustify, labelKey: 'fileExplorer.view.list' }
]

const MODE_ICON_MAP: Record<FileExplorerViewMode, React.ComponentType<{ size?: number }>> = {
  'large-icon': LayoutGrid,
  'medium-icon': Grid2X2,
  'small-icon': Grid3X3,
  list: AlignJustify
}

export interface ViewModeDropdownProps {
  viewMode: FileExplorerViewMode
  onViewModeChange: (mode: FileExplorerViewMode) => void
}

export default function ViewModeDropdown({
  viewMode,
  onViewModeChange
}: ViewModeDropdownProps): React.JSX.Element {
  const { t } = useTranslation()
  const ActiveIcon = MODE_ICON_MAP[viewMode]

  return (
    <Dropdown>
      <Button isIconOnly variant="outline" size="lg" aria-label={t('fileExplorer.view.title', 'View')}>
        <ActiveIcon size={16} />
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={(key) => onViewModeChange(key as FileExplorerViewMode)}>
          {VIEW_MODE_OPTIONS.map(({ mode, Icon, labelKey }) => (
            <Dropdown.Item key={mode} id={mode} className="data-[hovered=true]:bg-accent data-[hovered=true]:text-accent-foreground">
              <Icon size={16} />
              {t(labelKey)}
              {mode === viewMode && <Check size={14} className="ml-auto" />}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  )
}
