import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBlankSlide,
  createImageElement,
  createSlideDocument,
  createTextElement,
  getSlideById,
  removeSlideElement,
  reorderSlides,
  updateSlideInDocument,
  upsertSlideElement,
  DEFAULT_SLIDE_SIZE,
  DEFAULT_SLIDE_THEME
} from '../slide-document'

describe('slide document model', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-22T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a native slide document with a default slide', () => {
    const document = createSlideDocument({ title: 'Sunday Service' })

    expect(document).toMatchObject({
      version: 1,
      title: 'Sunday Service',
      size: DEFAULT_SLIDE_SIZE,
      theme: DEFAULT_SLIDE_THEME,
      createdAt: Date.parse('2026-06-22T00:00:00Z'),
      updatedAt: Date.parse('2026-06-22T00:00:00Z')
    })
    expect(document.slides).toHaveLength(1)
    expect(document.slides[0]).toMatchObject({
      title: 'Untitled Slide',
      background: { type: 'color', color: DEFAULT_SLIDE_THEME.backgroundColor },
      elements: []
    })
  })

  it('adds slide elements ordered by zIndex', () => {
    const slide = createBlankSlide({ title: 'Lyrics' })
    const title = createTextElement({ text: 'Amazing Grace', zIndex: 2 })
    const background = createImageElement({ mediaId: 'image-1', zIndex: 1 })

    const updated = upsertSlideElement(upsertSlideElement(slide, title), background)

    expect(updated.elements.map((element) => element.id)).toEqual([background.id, title.id])
    expect(slide.elements).toHaveLength(0)
  })

  it('updates and removes elements immutably', () => {
    const slide = createBlankSlide()
    const text = createTextElement({ text: 'Original' })
    const withText = upsertSlideElement(slide, text)
    const changed = upsertSlideElement(withText, { ...text, text: 'Changed' })
    const removed = removeSlideElement(changed, text.id)

    expect(withText.elements[0]).toMatchObject({ text: 'Original' })
    expect(changed.elements[0]).toMatchObject({ text: 'Changed' })
    expect(removed.elements).toHaveLength(0)
  })

  it('updates and reorders slides in a document', () => {
    const first = createBlankSlide({ title: 'First' })
    const second = createBlankSlide({ title: 'Second' })
    const document = createSlideDocument({ slides: [first, second] })

    vi.setSystemTime(new Date('2026-06-22T00:00:01Z'))
    const renamed = updateSlideInDocument(document, first.id, (slide) => ({
      ...slide,
      title: 'Renamed'
    }))
    const reordered = reorderSlides(renamed, 0, 1)

    expect(getSlideById(renamed, first.id)?.title).toBe('Renamed')
    expect(reordered.slides.map((slide) => slide.id)).toEqual([second.id, first.id])
    expect(reordered.updatedAt).toBe(Date.parse('2026-06-22T00:00:01Z'))
  })
})
