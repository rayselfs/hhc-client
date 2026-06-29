import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
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

  it('grows an auto-width text box with typed content', () => {
    mockTextMeasurement()
    const handleUpdate = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Hi', width: 80, height: 30, autoWidth: true })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <EditableSlideSurface
        document={withText}
        slideId={slideId}
        editable
        selectedElementId={text.id}
        onUpdateElement={handleUpdate}
      />
    )

    handleUpdate.mockClear()
    const textBox = screen.getByText('Hi')
    fireEvent.doubleClick(textBox)
    textBox.textContent = 'Longer title'
    fireEvent.input(textBox)

    expect(handleUpdate).toHaveBeenCalledWith(
      slideId,
      text.id,
      expect.objectContaining({
        text: 'Longer title',
        width: 144,
        height: 74
      })
    )
  })

  it('keeps manually-sized text boxes at fixed width and only grows height', () => {
    mockTextMeasurement()
    const handleUpdate = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Hi', width: 80, height: 30, autoWidth: false })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <EditableSlideSurface
        document={withText}
        slideId={slideId}
        editable
        selectedElementId={text.id}
        onUpdateElement={handleUpdate}
      />
    )

    handleUpdate.mockClear()
    const textBox = screen.getByText('Hi')
    fireEvent.doubleClick(textBox)
    textBox.textContent = 'Longer title'
    fireEvent.input(textBox)

    expect(handleUpdate).toHaveBeenCalledWith(
      slideId,
      text.id,
      expect.objectContaining({
        text: 'Longer title',
        height: 148
      })
    )
    expect(handleUpdate.mock.calls.some(([, , updates]) => 'width' in updates)).toBe(false)
  })

  it('uses a width-only resize handle for text boxes', () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Width only' })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <EditableSlideSurface
        document={withText}
        slideId={slideId}
        editable
        selectedElementId={text.id}
      />
    )

    expect(screen.getByLabelText('Resize text box width')).toBeInTheDocument()
    expect(screen.queryByLabelText('Resize element')).not.toBeInTheDocument()
  })
})

function mockTextMeasurement(): void {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    return Math.max(20, (this.textContent?.length ?? 0) * 12)
  })
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
    this: HTMLElement
  ) {
    const width = Number.parseFloat(this.style.width)
    const textWidth = Math.max(20, (this.textContent?.length ?? 0) * 12)
    const lines =
      Number.isFinite(width) && width > 0 ? Math.max(1, Math.ceil(textWidth / width)) : 1
    return lines * 74
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})
