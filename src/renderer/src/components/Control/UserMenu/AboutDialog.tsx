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
                <div className="px-6 py-6">
                  <div className="flex items-start gap-4 border-b border-divider pb-5">
                    <img
                      src={appIcon}
                      alt="LibrePresenter"
                      className="size-16 shrink-0 rounded-2xl"
                    />
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold leading-tight">LibrePresenter</h2>
                      <p className="mt-1 text-sm text-muted">{t('about.tagline')}</p>
                    </div>
                  </div>

                  <dl className="space-y-3 py-5 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted">{t('about.version')}</dt>
                      <dd className="font-medium">v{__APP_VERSION__}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted">{t('about.license')}</dt>
                      <dd className="font-medium">GPL-3.0-or-later</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-muted">{t('about.openSourceNotices')}</dt>
                      <dd>
                        <a
                          className="font-medium text-primary hover:underline"
                          href="https://github.com/rayselfs/libre-presenter/blob/main/THIRD_PARTY_NOTICES.md"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('about.viewOnline')}
                        </a>
                      </dd>
                    </div>
                  </dl>

                  <p className="rounded-2xl bg-content2/60 px-4 py-3 text-xs leading-relaxed text-muted">
                    {t('about.noticesDescription')}
                  </p>
                </div>
              </ShortcutScope>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  )
}
