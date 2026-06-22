import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SlideProjection from '../SlideProjection'
import {
  createBlankSlide,
  createImageElement,
  createSlideDocument,
  createTextElement,
  upsertSlideElement
} from '@renderer/lib/slide-document'

describe('SlideProjection', () => {
  it('renders text elements from a native slide document', () => {
    const text = createTextElement({
      text: 'Amazing Grace',
      style: { align: 'center', color: '#f8fafc' }
    })
    const slide = upsertSlideElement(createBlankSlide({ title: 'Song' }), text)
    const document = createSlideDocument({ slides: [slide] })

    render(<SlideProjection document={document} slideIndex={0} />)

    expect(screen.getByTestId('slide-projection')).toBeInTheDocument()
    expect(screen.getByText('Amazing Grace')).toHaveStyle({ color: '#f8fafc' })
  })

  it('renders resolved image elements', () => {
    const image = createImageElement({ mediaId: 'image-1', alt: 'Background', fit: 'cover' })
    const slide = upsertSlideElement(createBlankSlide({ title: 'Image' }), image)
    const document = createSlideDocument({ slides: [slide] })

    render(
      <SlideProjection
        document={document}
        slideIndex={0}
        resolvedImageUrls={{ 'image-1': 'blob:image-1' }}
      />
    )

    const img = screen.getByAltText('Background')
    expect(img).toHaveAttribute('src', 'blob:image-1')
    expect(img).toHaveStyle({ objectFit: 'cover' })
  })

  it('falls back to the first slide when the requested slide is missing', () => {
    const slide = upsertSlideElement(
      createBlankSlide({ title: 'Fallback' }),
      createTextElement({ text: 'First slide' })
    )
    const document = createSlideDocument({ slides: [slide] })

    render(<SlideProjection document={document} slideIndex={10} />)

    expect(screen.getByText('First slide')).toBeInTheDocument()
  })
})
