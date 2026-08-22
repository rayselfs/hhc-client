import { describe, expect, it } from 'vitest'
import type {
  EditablePresentationDocument,
  EditablePresentationElement,
  EditablePresentationSlide
} from '../editable-presentation'
import {
  alignElements,
  distributeElements,
  nudgeElements,
  reorderSelectedSlides,
  selectElementsInBounds,
  snapElementPosition
} from '../presentation-editor-commands'

function element(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 80,
  locked = false
): EditablePresentationElement {
  return {
    id,
    type: 'shape',
    shape: 'rectangle',
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked,
    fillColor: '#ffffff',
    strokeColor: '#000000',
    strokeWidth: 1
  }
}

function makeDocument(elements: EditablePresentationElement[] = []): EditablePresentationDocument {
  const slide = makeSlide(elements)
  return {
    id: 'deck-1',
    name: 'Deck',
    width: 1000,
    height: 600,
    slideOrder: ['slide-a', 'slide-b', 'slide-c', 'slide-d'],
    slides: {
      'slide-a': slide,
      'slide-b': { ...makeSlide([]), id: 'slide-b' },
      'slide-c': { ...makeSlide([]), id: 'slide-c' },
      'slide-d': { ...makeSlide([]), id: 'slide-d' }
    },
    assets: {},
    createdAt: 1,
    updatedAt: 1
  }
}

function makeSlide(elements: EditablePresentationElement[]): EditablePresentationSlide {
  return {
    id: 'slide-a',
    name: 'Slide',
    background: { type: 'solid', color: '#000000', transparency: 0 },
    elementOrder: elements.map((entry) => entry.id),
    elements: Object.fromEntries(elements.map((entry) => [entry.id, entry])),
    notes: ''
  }
}

describe('presentation editor commands', () => {
  it('reorders selected slides as one stable block', () => {
    const document = makeDocument()

    const movedToEnd = reorderSelectedSlides(document, ['slide-b', 'slide-c'], 4)
    const movedToStart = reorderSelectedSlides(document, ['slide-b', 'slide-c'], 0)

    expect(movedToEnd.slideOrder).toEqual(['slide-a', 'slide-d', 'slide-b', 'slide-c'])
    expect(movedToStart.slideOrder).toEqual(['slide-b', 'slide-c', 'slide-a', 'slide-d'])
    expect(document.slideOrder).toEqual(['slide-a', 'slide-b', 'slide-c', 'slide-d'])
  })

  it('selects unlocked elements intersecting the marquee in z-order', () => {
    const slide = makeSlide([
      element('outside', 500, 400),
      element('inside', 100, 100),
      element('crossing', 180, 180),
      element('locked', 120, 120, 50, 50, true)
    ])

    expect(selectElementsInBounds(slide, { x: 80, y: 80, width: 180, height: 180 })).toEqual([
      'inside',
      'crossing'
    ])
  })

  it('nudges selected elements together and clamps the group to the slide', () => {
    const document = makeDocument([element('a', 10, 10), element('b', 200, 100)])

    const nudged = nudgeElements(document, 'slide-a', ['a', 'b'], -30, -20)

    expect(nudged.slides['slide-a'].elements.a).toMatchObject({ x: 0, y: 0 })
    expect(nudged.slides['slide-a'].elements.b).toMatchObject({ x: 190, y: 90 })
  })

  it('aligns selected elements to their collective bounds', () => {
    const document = makeDocument([element('a', 100, 40, 80, 40), element('b', 260, 120, 120, 60)])

    const left = alignElements(document, 'slide-a', ['a', 'b'], 'left')
    const middle = alignElements(document, 'slide-a', ['a', 'b'], 'middle')

    expect(left.slides['slide-a'].elements.b.x).toBe(100)
    expect(middle.slides['slide-a'].elements.a.y).toBe(90)
    expect(middle.slides['slide-a'].elements.b.y).toBe(80)
  })

  it('distributes three or more elements while keeping the outer elements fixed', () => {
    const document = makeDocument([
      element('a', 0, 0, 100, 50),
      element('b', 140, 80, 100, 50),
      element('c', 400, 240, 100, 50)
    ])

    const horizontal = distributeElements(document, 'slide-a', ['a', 'b', 'c'], 'horizontal')
    const vertical = distributeElements(document, 'slide-a', ['a', 'b', 'c'], 'vertical')

    expect(horizontal.slides['slide-a'].elements.a.x).toBe(0)
    expect(horizontal.slides['slide-a'].elements.b.x).toBe(200)
    expect(horizontal.slides['slide-a'].elements.c.x).toBe(400)
    expect(vertical.slides['slide-a'].elements.b.y).toBe(120)
  })

  it('snaps an element to slide centers within tolerance and reports guides', () => {
    const result = snapElementPosition(
      element('a', 446, 258, 100, 80),
      { width: 1000, height: 600 },
      6
    )

    expect(result).toEqual({
      x: 450,
      y: 260,
      verticalGuide: 500,
      horizontalGuide: 300
    })
  })
})
