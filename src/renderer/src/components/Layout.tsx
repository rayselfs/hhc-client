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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

export default function Layout(): React.JSX.Element {
  return (
    <TimerEngineProvider>
      <ProjectionProvider>
        <ContextMenuProvider>
          <ConfirmDialogProvider>
            <div className="flex h-screen overflow-hidden bg-background text-foreground">
              <Sidebar />
              <div className="flex flex-1 flex-col min-h-0">
                <Header />
                <main className="flex-1 overflow-auto py-4 px-6 min-w-[600px]">
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
