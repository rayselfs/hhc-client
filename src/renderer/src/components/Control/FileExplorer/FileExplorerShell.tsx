import React from 'react'
import { useTranslation } from 'react-i18next'
import { useFileExplorerStore, useFileExplorerSettings } from '@renderer/stores/file-explorer'
import Breadcrumb from './Breadcrumb'
import ViewModeToggle from './ViewModeToggle'

export interface FileExplorerShellProps {
  children: React.ReactNode
  itemCount: number
  selectedCount: number
  headerRight?: React.ReactNode
}

export default function FileExplorerShell({
  children,
  itemCount,
  selectedCount,
  headerRight
}: FileExplorerShellProps): React.JSX.Element {
  const { t } = useTranslation()
  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const getFolderPath = useFileExplorerStore((state) => state.getFolderPath)
  const navigateToFolder = useFileExplorerStore((state) => state.navigateToFolder)
  const navigateToRoot = useFileExplorerStore((state) => state.navigateToRoot)
  const viewMode = useFileExplorerSettings((state) => state.viewMode)
  const setViewMode = useFileExplorerSettings((state) => state.setViewMode)

  const handleNavigate = (folderId: string | null): void => {
    if (folderId === null) {
      navigateToRoot()
    } else {
      void navigateToFolder(folderId)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <div className="flex-1 min-w-0">
          <Breadcrumb
            currentFolderId={currentFolderId}
            getFolderPath={getFolderPath}
            onNavigate={handleNavigate}
          />
        </div>
        <ViewModeToggle viewMode={viewMode} onViewModeChange={setViewMode} />
        {headerRight}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">{children}</div>

      <div className="flex items-center px-3 py-1.5 border-t border-border shrink-0 text-xs text-foreground/50">
        {t('fileExplorer.status.itemCount', {
          count: itemCount,
          defaultValue: `${itemCount} item(s)`
        })}
        {selectedCount > 0 && (
          <>
            <span className="mx-1">·</span>
            {t('fileExplorer.status.selectedCount', {
              count: selectedCount,
              defaultValue: `${selectedCount} selected`
            })}
          </>
        )}
      </div>
    </div>
  )
}
