import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useProjection } from '@renderer/contexts/ProjectionContext'
import { useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { ButtonGroup } from '@heroui/react/button-group'
import { Button } from '@heroui/react/button'
import { toast } from '@heroui/react/toast'
import { X, Monitor, MonitorOff, ExternalLink } from 'lucide-react'
import ModeSelector from '@renderer/components/Control/Timer/ModeSelector'
import SettingsPopover from '@renderer/components/Control/Header/SettingsPopover/SettingsPopover'
import BibleSelector from '@renderer/components/Control/Bible/BibleSelector'
import SearchBarToggle from '@renderer/components/Control/Header/SearchBar/SearchBarToggle'
import Breadcrumb from '@renderer/components/Control/FileExplorer/Breadcrumb'
import ViewModeDropdown from '@renderer/components/Control/FileExplorer/ViewModeDropdown'
import SortDropdown from '@renderer/components/Control/FileExplorer/SortDropdown'
import { isTimerRoute, isBibleRoute, isFilesRoute } from '@renderer/lib/routes'
import { EVENTS } from '@renderer/config/events'
import { useTimerStore } from '@renderer/stores/timer'
import { useFileExplorerStore, useFileExplorerSettings } from '@renderer/stores/file-explorer'

export default function Header(): React.JSX.Element {
  const { t } = useTranslation()
  const location = useLocation()
  const {
    isProjectionOpen,
    isProjectionBlanked,
    openProjection,
    closeProjection,
    blankProjection
  } = useProjection()
  const confirm = useConfirm()
  const mode = useTimerStore((s) => s.mode)

  const currentFolderId = useFileExplorerStore((state) => state.currentFolderId)
  const getFolderPath = useFileExplorerStore((state) => state.getFolderPath)
  const navigateToFolder = useFileExplorerStore((state) => state.navigateToFolder)
  const navigateToRoot = useFileExplorerStore((state) => state.navigateToRoot)
  const viewMode = useFileExplorerSettings((state) => state.viewMode)
  const setViewMode = useFileExplorerSettings((state) => state.setViewMode)
  const sortField = useFileExplorerSettings((state) => state.sortField)
  const sortDir = useFileExplorerSettings((state) => state.sortDir)
  const setSortFieldAndDir = useFileExplorerSettings((state) => state.setSortFieldAndDir)

  const showTimerControls = isTimerRoute(location.pathname)
  const showBibleControls = isBibleRoute(location.pathname)
  const showFilesControls = isFilesRoute(location.pathname)

  const handleCloseOrOpenProjection = async (): Promise<void> => {
    if (!isProjectionOpen) {
      await openProjection().catch(() => {
        toast.danger(t('toast.projectionOpenFailed'))
      })
      return
    }
    const confirmed = await confirm({
      status: 'warning',
      title: t('projection.closeTitle'),
      description: t('projection.closeConfirm'),
      confirmLabel: t('common.close'),
      cancelLabel: t('common.cancel')
    })
    if (!confirmed) return
    await closeProjection().catch(() => {
      toast.danger(t('toast.projectionCloseFailed'))
    })
  }

  const handleOpenBibleSelector = (): void => {
    window.dispatchEvent(new Event(EVENTS.OPEN_BIBLE_SELECTOR))
  }

  const handleBreadcrumbNavigate = (folderId: string | null): void => {
    if (folderId === null) {
      navigateToRoot()
    } else {
      void navigateToFolder(folderId)
    }
  }

  return (
    <header className="relative flex items-center justify-end gap-2 p-2">
      {(showTimerControls || showBibleControls) && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <SettingsPopover
            variant={showBibleControls ? 'bible' : mode === 'stopwatch' ? 'stopwatch' : 'timer'}
          />
          <div
            className={`lg:hidden transition-all duration-200 ${showBibleControls ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-3 pointer-events-none'}`}
          >
            <BibleSelector onOpenDialog={handleOpenBibleSelector} />
          </div>
        </div>
      )}

      {showFilesControls && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-2 max-w-[50%]">
          <ButtonGroup size="lg">
            <ViewModeDropdown viewMode={viewMode} onViewModeChange={setViewMode} />
            <SortDropdown sortField={sortField} sortDir={sortDir} onSortChange={setSortFieldAndDir} />
          </ButtonGroup>
          <Breadcrumb
            currentFolderId={currentFolderId}
            getFolderPath={getFolderPath}
            onNavigate={handleBreadcrumbNavigate}
          />
        </div>
      )}

      <div
        className={`absolute inset-0 flex items-center lg:justify-center max-lg:justify-start max-lg:pl-14 pointer-events-none transition-all duration-200 ${showTimerControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'}`}
      >
        <div className={showTimerControls ? 'pointer-events-auto' : undefined}>
          <ModeSelector />
        </div>
      </div>

      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-200 ${showBibleControls ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'}`}
      >
        <div className={`max-lg:hidden ${showBibleControls ? 'pointer-events-auto' : ''}`}>
          <div data-testid="bible-header-controls">
            <BibleSelector onOpenDialog={handleOpenBibleSelector} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(showBibleControls || showFilesControls) && (
          <SearchBarToggle variant={showBibleControls ? 'bible' : 'fileExplorer'} />
        )}
        <ButtonGroup size="lg">
          <Button
            isIconOnly
            variant="outline"
            className={isProjectionBlanked ? 'text-default-foreground px-6' : 'text-danger px-6'}
            onPress={() => blankProjection(!isProjectionBlanked)}
            isDisabled={!isProjectionOpen}
            aria-label={t(isProjectionBlanked ? 'projection.showButton' : 'projection.blankButton')}
          >
            {isProjectionBlanked ? (
              <Monitor className="size-4" />
            ) : (
              <MonitorOff className="size-4" />
            )}
          </Button>
          <Button
            isIconOnly
            variant="outline"
            className={isProjectionOpen ? 'text-danger px-6' : 'text-default-foreground px-6'}
            onPress={handleCloseOrOpenProjection}
            aria-label={t(isProjectionOpen ? 'projection.closeButton' : 'projection.openButton')}
          >
            {isProjectionOpen ? <X className="size-4" /> : <ExternalLink className="size-4" />}
            <ButtonGroup.Separator className="text-default-foreground" />
          </Button>
        </ButtonGroup>
      </div>
    </header>
  )
}
