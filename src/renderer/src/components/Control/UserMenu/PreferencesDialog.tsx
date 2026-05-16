import { useState } from 'react'
import { Modal } from '@heroui/react/modal'
import { useOverlayState } from '@renderer/lib/use-overlay-state'
import { useTranslation } from 'react-i18next'
import { Settings, Film, BookOpen } from 'lucide-react'
import GeneralSettings from '@renderer/components/Control/UserMenu/GeneralSettings'
import BibleSettingsPanel from '@renderer/components/Control/UserMenu/BibleSettingsPanel'
import MediaSettings from '@renderer/components/Control/UserMenu/MediaSettings'
import { ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'

interface PreferencesDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

type Category = 'general' | 'media' | 'bible'

interface CategoryItem {
  id: Category
  icon: React.ComponentType<{ className?: string }>
  labelKey:
    | 'preferences.categories.general'
    | 'preferences.categories.media'
    | 'preferences.categories.bible'
}

const categories: CategoryItem[] = [
  { id: 'general', icon: Settings, labelKey: 'preferences.categories.general' },
  { id: 'bible', icon: BookOpen, labelKey: 'preferences.categories.bible' },
  { id: 'media', icon: Film, labelKey: 'preferences.categories.media' }
]

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
        <Modal.Container size="lg">
          <Modal.Dialog className="overflow-hidden p-0">
            <Modal.Body className="p-0">
              <ShortcutScope name="overlay">
                <div className="flex" style={{ height: '480px' }}>
                  <nav className="flex w-44 shrink-0 flex-col gap-2 rounded-tr-3xl rounded-br-3xl bg-surface-secondary text-foreground py-2 px-2">
                    <ul className="flex flex-col gap-1">
                      {categories.map((cat) => {
                        const active = activeCategory === cat.id
                        const Icon = cat.icon
                        return (
                          <li key={cat.id}>
                            <button
                              type="button"
                              aria-pressed={active}
                              className={`flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                                active
                                  ? 'bg-accent text-accent-foreground'
                                  : 'text-muted hover:opacity-70'
                              }`}
                              onClick={() => setActiveCategory(cat.id)}
                              data-testid={`category-${cat.id}`}
                            >
                              <Icon className="size-4" />
                              <span>{t(cat.labelKey)}</span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </nav>
                  <div className="flex-1 overflow-y-auto p-5">
                    {activeCategory === 'general' && <GeneralSettings />}
                    {activeCategory === 'bible' && <BibleSettingsPanel />}
                    {activeCategory === 'media' && <MediaSettings />}
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
