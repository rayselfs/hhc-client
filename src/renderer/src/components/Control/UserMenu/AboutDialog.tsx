import { Modal } from '@heroui/react/modal'
import { useOverlayState } from '@renderer/lib/use-overlay-state'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'
import appIcon from '@renderer/assets/icon.png'

interface AboutDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

const LICENSE_ITEMS = [
  {
    name: 'LibrePresenter',
    license: 'GPL-3.0-or-later',
    url: 'https://github.com/rayselfs/libre-presenter/blob/main/LICENSE'
  },
  {
    name: 'VLC / libVLC',
    license: 'GPL-2.0-or-later / LGPL-2.1-or-later components',
    url: 'https://www.videolan.org/legal.html'
  },
  {
    name: 'FFmpeg',
    license: 'GPL / LGPL components',
    url: 'https://ffmpeg.org/legal.html'
  },
  {
    name: 'electron-vlc-player',
    license: 'MIT',
    url: 'https://www.npmjs.com/package/electron-vlc-player'
  }
] as const

export default function AboutDialog({ isOpen, onOpenChange }: AboutDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [view, setView] = useState<'about' | 'licenses'>('about')
  const state = useOverlayState({
    isOpen,
    onOpenChange: (open) => {
      if (!open) setView('about')
      onOpenChange(open)
    }
  })

  return (
    <Modal.Root state={state}>
      <Modal.Trigger />
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog className="overflow-hidden p-0">
            <Modal.Body className="p-0">
              <ShortcutScope name="overlay">
                <div className="px-6 py-6">
                  {view === 'about' ? (
                    <>
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

                      <dl className="space-y-3 pt-5 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-muted">{t('about.version')}</dt>
                          <dd className="font-medium">v{__APP_VERSION__}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-muted">{t('about.license')}</dt>
                          <dd className="font-medium">GPL-3.0-or-later</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-muted">{t('about.openSourceLicenses')}</dt>
                          <dd>
                            <button
                              type="button"
                              className="font-medium text-primary hover:underline"
                              onClick={() => setView('licenses')}
                            >
                              {t('about.viewLicenses')}
                            </button>
                          </dd>
                        </div>
                      </dl>
                    </>
                  ) : (
                    <div>
                      <button
                        type="button"
                        className="mb-4 text-sm font-medium text-primary hover:underline"
                        onClick={() => setView('about')}
                      >
                        {t('about.back')}
                      </button>

                      <h2 className="text-xl font-semibold leading-tight">
                        {t('about.openSourceLicenses')}
                      </h2>
                      <p className="mt-1 text-sm text-muted">{t('about.licensesIntro')}</p>

                      <ul className="mt-5 divide-y divide-divider rounded-2xl border border-divider">
                        {LICENSE_ITEMS.map((item) => (
                          <li key={item.name} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="font-medium">{item.name}</h3>
                                <p className="mt-1 text-xs text-muted">{item.license}</p>
                              </div>
                              <a
                                className="shrink-0 text-sm font-medium text-primary hover:underline"
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {t('about.source')}
                              </a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </ShortcutScope>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  )
}
