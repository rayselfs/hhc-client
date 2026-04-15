import { Modal } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import i18n from '@renderer/i18n'
import { SHORTCUTS } from '@renderer/config/shortcuts'
import { isElectron } from '@renderer/lib/env'

interface KeyboardShortcutsDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

const KEY_DISPLAY_MAP: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Space: 'Space',
  Escape: 'Esc',
  Backspace: '⌫',
  Delete: 'Del',
  Enter: 'Enter',
  Tab: 'Tab',
  Shift: 'Shift',
  Control: 'Ctrl',
  Alt: 'Alt',
  Meta: '⌘'
}

const getDisplayKey = (code: string): string => {
  if (KEY_DISPLAY_MAP[code]) {
    return KEY_DISPLAY_MAP[code]
  }
  if (code.startsWith('Key')) {
    return code.slice(3).toUpperCase()
  }
  return code
}

const getMetaDisplay = (): string => {
  if (isElectron()) {
    const ua = navigator.userAgent
    return ua.includes('Mac') ? '⌘' : 'Ctrl'
  }
  return /mac/i.test(navigator.userAgent) ? '⌘' : 'Ctrl'
}

interface ShortcutEntry {
  label: string
  keys: string[]
}

export default function KeyboardShortcutsDialog({
  isOpen,
  onOpenChange
}: KeyboardShortcutsDialogProps): React.JSX.Element {
  useTranslation()

  const tDynamic = i18n.t.bind(i18n) as (key: string) => string

  const renderShortcutRow = (label: string, keys: string[]): React.JSX.Element => (
    <div className="flex justify-between items-center py-2 px-3 hover:bg-default-100 rounded-lg transition-colors">
      <span className="text-sm text-default-700">{label}</span>
      <div className="flex gap-1">
        {keys.map((key) => (
          <kbd
            key={key}
            className="px-2 py-1 text-xs font-semibold text-default-700 bg-default-200 border border-default-300 rounded"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  )

  const renderSection = (
    sectionKey: string,
    shortcuts: Record<string, { code: string; metaOrCtrl?: boolean }>
  ): React.JSX.Element => {
    const entries: ShortcutEntry[] = Object.entries(shortcuts).map(([key, config]) => {
      const keyParts: string[] = []
      if (config.metaOrCtrl) {
        keyParts.push(getMetaDisplay())
      }
      keyParts.push(getDisplayKey(config.code))
      const entryKey = key.toLowerCase()
      return {
        label: tDynamic(`shortcuts.${sectionKey}.${entryKey}`),
        keys: keyParts
      }
    })

    const sectionTitleKey = `shortcuts.sections.${sectionKey.toLowerCase()}`

    return (
      <div key={sectionKey} className="mb-6">
        <h3 className="text-sm font-semibold text-default-900 mb-3">{tDynamic(sectionTitleKey)}</h3>
        <div className="space-y-1">
          {entries.map((entry) => (
            <div key={entry.label}>{renderShortcutRow(entry.label, entry.keys)}</div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop />
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.Header>
            <h3 className="text-lg font-semibold">{tDynamic('shortcuts.title')}</h3>
          </Modal.Header>
          <Modal.Body className="gap-4 max-h-96 overflow-y-auto">
            {renderSection('BIBLE', SHORTCUTS.BIBLE)}
            {renderSection('TIMER', SHORTCUTS.TIMER)}
            {renderSection('EDIT', SHORTCUTS.EDIT)}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  )
}
