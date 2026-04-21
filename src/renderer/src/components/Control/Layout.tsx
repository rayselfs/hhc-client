import { Outlet } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Sidebar from '@renderer/components/Control/Sidebar'
import Header from '@renderer/components/Control/Header/Header'
import FloatingTimer from '@renderer/components/Control/Timer/FloatingTimer'
import ConfirmDialog from '@renderer/components/Common/ConfirmDialog'
import TimerProjectionBridge from '@renderer/components/Control/Bridge/TimerProjectionBridge'
import { ProjectionProvider, useProjection } from '@renderer/contexts/ProjectionContext'
import { TimerEngineProvider } from '@renderer/contexts/TimerEngineContext'
import { ContextMenuProvider } from '@renderer/contexts/ContextMenuContext'
import { ConfirmDialogProvider, useConfirm } from '@renderer/contexts/ConfirmDialogContext'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'
import { isWeb } from '@renderer/lib/env'
import { toast } from '@heroui/react'
import { initializeApp } from '@renderer/lib/app-init'
function ProjectionAutoOpen(): null {
  const { t } = useTranslation()
  const { isProjectionOpen, openProjection } = useProjection()
  const confirm = useConfirm()
  const hasPrompted = useRef(false)

  useEffect(() => {
    if (!isWeb() || isProjectionOpen || hasPrompted.current) return
    hasPrompted.current = true

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
    return initializeApp()
  }, [])

  return (
    <ShortcutScopeProvider>
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
    </ShortcutScopeProvider>
  )
}
