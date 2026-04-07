import { Outlet } from 'react-router-dom'
import Sidebar from '@renderer/components/Sidebar'
import { useProjection } from '@renderer/hooks/useProjection'
import {
  AlertDialogRoot,
  AlertDialogTrigger,
  AlertDialogBackdrop,
  AlertDialogContainer,
  AlertDialogDialog,
  AlertDialogHeader,
  AlertDialogHeading,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogCloseTrigger,
  Button,
  useOverlayState
} from '@heroui/react'
import { X } from 'lucide-react'

export default function Layout(): React.JSX.Element {
  const { isProjectionOpen, closeProjection } = useProjection()
  const dialogState = useOverlayState()

  const handleClose = (): void => {
    closeProjection()
    dialogState.close()
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end p-4">
          <AlertDialogRoot>
            <AlertDialogTrigger>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={dialogState.open}
                isDisabled={!isProjectionOpen}
                aria-label="Close projection window"
              >
                <X className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogBackdrop isOpen={dialogState.isOpen} onOpenChange={dialogState.setOpen}>
              <AlertDialogContainer>
                <AlertDialogDialog>
                  <AlertDialogHeader>
                    <AlertDialogHeading>Close Projection</AlertDialogHeading>
                  </AlertDialogHeader>
                  <AlertDialogBody>
                    <p>Are you sure you want to close the projection window?</p>
                  </AlertDialogBody>
                  <AlertDialogFooter>
                    <AlertDialogCloseTrigger>
                      <Button variant="secondary">Cancel</Button>
                    </AlertDialogCloseTrigger>
                    <Button variant="danger" onPress={handleClose}>
                      Close
                    </Button>
                  </AlertDialogFooter>
                </AlertDialogDialog>
              </AlertDialogContainer>
            </AlertDialogBackdrop>
          </AlertDialogRoot>
        </header>
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
