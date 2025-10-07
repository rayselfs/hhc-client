export interface ShortcutItem {
  key: string
  description: string
}

export const TIMER_SHORTCUTS: ShortcutItem[] = [
  { key: 'Space', description: 'shortcuts.startPauseTimer' },
  { key: 'R', description: 'shortcuts.resetTimer' },
]

export const PROJECTION_SHORTCUTS: ShortcutItem[] = [
  { key: 'F5', description: 'shortcuts.toggleProjection' },
  { key: 'Cmd+Shift+Enter', description: 'shortcuts.toggleProjectionMac' },
  { key: 'Ctrl+Q', description: 'shortcuts.closeProjection' },
]
