import { Outlet } from 'react-router-dom'
import Sidebar from '@renderer/components/Sidebar'
import { useProjection } from '@renderer/hooks/useProjection'
import {
  Button,
  ModalRoot,
  ModalTrigger,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalHeader,
  ModalHeading,
  ModalBody,
  ModalFooter,
  ModalCloseTrigger,
  useOverlayState
} from '@heroui/react'
import { X } from 'lucide-react'

export default function Layout(): React.JSX.Element {
  const { isProjectionOpen, closeProjection } = useProjection()
  const state = useOverlayState()

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end p-2">
          <Button
            isIconOnly
            size="sm"
            variant="danger-soft"
            onPress={state.open}
            isDisabled={!isProjectionOpen}
            aria-label="Close projection window"
          >
            <X className="size-4" />
          </Button>
        </header>
        <main className="flex-1 p-4">
          <Outlet />
        </main>
      </div>
      <ModalRoot state={state}>
        <ModalTrigger />
        <ModalBackdrop>
          <ModalContainer>
            <ModalDialog>
              <ModalHeader>
                <ModalHeading>Close Projection</ModalHeading>
              </ModalHeader>
              <ModalBody>
                <p>Are you sure you want to close the projection window?</p>
              </ModalBody>
              <ModalFooter>
                <ModalCloseTrigger>
                  <Button variant="ghost">Cancel</Button>
                </ModalCloseTrigger>
                <Button
                  variant="danger"
                  onPress={() => {
                    closeProjection()
                    state.close()
                  }}
                >
                  Close
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </ModalRoot>
    </div>
  )
}
