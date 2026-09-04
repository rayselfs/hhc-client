import { describe, expect, it } from 'vitest'
import {
  addElementToSlide,
  createBlankEditablePresentationDocument,
  createImageElement,
  insertBlankEditableSlide
} from '../editable-presentation'
import {
  createSlideClipboard,
  cutSlides,
  pasteSlideClipboard
} from '../presentation-slide-clipboard'

describe('presentation slide clipboard', () => {
  it('copies selected slides in document order with referenced assets only', () => {
    const first = createBlankEditablePresentationDocument('Source')
    const second = insertBlankEditableSlide(first, 1).document
    const asset = {
      id: 'asset',
      name: 'photo',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AA=='
    }
    const image = createImageElement({
      assetId: asset.id,
      slideWidth: 1920,
      slideHeight: 1080,
      sourceWidth: 10,
      sourceHeight: 10
    })
    const document = addElementToSlide(
      { ...second, assets: { asset, unused: { ...asset, id: 'unused' } } },
      second.slideOrder[1],
      image
    )

    const clipboard = createSlideClipboard(document, [second.slideOrder[1], second.slideOrder[0]])

    expect(clipboard.slides.map((slide) => slide.id)).toEqual(second.slideOrder)
    expect(Object.keys(clipboard.assets)).toEqual(['asset'])
  })

  it('pastes fresh slide and element ids at the requested index', () => {
    const source = createBlankEditablePresentationDocument('Source')
    const clipboard = createSlideClipboard(source, source.slideOrder)
    const destination = createBlankEditablePresentationDocument('Destination')

    const result = pasteSlideClipboard(destination, clipboard, 0)

    expect(result.slideIds[0]).not.toBe(source.slideOrder[0])
    expect(result.document.slideOrder[0]).toBe(result.slideIds[0])
    expect(destination.slideOrder).toHaveLength(1)
  })

  it('remaps conflicting asset and theme ids without changing destination content', () => {
    const source = createBlankEditablePresentationDocument('Source')
    const sourceSlideId = source.slideOrder[0]
    const sourceThemeId = source.slides[sourceSlideId].themeId!
    source.themes![sourceThemeId].colorScheme.accent1 = '#ff0000'
    source.assets.asset = {
      id: 'asset',
      name: 'source',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,SOURCE'
    }
    const image = createImageElement({
      assetId: 'asset',
      slideWidth: source.width,
      slideHeight: source.height,
      sourceWidth: 10,
      sourceHeight: 10
    })
    const sourceWithImage = addElementToSlide(source, sourceSlideId, image)
    const destination = createBlankEditablePresentationDocument('Destination')
    const destinationThemeId = destination.defaultThemeId!
    destination.themes![destinationThemeId] = {
      ...source.themes![sourceThemeId],
      id: destinationThemeId,
      colorScheme: { ...source.themes![sourceThemeId].colorScheme, accent1: '#0000ff' }
    }
    destination.assets.asset = {
      id: 'asset',
      name: 'destination',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,DESTINATION'
    }

    const result = pasteSlideClipboard(
      destination,
      createSlideClipboard(sourceWithImage, [sourceSlideId]),
      1
    )
    const pastedSlide = result.document.slides[result.slideIds[0]]
    const pastedImage = pastedSlide.elements[pastedSlide.elementOrder[0]]

    expect(result.document.assets.asset.name).toBe('destination')
    expect(pastedImage.type === 'image' ? pastedImage.assetId : null).not.toBe('asset')
    expect(result.document.themes![destinationThemeId].colorScheme.accent1).toBe('#0000ff')
    expect(pastedSlide.themeId).not.toBe(destinationThemeId)
  })

  it('leaves one empty slide when cutting every source slide', () => {
    const source = createBlankEditablePresentationDocument('Source')
    const result = cutSlides(source, source.slideOrder)

    expect(result.slideOrder).toHaveLength(1)
    expect(result.slides[result.slideOrder[0]].elementOrder).toEqual([])
    expect(result.slideOrder[0]).not.toBe(source.slideOrder[0])
  })
})
