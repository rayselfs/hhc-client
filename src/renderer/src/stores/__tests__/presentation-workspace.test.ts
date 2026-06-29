import { beforeEach, describe, expect, it } from 'vitest'
import { usePresentationWorkspaceStore } from '../presentation-workspace'
import type { FileItemRecord } from '@shared/types/folder'

function makePresentationItem(id: string, name: string): FileItemRecord {
  return {
    id,
    parentId: 'file-root',
    type: 'file',
    sortIndex: 0,
    createdAt: 1,
    expiresAt: null,
    name,
    url: `blob:${id}`,
    size: 1024,
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }
}

describe('presentation workspace store', () => {
  beforeEach(() => {
    usePresentationWorkspaceStore.setState({
      documents: [],
      activeItemId: null,
      activeSlideByItemId: {}
    })
  })

  it('opens multiple presentations and keeps active slide per document', () => {
    const first = makePresentationItem('pptx-1', 'Sunday.pptx')
    const second = makePresentationItem('pptx-2', 'Sermon.pptx')

    usePresentationWorkspaceStore.getState().openDocument(first)
    usePresentationWorkspaceStore.getState().setActiveSlide(first.id, 3)
    usePresentationWorkspaceStore.getState().openDocument(second)
    usePresentationWorkspaceStore.getState().setSlideCount(second.id, 8)

    expect(usePresentationWorkspaceStore.getState().documents.map((doc) => doc.itemId)).toEqual([
      'pptx-1',
      'pptx-2'
    ])
    expect(usePresentationWorkspaceStore.getState().activeItemId).toBe('pptx-2')
    expect(usePresentationWorkspaceStore.getState().getActiveSlide(first.id)).toBe(3)
    expect(usePresentationWorkspaceStore.getState().getActiveSlide(second.id)).toBe(0)
    expect(usePresentationWorkspaceStore.getState().documents[1].slideCount).toBe(8)
  })

  it('activates the nearest remaining tab when closing the active presentation', () => {
    const first = makePresentationItem('pptx-1', 'Sunday.pptx')
    const second = makePresentationItem('pptx-2', 'Sermon.pptx')
    const third = makePresentationItem('pptx-3', 'Prayer.pptx')

    usePresentationWorkspaceStore.getState().openDocument(first)
    usePresentationWorkspaceStore.getState().openDocument(second)
    usePresentationWorkspaceStore.getState().openDocument(third)

    usePresentationWorkspaceStore.getState().closeDocument(third.id)

    expect(usePresentationWorkspaceStore.getState().activeItemId).toBe(second.id)
    expect(usePresentationWorkspaceStore.getState().documents.map((doc) => doc.itemId)).toEqual([
      first.id,
      second.id
    ])
  })
})
