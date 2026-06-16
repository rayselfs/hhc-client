import { useState } from 'react'
import { Modal } from '@heroui/react/modal'
import { useOverlayState } from '@renderer/lib/use-overlay-state'
import { useTranslation } from 'react-i18next'
import { Settings, Film, BookOpen, Timer } from 'lucide-react'
import GeneralSettings from '@renderer/components/Control/UserMenu/GeneralSettings'
import TimerSettings from '@renderer/components/Control/UserMenu/TimerSettings'
import BibleSettingsPanel from '@renderer/components/Control/UserMenu/BibleSettingsPanel'
import MediaSettings, {
  type MediaSettingsSection
} from '@renderer/components/Control/UserMenu/MediaSettings'
import { ShortcutScope } from '@renderer/contexts/ShortcutScopeContext'

interface PreferencesDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

type Category = 'general' | 'timer' | 'bible' | 'media'
type PreferenceRoute = 'general' | 'timer' | 'bible' | `media.${MediaSettingsSection}`

interface CategoryChildItem {
  id: PreferenceRoute
  labelKey:
    | 'preferences.media.sections.general'
    | 'preferences.media.sections.oneDrive'
    | 'preferences.media.sections.video'
    | 'preferences.media.sections.storage'
}

interface CategoryItem {
  id: Category
  icon: React.ComponentType<{ className?: string }>
  labelKey:
    | 'preferences.categories.general'
    | 'preferences.categories.timer'
    | 'preferences.categories.media'
    | 'preferences.categories.bible'
  route: PreferenceRoute
  children?: CategoryChildItem[]
}

const categories: CategoryItem[] = [
  { id: 'general', icon: Settings, labelKey: 'preferences.categories.general', route: 'general' },
  { id: 'timer', icon: Timer, labelKey: 'preferences.categories.timer', route: 'timer' },
  { id: 'bible', icon: BookOpen, labelKey: 'preferences.categories.bible', route: 'bible' },
  {
    id: 'media',
    icon: Film,
    labelKey: 'preferences.categories.media',
    route: 'media.general',
    children: [
      { id: 'media.general', labelKey: 'preferences.media.sections.general' },
      { id: 'media.oneDrive', labelKey: 'preferences.media.sections.oneDrive' },
      { id: 'media.video', labelKey: 'preferences.media.sections.video' },
      { id: 'media.storage', labelKey: 'preferences.media.sections.storage' }
    ]
  }
]

export default function PreferencesDialog({
  isOpen,
  onOpenChange
}: PreferencesDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [activeRoute, setActiveRoute] = useState<PreferenceRoute>('general')

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
                        const active =
                          activeRoute === cat.route ||
                          (cat.id === 'media' && activeRoute.startsWith('media.'))
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
                              onClick={() => setActiveRoute(cat.route)}
                              data-testid={`category-${cat.id}`}
                            >
                              <Icon className="size-4" />
                              <span>{t(cat.labelKey)}</span>
                            </button>
                            {cat.children && active && (
                              <ul className="mt-1 flex flex-col gap-1 pl-7">
                                {cat.children.map((child) => {
                                  const childActive = activeRoute === child.id
                                  return (
                                    <li key={child.id}>
                                      <button
                                        type="button"
                                        aria-pressed={childActive}
                                        className={`w-full rounded-full px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                                          childActive
                                            ? 'bg-accent/15 text-foreground'
                                            : 'text-muted hover:opacity-70'
                                        }`}
                                        onClick={() => setActiveRoute(child.id)}
                                        data-testid={`category-${child.id.replace('.', '-')}`}
                                      >
                                        {t(child.labelKey)}
                                      </button>
                                    </li>
                                  )
                                })}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </nav>
                  <div className="flex-1 overflow-y-auto p-5">
                    {activeRoute === 'general' && <GeneralSettings />}
                    {activeRoute === 'timer' && <TimerSettings />}
                    {activeRoute === 'bible' && <BibleSettingsPanel />}
                    {activeRoute === 'media.general' && <MediaSettings section="general" />}
                    {activeRoute === 'media.oneDrive' && <MediaSettings section="oneDrive" />}
                    {activeRoute === 'media.video' && <MediaSettings section="video" />}
                    {activeRoute === 'media.storage' && <MediaSettings section="storage" />}
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
