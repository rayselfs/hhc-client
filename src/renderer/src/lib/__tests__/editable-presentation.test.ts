import { beforeEach, describe, expect, it } from 'vitest'
import { resetFileExplorerDBForTests } from '../file-explorer-db'
import { getDerivedAsset, resetMediaWorkDBForTests } from '../media-work-db'
import { resetThumbnailDBForTests } from '../thumbnail-db'
import {
  EDITABLE_PRESENTATION_DOCUMENT_KIND,
  addBlankEditableSlide,
  addElementToSlide,
  applySlideBackgroundToAllSlides,
  createBlankEditablePresentationDocument,
  createEditablePresentation,
  createTextElement,
  duplicateEditableSlide,
  duplicateEditableSlides,
  duplicateElementInSlide,
  generateEditablePresentationThumbnail,
  getEditablePresentationDocumentVariant,
  getSlideBackgroundCss,
  insertBlankEditableSlide,
  loadEditablePresentation,
  moveEditableSlide,
  removeElementFromSlide,
  resetSlideBackground,
  removeEditableSlides,
  updateSlideBackground
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
    expect(document.slides[slideId].background).toEqual({
      type: 'solid',
      color: '#ffffff',
      transparency: 0
    })
    expect(document.slides[slideId].elementOrder).toEqual([])
  })

  it('adds blank slides with the same white default background', () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const updated = addBlankEditableSlide(document)
    const slideId = updated.slideOrder[1]

    expect(updated.slides[slideId].background).toEqual({
      type: 'solid',
      color: '#ffffff',
      transparency: 0
    })
  })

  it('inserts a blank slide after the focused slide', () => {
    const first = createBlankEditablePresentationDocument('Sunday')
    const second = addBlankEditableSlide(first)
    const result = insertBlankEditableSlide(second, 1)

    expect(result.document.slideOrder).toEqual([
      first.slideOrder[0],
      result.slideId,
      second.slideOrder[1]
    ])
    expect(result.document.slides[result.slideId].background).toEqual(second.defaultSlideBackground)
  })

  it('renders solid fill transparency against the white slide base', () => {
    expect(
      getSlideBackgroundCss({
        type: 'solid',
        color: '#800000',
        transparency: 50
      })
    ).toBe('#c08080')
  })

  it('updates, resets, and applies slide backgrounds with native-like fill controls', () => {
    const document = addBlankEditableSlide(createBlankEditablePresentationDocument('Sunday'))
    const firstSlideId = document.slideOrder[0]
    const secondSlideId = document.slideOrder[1]
    const withGradient = updateSlideBackground(document, firstSlideId, {
      type: 'gradient',
      gradientType: 'linear',
      direction: 'diagonal',
      angle: 45,
      stops: [
        { color: '#111827', position: 0, transparency: 10, brightness: -5 },
        { color: '#2563eb', position: 100, transparency: 20, brightness: 15 }
      ]
    })
    const applied = applySlideBackgroundToAllSlides(
      withGradient,
      withGradient.slides[firstSlideId].background
    )
    const reset = resetSlideBackground(applied, firstSlideId)

    expect(applied.slides[secondSlideId].background).toEqual({
      type: 'gradient',
      gradientType: 'linear',
      direction: 'diagonal',
      angle: 45,
      stops: [
        { color: '#111827', position: 0, transparency: 10, brightness: -5 },
        { color: '#2563eb', position: 100, transparency: 20, brightness: 15 }
      ]
    })
    expect(reset.slides[firstSlideId].background).toEqual(applied.slides[firstSlideId].background)
    expect(reset.slides[secondSlideId].background).toEqual(applied.slides[secondSlideId].background)
  })

  it('uses the applied-all background as the default for new slides', () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const firstSlideId = document.slideOrder[0]
    const withBackground = updateSlideBackground(document, firstSlideId, {
      type: 'solid',
      color: '#800000',
      transparency: 25
    })
    const applied = applySlideBackgroundToAllSlides(
      withBackground,
      withBackground.slides[firstSlideId].background
    )
    const withNewSlide = addBlankEditableSlide(applied)
    const newSlideId = withNewSlide.slideOrder[1]

    expect(withNewSlide.slides[newSlideId].background).toEqual({
      type: 'solid',
      color: '#800000',
      transparency: 25
    })
  })

  it('renders gradient backgrounds in generated thumbnails against the white slide base', () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const updated = updateSlideBackground(document, slideId, {
      type: 'gradient',
      gradientType: 'linear',
      direction: 'top-bottom',
      angle: 180,
      stops: [
        { color: '#ffffff', position: 0, transparency: 0, brightness: 0 },
        { color: '#111827', position: 100, transparency: 50, brightness: 10 }
      ]
    })
    const dataUrl = generateEditablePresentationThumbnail(updated)
    const svg = decodeURIComponent(
      escape(atob(dataUrl.replace(/^data:image\/svg\+xml;base64,/, '')))
    )

    expect(svg).toContain('<linearGradient')
    expect(svg).toContain('stop-color="#94979e"')
    expect(svg).not.toContain('stop-opacity=')
  })

  it('renders image crop and effects in generated thumbnails', () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const dataUrl = 'data:image/png;base64,AAA='
    const withAsset = {
      ...document,
      assets: {
        asset: {
          id: 'asset',
          name: 'photo.png',
          mimeType: 'image/png',
          dataUrl
        }
      }
    }
    const withImage = addElementToSlide(withAsset, slideId, {
      id: 'image-1',
      type: 'image',
      assetId: 'asset',
      x: 10,
      y: 20,
      width: 300,
      height: 200,
      rotation: 0,
      opacity: 0.8,
      crop: { top: 10, right: 20, bottom: 0, left: 5 },
      borderColor: '#ff0000',
      borderWidth: 4,
      shadow: 'soft'
    })
    const svg = decodeURIComponent(
      escape(
        atob(
          generateEditablePresentationThumbnail(withImage).replace(
            /^data:image\/svg\+xml;base64,/,
            ''
          )
        )
      )
    )

    expect(svg).toContain(`href="${dataUrl}"`)
    expect(svg).toContain('clipPath')
    expect(svg).toContain('stroke="#ff0000"')
    expect(svg).toContain('stroke-width="4"')
    expect(svg).toContain('feDropShadow')
  })

  it('marks newly inserted text boxes as auto-width until a fixed width is provided', () => {
    expect(createTextElement({ text: 'New text' })).toMatchObject({
      type: 'text',
      autoWidth: true
    })

    expect(createTextElement({ text: 'Imported text', width: 360 })).toMatchObject({
      type: 'text',
      width: 360,
      autoWidth: false
    })
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

  it('duplicates multiple selected slides into the requested insertion position', () => {
    const blank = createBlankEditablePresentationDocument('Sunday')
    const withSecond = addBlankEditableSlide(blank)
    const withThird = addBlankEditableSlide(withSecond)
    const text = createTextElement({ text: 'Welcome' })
    const firstSlideId = withThird.slideOrder[0]
    const thirdSlideId = withThird.slideOrder[2]
    const withText = addElementToSlide(withThird, firstSlideId, text)
    const duplicated = duplicateEditableSlides(withText, [thirdSlideId, firstSlideId], 1)

    expect(duplicated.slideIds).toHaveLength(2)
    expect(duplicated.document.slideOrder).toEqual([
      firstSlideId,
      duplicated.slideIds[0],
      duplicated.slideIds[1],
      withThird.slideOrder[1],
      thirdSlideId
    ])
    expect(duplicated.slideIds[0]).not.toBe(firstSlideId)
    expect(duplicated.document.slides[duplicated.slideIds[0]].elementOrder[0]).not.toBe(text.id)
  })

  it('removes multiple selected slides without deleting the last remaining slide', () => {
    const first = createBlankEditablePresentationDocument('Sunday')
    const second = addBlankEditableSlide(first)
    const third = addBlankEditableSlide(second)
    const removedMiddle = removeEditableSlides(third, [third.slideOrder[0], third.slideOrder[1]])
    const removedAll = removeEditableSlides(third, third.slideOrder)

    expect(removedMiddle.slideOrder).toEqual([third.slideOrder[2]])
    expect(removedAll.slideOrder).toHaveLength(1)
    expect(removedAll.slideOrder[0]).toBe(third.slideOrder[0])
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
