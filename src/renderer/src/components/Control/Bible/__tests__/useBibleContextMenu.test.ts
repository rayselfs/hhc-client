import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MouseEvent } from 'react'
import type { ContextMenuEntry } from '@renderer/contexts/ContextMenuContext'
import { useBibleContextMenu } from '../useBibleContextMenu'

const mocks = vi.hoisted(() => ({ showMenu: vi.fn() }))

vi.mock('@renderer/contexts/ContextMenuContext', () => ({
  useContextMenu: () => ({ showMenu: mocks.showMenu })
}))

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'zh-TW' }
  })
}))

describe('useBibleContextMenu', () => {
  beforeEach(() => mocks.showMenu.mockReset())

  it('does not expose add-to-service from Bible menus', () => {
    const { result } = renderHook(() => useBibleContextMenu())
    const event = {} as MouseEvent
    const verse = { bookNumber: 1, chapter: 1, verse: 1, text: '起初' }
    const item = {
      ...verse,
      id: 'verse-1',
      type: 'verse' as const,
      parentId: 'folder-1',
      versionId: 1,
      sortIndex: 0,
      createdAt: 1,
      expiresAt: null
    }

    result.current.showPreviewMenu(verse, event)
    result.current.showHistoryMenu(item, event)
    result.current.showFolderItemMenu(item, 'folder-1', event)

    for (const [entries] of mocks.showMenu.mock.calls as [ContextMenuEntry[]][]) {
      expect(entries).not.toContainEqual(expect.objectContaining({ id: 'add-to-service' }))
    }
  })
})
