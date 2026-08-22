import { describe, expect, it } from 'vitest'
import {
  getPresentationWorkspacePath,
  isPresentationItem,
  isPresentationMimeType,
  PPTX_MIME_TYPE
} from '../presentation-media'
import type { FileItemRecord } from '@shared/types/folder'

function makeItem(overrides: Partial<FileItemRecord> = {}): FileItemRecord {
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

describe('presentation media helpers', () => {
  it('recognizes usable PPTX items', () => {
    expect(isPresentationMimeType(PPTX_MIME_TYPE)).toBe(true)
    expect(isPresentationItem(makeItem())).toBe(true)
    expect(isPresentationItem(makeItem({ url: 'unsupported:deck-1' }))).toBe(false)
    expect(isPresentationItem(makeItem({ mimeType: 'application/pdf' }))).toBe(false)
  })

  it('builds the workspace route with encoded item id', () => {
    expect(getPresentationWorkspacePath('deck 1')).toBe('/presentations/deck%201')
  })
})
