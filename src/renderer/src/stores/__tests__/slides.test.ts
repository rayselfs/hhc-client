import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSlidesStore } from '../slides'

describe('slides store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-22T00:00:00Z'))
    useSlidesStore.getState().clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a persisted slide document and selects the first slide', () => {
    const documentId = useSlidesStore.getState().createDocument('Sunday Slides')
    const state = useSlidesStore.getState()

    expect(state.documents[documentId]).toMatchObject({ title: 'Sunday Slides' })
    expect(state.currentDocumentId).toBe(documentId)
    expect(state.selectedSlideId).toBe(state.documents[documentId].slides[0]?.id)
  })

  it('adds slides and edits slide content', () => {
    const documentId = useSlidesStore.getState().createDocument('Deck')
    const slideId = useSlidesStore.getState().addSlide(documentId)
    expect(slideId).not.toBeNull()
    if (!slideId) throw new Error('Expected slide id')

    useSlidesStore.getState().updateSlideTitle(documentId, slideId, 'Song Verse')
    useSlidesStore.getState().updateSlideBackgroundColor(documentId, slideId, '#111827')
    const elementId = useSlidesStore.getState().addTextElement(documentId, slideId, 'Verse 1')
    expect(elementId).not.toBeNull()
    if (!elementId) throw new Error('Expected element id')
    useSlidesStore.getState().updateTextElement(documentId, slideId, elementId, {
      text: 'Amazing grace',
      style: { fontSize: 96 }
    })

    const slide = useSlidesStore
      .getState()
      .documents[documentId].slides.find((candidate) => candidate.id === slideId)
    expect(slide).toMatchObject({
      title: 'Song Verse',
      background: { type: 'color', color: '#111827' }
    })
    expect(slide?.elements[0]).toMatchObject({
      type: 'text',
      text: 'Amazing grace',
      style: { fontSize: 96 }
    })
  })

  it('selects slides inside the current document only', () => {
    const documentId = useSlidesStore.getState().createDocument('Deck')
    const slideId = useSlidesStore.getState().addSlide(documentId)
    useSlidesStore.getState().selectSlide('missing')
    expect(useSlidesStore.getState().selectedSlideId).toBe(slideId)

    const firstSlideId = useSlidesStore.getState().documents[documentId].slides[0]?.id
    useSlidesStore.getState().selectSlide(firstSlideId)
    expect(useSlidesStore.getState().selectedSlideId).toBe(firstSlideId)
    expect(useSlidesStore.getState().selectedSlideIndex()).toBe(0)
  })

  it('applies built-in templates to the current document', () => {
    const documentId = useSlidesStore.getState().createDocument('Deck')
    useSlidesStore.getState().applyTemplate(documentId, 'clean-light')

    const document = useSlidesStore.getState().documents[documentId]
    expect(document.theme.id).toBe('clean-light')
    expect(document.slides[0].background).toEqual({ type: 'color', color: '#f8fafc' })
  })

  it('imports native slide documents and selects them', () => {
    const documentId = useSlidesStore.getState().createDocument('Imported')
    const document = useSlidesStore.getState().documents[documentId]
    useSlidesStore.getState().clear()

    useSlidesStore.getState().importDocument(document)

    expect(useSlidesStore.getState().currentDocumentId).toBe(documentId)
    expect(useSlidesStore.getState().selectedSlideId).toBe(document.slides[0]?.id)
  })
})
