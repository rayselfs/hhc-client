import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AppLoadingScreen from '@renderer/components/Control/AppLoadingScreen'
import Sidebar from '@renderer/components/Control/Sidebar'
import Header from '@renderer/components/Control/Header/Header'
import PresentationCloseDecisionDialog from '@renderer/components/Control/Header/PresentationCloseDecisionDialog'
import PresentationWorkspaceHeader from '@renderer/components/Control/Header/PresentationWorkspaceHeader'
import PresentationNavigationGuard from '@renderer/components/Control/PresentationNavigationGuard'
import ProjectionRecoveryNotice from '@renderer/components/Control/ProjectionRecoveryNotice'
import FloatingTimer from '@renderer/components/Control/Timer/FloatingTimer'
import ConfirmDialog from '@renderer/components/Common/ConfirmDialog'
import TimerProjectionBridge from '@renderer/components/Control/Bridge/TimerProjectionBridge'
import MediaProjectionBridge from '@renderer/components/Control/Bridge/MediaProjectionBridge'
import BackgroundTaskTray from '@renderer/components/Control/BackgroundTaskTray'
import { ProjectionProvider } from '@renderer/contexts/ProjectionContext'
import { TimerEngineProvider } from '@renderer/contexts/TimerEngineContext'
import { ContextMenuProvider } from '@renderer/contexts/ContextMenuContext'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import { PresentationCloseDecisionProvider } from '@renderer/contexts/PresentationCloseDecisionContext'
import PresentationElectronCloseBridge from '@renderer/contexts/PresentationElectronCloseBridge'
import { PresentationSessionRegistryProvider } from '@renderer/contexts/PresentationSessionRegistryContext'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'
import LanRemoteBridge from '@renderer/contexts/LanRemoteBridge'
import { AppInitContext } from '@renderer/contexts/AppInitContext'
import { initializeApp } from '@renderer/lib/app-init'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useAutoUpdateCheck } from '@renderer/hooks/useAutoUpdateCheck'

export default function Layout(): React.JSX.Element {
  const [initialized, setInitialized] = useState(false)
  const location = useLocation()
  const isPresentationWorkspace = location.pathname.startsWith('/presentations')
  const isMediaWorkspace = location.pathname === '/media'
  useAutoUpdateCheck()

  useEffect(() => {
    const cleanup = initializeApp()

    const isCoreReady = (): boolean =>
      useFileExplorerStore.getState().isInitialized && useBibleFolderStore.getState().isInitialized

    let cancelled = false
    const setReady = (): void => {
      if (!cancelled) setInitialized(true)
    }
    const trySetReady = (): void => {
      if (cancelled || !isCoreReady()) return
      setReady()
    }

    const timerId = setTimeout(trySetReady, 0)
    const unsub = useFileExplorerStore.subscribe(trySetReady)
    const unsub2 = useBibleFolderStore.subscribe(trySetReady)
    return () => {
      cancelled = true
      clearTimeout(timerId)
      cleanup()
      unsub()
      unsub2()
    }
  }, [])

  if (!initialized) return <AppLoadingScreen />

  return (
    <AppInitContext.Provider value={initialized}>
      <ShortcutScopeProvider>
        <TimerEngineProvider>
          <ProjectionProvider>
            <ContextMenuProvider>
              <ConfirmDialogProvider>
                <PresentationSessionRegistryProvider>
                  <PresentationCloseDecisionProvider>
                    <div className="flex h-screen overflow-hidden bg-background text-foreground">
                      <Sidebar />
                      <div className="flex flex-1 flex-col min-h-0">
                        {isPresentationWorkspace ? (
                          <PresentationWorkspaceHeader />
                        ) : isMediaWorkspace ? null : (
                          <Header />
                        )}
                        <main
                          className={
                            isPresentationWorkspace || isMediaWorkspace
                              ? 'flex-1 overflow-hidden'
                              : 'flex-1 overflow-y-auto py-4 px-3'
                          }
                        >
                          <Outlet />
                        </main>
                      </div>
                      <FloatingTimer />
                    </div>
                    <ConfirmDialog />
                    <PresentationCloseDecisionDialog />
                    <PresentationNavigationGuard />
                    <PresentationElectronCloseBridge />
                    <TimerProjectionBridge />
                    <MediaProjectionBridge />
                    <LanRemoteBridge />
                    <ProjectionRecoveryNotice />
                    <BackgroundTaskTray />
                  </PresentationCloseDecisionProvider>
                </PresentationSessionRegistryProvider>
              </ConfirmDialogProvider>
            </ContextMenuProvider>
          </ProjectionProvider>
        </TimerEngineProvider>
      </ShortcutScopeProvider>
    </AppInitContext.Provider>
  )
}
