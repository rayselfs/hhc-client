import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applySlideTemplate, BUILT_IN_SLIDE_TEMPLATES, getSlideTemplate } from '../slide-templates'
import {
  createBlankSlide,
  createSlideDocument,
  createTextElement,
  upsertSlideElement
} from '../slide-document'

describe('slide templates', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-22T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('finds built-in templates by id', () => {
    expect(getSlideTemplate('dark-stage')).toBe(BUILT_IN_SLIDE_TEMPLATES[0])
    expect(getSlideTemplate('missing')).toBeNull()
  })

  it('applies template theme to color slides and text elements', () => {
    const text = createTextElement({ text: 'Welcome' })
    const slide = upsertSlideElement(createBlankSlide(), text)
    const document = createSlideDocument({ slides: [slide] })
    const template = getSlideTemplate('clean-light')
    if (!template) throw new Error('Expected template')

    const updated = applySlideTemplate(document, template)

    expect(updated.theme).toBe(template.theme)
    expect(updated.slides[0].background).toEqual({
      type: 'color',
      color: template.theme.backgroundColor
    })
    expect(updated.slides[0].elements[0]).toMatchObject({
      type: 'text',
      style: {
        fontFamily: template.theme.fontFamily,
        color: template.theme.textColor
      }
    })
  })
})
