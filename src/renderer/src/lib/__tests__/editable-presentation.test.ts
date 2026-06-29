import { beforeEach, describe, expect, it } from 'vitest'
import { resetFileExplorerDBForTests } from '../file-explorer-db'
import { getDerivedAsset, resetMediaWorkDBForTests } from '../media-work-db'
import { resetThumbnailDBForTests } from '../thumbnail-db'
import {
  EDITABLE_PRESENTATION_DOCUMENT_KIND,
  addElementToSlide,
  createBlankEditablePresentationDocument,
  createEditablePresentation,
  createTextElement,
  duplicateEditableSlide,
  duplicateElementInSlide,
  getEditablePresentationDocumentVariant,
  loadEditablePresentation,
  moveEditableSlide,
  removeElementFromSlide
} from '../editable-presentation'
import { EDITABLE_PRESENTATION_MIME_TYPE } from '../presentation-media'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'

beforeEach(async () => {
  await resetFileExplorerDBForTests()
  await resetMediaWorkDBForTests()
  await resetThumbnailDBForTests()
  useFileExplorerStore.setState({
    folders: {},
    items: {},
    _foldersArray: [],
    _itemsArray: [],
    _childFoldersByParent: {},
    _itemsByParent: {},
    loadedParents: new Set(),
    currentFolderId: 'file-root',
    isLoading: false,
    isInitialized: false
  })
})

describe('editable presentation documents', () => {
  it('creates a blank deck with one editable slide', () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]

    expect(document.name).toBe('Sunday')
    expect(document.width).toBe(1920)
    expect(document.height).toBe(1080)
    expect(document.slides[slideId].elementOrder).toEqual([])
  })

  it('duplicates slides without reusing element ids', () => {
    const blank = createBlankEditablePresentationDocument('Sunday')
    const slideId = blank.slideOrder[0]
    const text = createTextElement({ text: 'Welcome' })
    const withText = addElementToSlide(blank, slideId, text)
    const duplicated = duplicateEditableSlide(withText, slideId)
    const copiedSlideId = duplicated.slideOrder[1]
    const copiedElementId = duplicated.slides[copiedSlideId].elementOrder[0]

    expect(copiedSlideId).not.toBe(slideId)
    expect(copiedElementId).not.toBe(text.id)
    expect(duplicated.slides[copiedSlideId].elements[copiedElementId]).toMatchObject({
      type: 'text',
      text: 'Welcome'
    })
  })

  it('moves slides and removes duplicated elements', () => {
    const blank = createBlankEditablePresentationDocument('Sunday')
    const firstSlideId = blank.slideOrder[0]
    const withSecondSlide = duplicateEditableSlide(blank, firstSlideId)
    const moved = moveEditableSlide(withSecondSlide, firstSlideId, 1)
    const text = createTextElement({ text: 'Welcome' })
    const withText = addElementToSlide(moved, firstSlideId, text)
    const duplicated = duplicateElementInSlide(withText, firstSlideId, text.id)
    const removed = removeElementFromSlide(duplicated.document, firstSlideId, text.id)

    expect(moved.slideOrder[1]).toBe(firstSlideId)
    expect(duplicated.elementId).not.toBe(text.id)
    expect(removed.slides[firstSlideId].elementOrder).toEqual([duplicated.elementId])
  })

  it('creates a file item and persists the editable deck asset', async () => {
    const item = await createEditablePresentation('Sunday', 'file-root')
    const loaded = await loadEditablePresentation(item)
    const asset = await getDerivedAsset(
      item.id,
      EDITABLE_PRESENTATION_DOCUMENT_KIND,
      getEditablePresentationDocumentVariant(item.id)
    )

    expect(item.mimeType).toBe(EDITABLE_PRESENTATION_MIME_TYPE)
    expect(item.url).toBe(`blob:${item.id}`)
    expect(loaded.name).toBe('Sunday')
    expect(asset?.status).toBe('ready')
  })
})
