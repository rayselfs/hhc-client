import { fireEvent, render, screen } from '@testing-library/react'
import EditableSlideSurface from '../EditableSlideSurface'
import {
  addElementToSlide,
  createBlankEditablePresentationDocument,
  createTextElement
} from '@renderer/lib/editable-presentation'

describe('EditableSlideSurface', () => {
  it('keeps text boxes draggable until the user explicitly edits text', () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Drag me' })
    const withText = addElementToSlide(document, slideId, text)

    render(<EditableSlideSurface document={withText} slideId={slideId} editable />)

    const textBox = screen.getByText('Drag me')
    expect(textBox).not.toHaveAttribute('contenteditable', 'true')

    fireEvent.doubleClick(textBox)

    expect(textBox).toHaveAttribute('contenteditable', 'true')
  })
})
