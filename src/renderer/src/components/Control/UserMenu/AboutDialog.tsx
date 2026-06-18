import { Modal } from '@heroui/react/modal'
import { useOverlayState } from '@renderer/lib/use-overlay-state'
import { useTranslation } from 'react-i18next'
import { ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'
import appIcon from '@renderer/assets/icon.png'

interface AboutDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export default function AboutDialog({ isOpen, onOpenChange }: AboutDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const state = useOverlayState({ isOpen, onOpenChange })

  return (
    <Modal.Root state={state}>
      <Modal.Trigger />
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog className="overflow-hidden p-0">
            <Modal.Body className="p-0">
              <ShortcutScope name="overlay">
                <div className="flex items-center gap-5 py-8 px-6">
                  <img
                    src={appIcon}
                    alt="LibrePresenter"
                    className="size-16 shrink-0 rounded-2xl"
                  />
                  <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-semibold">LibrePresenter</h2>
                    <span className="text-sm text-muted">v{__APP_VERSION__}</span>
                    <span className="text-xs text-muted">GPL-3.0-or-later</span>
                    <span className="text-xs text-muted">
                      Open source notices: bundled THIRD_PARTY_NOTICES.md ·{' '}
                      <a
                        className="text-primary hover:underline"
                        href="https://github.com/rayselfs/libre-presenter/blob/main/THIRD_PARTY_NOTICES.md"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View online
                      </a>
                    </span>
                    <p className="text-sm text-muted mt-1">{t('about.description')}</p>
                  </div>
                </div>
              </ShortcutScope>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  )
}
