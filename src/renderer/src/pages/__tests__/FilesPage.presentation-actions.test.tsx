import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextMenuEntry } from '@renderer/contexts/ContextMenuContext'
import { buildPresentationItemActions } from '../FilesPage'
import { PPTX_MIME_TYPE } from '@renderer/lib/presentation-media'
import { usePresentationWorkspaceStore } from '@renderer/stores/presentation-workspace'
import type { FileItemRecord } from '@shared/types/folder'

vi.mock('@heroui/react/toast', () => ({
  toast: {
    warning: vi.fn(),
    danger: vi.fn(),
    success: vi.fn()
  }
}))

function makeFile(overrides: Partial<FileItemRecord>): FileItemRecord {
  return {
    id: 'deck-1',
    parentId: 'file-root',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name: 'Deck.pptx',
    url: 'blob:deck-1',
    size: 100,
    mimeType: PPTX_MIME_TYPE,
    ...overrides
  }
}

function getOpenAction(actions: readonly ContextMenuEntry[]): Exclude<ContextMenuEntry, 'separator'> {
  const action = actions.find((entry) => entry !== 'separator' && entry.id === 'open-presentation')
  if (!action || action === 'separator') throw new Error('open-presentation action not found')
  return action
}

describe('FilesPage presentation context actions', () => {
  beforeEach(() => {
    usePresentationWorkspaceStore.setState({
      documents: [],
      activeItemId: null,
      activeSlideByItemId: {}
    })
  })

  it('opens a PPTX context-menu action in the presentation workspace', () => {
    const navigate = vi.fn()
    const deck = makeFile({ id: 'deck-1', name: 'Deck.pptx', mimeType: PPTX_MIME_TYPE })
    const actions = buildPresentationItemActions({
      item: deck,
      openLabel: 'Open Presentation',
      convertLabel: 'Convert Presentation',
      openIcon: React.createElement('span'),
      navigate
    })

    getOpenAction(actions).onAction?.()

    expect(usePresentationWorkspaceStore.getState().activeItemId).toBe('deck-1')
    expect(usePresentationWorkspaceStore.getState().documents[0]).toMatchObject({
      itemId: 'deck-1',
      mode: 'pptx'
    })
    expect(navigate).toHaveBeenCalledWith('/presentations/deck-1')
  })
})
