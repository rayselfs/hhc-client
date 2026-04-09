import { useState } from 'react'
import { Modal, useOverlayState } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import GeneralSettings from '@renderer/components/Preferences/GeneralSettings'

interface PreferencesDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

type Category = 'general' | 'media'

export default function PreferencesDialog({
  isOpen,
  onOpenChange
}: PreferencesDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [activeCategory, setActiveCategory] = useState<Category>('general')

  const state = useOverlayState({ isOpen, onOpenChange })

  return (
    <Modal.Root state={state}>
      <Modal.Trigger />
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Body>
              <div className="flex" style={{ minHeight: '400px', maxWidth: '700px' }}>
                <div className="w-44 border-r flex flex-col">
                  <p className="text-xs font-semibold uppercase text-gray-500 px-3 pt-3 pb-2">
                    {t('preferences.title')}
                  </p>
                  <nav className="flex flex-col gap-1 px-2">
                    <button
                      className={`text-left px-3 py-2 rounded text-sm ${
                        activeCategory === 'general'
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => setActiveCategory('general')}
                      data-testid="category-general"
                    >
                      {t('preferences.categories.general')}
                    </button>
                    <button
                      className={`text-left px-3 py-2 rounded text-sm ${
                        activeCategory === 'media'
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => setActiveCategory('media')}
                      data-testid="category-media"
                    >
                      {t('preferences.categories.media')}
                    </button>
                  </nav>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                  {activeCategory === 'general' && <GeneralSettings />}
                  {activeCategory === 'media' && (
                    <p className="text-sm text-gray-500">{t('preferences.mediaPlaceholder')}</p>
                  )}
                </div>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  )
}
