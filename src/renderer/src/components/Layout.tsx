import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Sidebar from '@renderer/components/Sidebar'
import Header from '@renderer/components/Header'
import FloatingTimer from '@renderer/components/FloatingTimer'
import ConfirmDialog from '@renderer/components/ConfirmDialog'
import TimerProjectionBridge from '@renderer/components/TimerProjectionBridge'
import { ProjectionProvider, useProjection } from '@renderer/contexts/ProjectionContext'
import { TimerEngineProvider } from '@renderer/contexts/TimerEngineContext'
import { ContextMenuProvider } from '@renderer/contexts/ContextMenuContext'
import { ConfirmDialogProvider, useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { isWeb } from '@renderer/lib/env'
import { toast } from '@heroui/react'
import { useBibleStore } from '@renderer/stores/bible'
import { useBibleSettingsStore } from '@renderer/stores/bible-settings'
import { initializeSearchIndexes } from '@renderer/lib/bible-search-singleton'
function ProjectionAutoOpen(): null {
  const { t } = useTranslation()
  const { isProjectionOpen, openProjection } = useProjection()
  const confirm = useConfirm()

  useEffect(() => {
    if (!isWeb() || isProjectionOpen) return

    confirm({
      status: 'info',
      title: t('projection.openTitle'),
      description: t('projection.openMessage'),
      confirmLabel: t('projection.open'),
      cancelLabel: t('common.cancel')
    }).then((confirmed) => {
      if (!confirmed) return
      openProjection().catch(() => {
        toast.danger(t('toast.projectionOpenFailed'))
      })
    })
  }, [confirm, isProjectionOpen, openProjection, t])

  return null
}

export default function Layout(): React.JSX.Element {
  useEffect(() => {
    const tryInitSearch = (state: ReturnType<typeof useBibleStore.getState>): void => {
      if (!state.isInitialized || state.versions.length === 0) return
      const selectedVersionId =
        useBibleSettingsStore.getState().selectedVersionId || state.versions[0].id
      initializeSearchIndexes(state.content, state.versions, selectedVersionId)
    }

    const unsubscribe = useBibleStore.subscribe((state, prev) => {
      if (!prev.isInitialized && state.isInitialized) {
        tryInitSearch(state)
      }
    })

    const current = useBibleStore.getState()
    if (current.isInitialized) {
      tryInitSearch(current)
    } else {
      useBibleStore.getState().initialize()
    }

    return unsubscribe
  }, [])

  return (
    <TimerEngineProvider>
      <ProjectionProvider>
        <ContextMenuProvider>
          <ConfirmDialogProvider>
            <div className="flex h-screen overflow-hidden bg-background text-foreground">
              <Sidebar />
              <div className="flex flex-1 flex-col min-h-0">
                <Header />
                <main className="flex-1 overflow-y-auto py-4 px-3">
                  <Outlet />
                </main>
              </div>
              <FloatingTimer />
            </div>
            <ConfirmDialog />
            <TimerProjectionBridge />
            <ProjectionAutoOpen />
          </ConfirmDialogProvider>
        </ContextMenuProvider>
      </ProjectionProvider>
    </TimerEngineProvider>
  )
}
