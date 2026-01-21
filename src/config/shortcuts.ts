export const KEYBOARD_SHORTCUTS = {
  GLOBAL: {
    TOGGLE_PROJECTION: {
      mac: { code: 'Enter', meta: true },
      windows: { code: 'F5' },
    },
    CLOSE_PROJECTION: {
      code: 'KeyQ',
      ctrl: true,
    },
  },
  EDIT: {
    COPY: { key: 'c', metaOrCtrl: true },
    PASTE: { key: 'v', metaOrCtrl: true },
    CUT: { key: 'x', metaOrCtrl: true },
    DELETE: {
      keys: ['Delete'],
      mac: { key: 'Backspace', meta: true },
    },
    SELECT_ALL: { key: 'a', metaOrCtrl: true },
  },
  MEDIA: {
    START_PRESENTATION: {
      mac: { code: 'Enter', meta: true },
      windows: { code: 'F5' },
    },
    START_PRESENTATION_FROM_BEGINNING: {
      mac: { code: 'Enter', meta: true, shift: true },
      windows: { code: 'F5', shift: true },
    },
    ESCAPE: { code: 'Escape' },
    NEXT_SLIDE: { codes: ['ArrowRight', 'ArrowDown', 'PageDown', 'Enter', 'KeyN'] },
    PREV_SLIDE: { codes: ['ArrowLeft', 'ArrowUp', 'PageUp', 'KeyP'] },
    FIRST_SLIDE: { code: 'Home' },
    LAST_SLIDE: { code: 'End' },
    TOGGLE_GRID: { code: 'KeyG' },
    TOGGLE_ZOOM: { code: 'KeyZ' },
    ZOOM_IN: { codes: ['Equal', 'NumpadAdd'] },
    ZOOM_OUT: { codes: ['Minus', 'NumpadSubtract'] },
    VIDEO_TOGGLE_PLAY: { code: 'Space' },
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
    TOGGLE_BOOK_DIALOG: { code: 'KeyG' },
    CLOSE_DIALOG: { code: 'Escape' },
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
