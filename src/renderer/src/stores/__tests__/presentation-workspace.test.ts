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

function makeEditablePresentationItem(id: string, name: string): FileItemRecord {
  return {
    ...makePresentationItem(id, name),
    mimeType: 'application/vnd.librepresenter.presentation+json'
  }
}

describe('presentation workspace store', () => {
  beforeEach(() => {
    usePresentationWorkspaceStore.setState({
      documents: [],
      activeItemId: null,
      activeSlideIdByItemId: {}
    })
  })

  it('opens multiple presentations and keeps active slide per document', () => {
    const first = makePresentationItem('pptx-1', 'Sunday.pptx')
    const second = makePresentationItem('pptx-2', 'Sermon.pptx')

    usePresentationWorkspaceStore.getState().openDocument(first)
    usePresentationWorkspaceStore.getState().setActiveSlideId(first.id, 'slide-d')
    usePresentationWorkspaceStore.getState().openDocument(second)
    usePresentationWorkspaceStore.getState().setSlideCount(second.id, 8)

    expect(usePresentationWorkspaceStore.getState().documents.map((doc) => doc.itemId)).toEqual([
      'pptx-1',
      'pptx-2'
    ])
    expect(usePresentationWorkspaceStore.getState().activeItemId).toBe('pptx-2')
    expect(usePresentationWorkspaceStore.getState().getActiveSlideId(first.id)).toBe('slide-d')
    expect(usePresentationWorkspaceStore.getState().getActiveSlideId(second.id)).toBeNull()
    expect(usePresentationWorkspaceStore.getState().documents[1].slideCount).toBe(8)
  })

  it('updates editor metadata only for the target document', () => {
    usePresentationWorkspaceStore
      .getState()
      .openDocument(makeEditablePresentationItem('deck-1', 'Sunday'))
    usePresentationWorkspaceStore
      .getState()
      .openDocument(makeEditablePresentationItem('deck-2', 'Sermon'))

    usePresentationWorkspaceStore.getState().updateEditorMetadata('deck-1', {
      saveStatus: 'dirty',
      mirrorWarnings: ['thumbnail'],
      canUndo: true,
      canRedo: false
    })

    expect(usePresentationWorkspaceStore.getState().documents[0]).toMatchObject({
      saveStatus: 'dirty',
      mirrorWarnings: ['thumbnail'],
      canUndo: true,
      canRedo: false
    })
    expect(usePresentationWorkspaceStore.getState().documents[1]).not.toHaveProperty('saveStatus')
  })

  it('marks native presentation documents as editable mode', () => {
    usePresentationWorkspaceStore
      .getState()
      .openDocument(makeEditablePresentationItem('deck-1', 'Sunday'))

    expect(usePresentationWorkspaceStore.getState().documents[0]).toMatchObject({
      itemId: 'deck-1',
      mode: 'editable'
    })
  })

  it('updates an opened presentation tab name', () => {
    usePresentationWorkspaceStore
      .getState()
      .openDocument(makeEditablePresentationItem('deck-1', 'Sunday'))

    usePresentationWorkspaceStore.getState().updateDocumentName('deck-1', 'Sunday Service')

    expect(usePresentationWorkspaceStore.getState().documents[0]).toMatchObject({
      itemId: 'deck-1',
      name: 'Sunday Service'
    })
  })

  it('activates the nearest remaining tab when closing the active presentation', () => {
    const first = makePresentationItem('pptx-1', 'Sunday.pptx')
    const second = makePresentationItem('pptx-2', 'Sermon.pptx')
    const third = makePresentationItem('pptx-3', 'Prayer.pptx')

    usePresentationWorkspaceStore.getState().openDocument(first)
    usePresentationWorkspaceStore.getState().openDocument(second)
    usePresentationWorkspaceStore.getState().openDocument(third)
    usePresentationWorkspaceStore.getState().setActiveSlideId(third.id, 'slide-c')
    usePresentationWorkspaceStore.getState().updateEditorMetadata(third.id, {
      saveStatus: 'saved',
      mirrorWarnings: [],
      canUndo: false,
      canRedo: false
    })

    usePresentationWorkspaceStore.getState().closeDocument(third.id)

    expect(usePresentationWorkspaceStore.getState().activeItemId).toBe(second.id)
    expect(usePresentationWorkspaceStore.getState().documents.map((doc) => doc.itemId)).toEqual([
      first.id,
      second.id
    ])
    expect(usePresentationWorkspaceStore.getState().getActiveSlideId(third.id)).toBeNull()
  })
})
