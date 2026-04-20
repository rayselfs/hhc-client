import type { ShortcutConfig } from '@renderer/hooks/useKeyboardShortcuts'

export const SHORTCUTS = {
  BIBLE: {
    PREV_VERSE: { code: 'ArrowUp' },
    NEXT_VERSE: { code: 'ArrowDown' },
    NEXT_VERSE_ALT: { code: 'Space' },
    PREV_CHAPTER: { code: 'ArrowLeft', metaOrCtrl: true },
    NEXT_CHAPTER: { code: 'ArrowRight', metaOrCtrl: true },
    OPEN_SELECTOR: { code: 'KeyG' },
    FOCUS_SEARCH: { code: 'KeyF', metaOrCtrl: true },
    CLOSE_DIALOG: { code: 'Escape' }
  },
  TIMER: {
    TOGGLE: { code: 'Space' },
    RESET: { code: 'KeyR' }
  },
  EDIT: {
    COPY: { code: 'KeyC', metaOrCtrl: true },
    CUT: { code: 'KeyX', metaOrCtrl: true },
    PASTE: { code: 'KeyV', metaOrCtrl: true },
    SELECT_ALL: { code: 'KeyA', metaOrCtrl: true },
    DELETE: { code: 'Backspace', mac: { code: 'Backspace', meta: true } },
    DELETE_ALT: { code: 'Delete' },
    ESCAPE: { code: 'Escape' }
  }
} as const satisfies Record<string, Record<string, ShortcutConfig>>
