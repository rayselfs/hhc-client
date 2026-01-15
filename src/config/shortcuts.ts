export const KEYBOARD_SHORTCUTS = {
  GLOBAL: {
    TOGGLE_PROJECTION: {
      key: 'F5',
      mac: { meta: true, shift: true, key: 'Enter' },
      windows: { key: 'F5' },
    },
    CLOSE_PROJECTION: {
      key: 'q',
      ctrl: true,
    },
  },
  EDIT: {
    COPY: { key: 'c', metaOrCtrl: true },
    PASTE: { key: 'v', metaOrCtrl: true },
    CUT: { key: 'x', metaOrCtrl: true },
    DELETE: {
      keys: ['Delete'], // Standard Delete
      mac: { key: 'Backspace', meta: true }, // Cmd+Backspace on Mac
    },
    SELECT_ALL: { key: 'a', metaOrCtrl: true },
  },
  MEDIA: {
    START_PRESENTATION: { key: 'F5' }, // Contextual usage
    START_PRESENTATION_FROM_BEGINNING: { key: 'F5', shift: true }, // Example
    ESCAPE: { key: 'Escape' },
    ENTER: { key: 'Enter' },
  },
  TIMER: {
    TOGGLE: { code: 'Space' },
    RESET: { code: 'KeyR' },
  },
  BIBLE: {
    PREV_VERSE: { code: 'ArrowUp' },
    NEXT_VERSE: { code: 'ArrowDown' },
    PREV_CHAPTER: { code: 'ArrowLeft' },
    NEXT_CHAPTER: { code: 'ArrowRight' },
    OPEN_BOOK_DIALOG: { code: 'KeyG' },
  },
  SELECTION: {
    MULTI_SELECT: { metaOrCtrl: true },
    RANGE_SELECT: { shift: true },
    RANGE_ADD: { shift: true, metaOrCtrl: true },
  },
  NAVIGATION: {
    MOVE_UP: { code: 'ArrowUp' },
    MOVE_DOWN: { code: 'ArrowDown' },
    MOVE_LEFT: { code: 'ArrowLeft' },
    MOVE_RIGHT: { code: 'ArrowRight' },
    SELECT_UP: { code: 'ArrowUp', shift: true },
    SELECT_DOWN: { code: 'ArrowDown', shift: true },
    SELECT_LEFT: { code: 'ArrowLeft', shift: true },
    SELECT_RIGHT: { code: 'ArrowRight', shift: true },
    TOGGLE_SELECT: { code: 'Space', metaOrCtrl: true },
    SELECT: { code: 'Space' },
    OPEN: { code: 'Enter' },
  },
} as const
