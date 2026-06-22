import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AppLoadingScreen from '@renderer/components/Control/AppLoadingScreen'
import Sidebar from '@renderer/components/Control/Sidebar'
import Header from '@renderer/components/Control/Header/Header'
import FloatingTimer from '@renderer/components/Control/Timer/FloatingTimer'
import ConfirmDialog from '@renderer/components/Common/ConfirmDialog'
import TimerProjectionBridge from '@renderer/components/Control/Bridge/TimerProjectionBridge'
import MediaPresenter from '@renderer/components/Control/FileExplorer/Presenter/MediaPresenter'
import { ProjectionProvider } from '@renderer/contexts/ProjectionContext'
import { TimerEngineProvider } from '@renderer/contexts/TimerEngineContext'
import { ContextMenuProvider } from '@renderer/contexts/ContextMenuContext'
import { ConfirmDialogProvider } from '@renderer/contexts/ConfirmDialogContext'
import { ShortcutScopeProvider } from '@renderer/contexts/ShortcutScopeContext'
import { AppInitContext } from '@renderer/contexts/AppInitContext'
import { initializeApp } from '@renderer/lib/app-init'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import { useBibleFolderStore } from '@renderer/stores/folder'
import { useMediaProjectionStore } from '@renderer/stores/media-projection'
import { useAutoUpdateCheck } from '@renderer/hooks/useAutoUpdateCheck'

export default function Layout(): React.JSX.Element {
  const [initialized, setInitialized] = useState(false)
  const isPresentingMedia = useMediaProjectionStore((state) => state.isPresenting)
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
                <div className="flex h-screen overflow-hidden bg-background text-foreground">
                  <Sidebar />
                  <div className="flex flex-1 flex-col min-h-0">
                    <Header />
                    <main className="flex-1 overflow-y-auto py-4 px-3">
                      <Outlet />
                    </main>
                  </div>
                  <FloatingTimer />
                  {isPresentingMedia && <MediaPresenter />}
                </div>
                <ConfirmDialog />
                <TimerProjectionBridge />
              </ConfirmDialogProvider>
            </ContextMenuProvider>
          </ProjectionProvider>
        </TimerEngineProvider>
      </ShortcutScopeProvider>
    </AppInitContext.Provider>
  )
}
