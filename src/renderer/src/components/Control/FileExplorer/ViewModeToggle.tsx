import React from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, Grid2X2, Grid3X3, AlignJustify } from 'lucide-react'
import type { FileExplorerViewMode } from '@shared/types/folder'

export interface ViewModeToggleProps {
  viewMode: FileExplorerViewMode
  onViewModeChange: (mode: FileExplorerViewMode) => void
}

type ViewLabelKey =
  | 'fileExplorer.view.largeIcon'
  | 'fileExplorer.view.mediumIcon'
  | 'fileExplorer.view.smallIcon'
  | 'fileExplorer.view.list'

interface ViewModeOption {
  mode: FileExplorerViewMode
  icon: React.ReactNode
  labelKey: ViewLabelKey
}

const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  { mode: 'large-icon', icon: <LayoutGrid size={14} />, labelKey: 'fileExplorer.view.largeIcon' },
  { mode: 'medium-icon', icon: <Grid2X2 size={14} />, labelKey: 'fileExplorer.view.mediumIcon' },
  { mode: 'small-icon', icon: <Grid3X3 size={14} />, labelKey: 'fileExplorer.view.smallIcon' },
  { mode: 'list', icon: <AlignJustify size={14} />, labelKey: 'fileExplorer.view.list' }
]

export default function ViewModeToggle({
  viewMode,
  onViewModeChange
}: ViewModeToggleProps): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5" role="group">
      {VIEW_MODE_OPTIONS.map(({ mode, icon, labelKey }) => {
        const isActive = viewMode === mode
        return (
          <button
            key={mode}
            type="button"
            title={t(labelKey)}
            aria-label={t(labelKey)}
            aria-pressed={isActive}
            onClick={() => onViewModeChange(mode)}
            className={[
              'flex items-center justify-center w-6 h-6 rounded transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground/60 hover:text-foreground hover:bg-default/60'
            ].join(' ')}
          >
            {icon}
          </button>
        )
      })}
    </div>
  )
}
