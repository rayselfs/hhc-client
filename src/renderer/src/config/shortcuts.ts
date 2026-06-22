import type { ShortcutConfig } from '@renderer/hooks/useKeyboardShortcuts'

export const SHORTCUTS = {
  PROJECTION: {
    START: { code: 'F5', mac: { code: 'Enter', meta: true, shift: true } }
  },
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
  },
  MEDIA: {
    ESCAPE: { code: 'Escape' },
    NEXT_SLIDE: { code: 'ArrowRight' },
    PREV_SLIDE: { code: 'ArrowLeft' },
    NEXT_SLIDE_ALT: { code: 'ArrowDown' },
    PREV_SLIDE_ALT: { code: 'ArrowUp' },
    FIRST_SLIDE: { code: 'Home' },
    LAST_SLIDE: { code: 'End' },
    TOGGLE_GRID: { code: 'KeyG' },
    TOGGLE_ZOOM: { code: 'KeyZ' },
    ZOOM_IN: { code: 'Equal', metaOrCtrl: true },
    ZOOM_OUT: { code: 'Minus', metaOrCtrl: true },
    VIDEO_TOGGLE_PLAY: { code: 'Space' },
    VIDEO_SEEK_FORWARD: { code: 'ArrowRight', metaOrCtrl: true },
    VIDEO_SEEK_BACKWARD: { code: 'ArrowLeft', metaOrCtrl: true },
    PDF_NEXT_PAGE: { code: 'ArrowDown', metaOrCtrl: true },
    PDF_PREV_PAGE: { code: 'ArrowUp', metaOrCtrl: true },
    PDF_TOGGLE_VIEW_MODE: { code: 'KeyV' },
    START_FROM_CURRENT: { code: 'F5', shift: true, mac: { code: 'Enter', meta: true } }
  }
} as const satisfies Record<string, Record<string, ShortcutConfig>>
