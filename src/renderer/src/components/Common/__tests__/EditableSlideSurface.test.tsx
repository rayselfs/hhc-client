import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { useState } from 'react'
import type { ComponentProps, JSX } from 'react'
import EditableSlideSurface from '../EditableSlideSurface'
import {
  addElementToSlide,
  createBlankEditablePresentationDocument,
  createTextElement,
  updateElementInSlide,
  type EditablePresentationDocument,
  type EditableImageElement
} from '@renderer/lib/editable-presentation'

describe('EditableSlideSurface', () => {
  it('creates a compact auto-sized text box on click while text insert mode is active', () => {
    const handleInsertText = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const { container } = render(
      <EditableSlideSurface
        document={document}
        slideId={slideId}
        editable
        isTextInsertMode
        onInsertText={handleInsertText}
      />
    )
    const surface = getSlideSurface(container)
    mockSurfaceRect(surface)

    fireEvent.pointerDown(surface, { clientX: 100, clientY: 50, pointerId: 1 })
    fireEvent.pointerUp(surface, { clientX: 100, clientY: 50, pointerId: 1 })

    expect(handleInsertText).toHaveBeenCalledWith({
      x: 200,
      y: 100,
      width: 24,
      height: 32,
      autoSize: 'content'
    })
  })

  it('creates a minimum 80 x 40 fixed text box from a small drag while text insert mode is active', () => {
    const handleInsertText = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const { container } = render(
      <EditableSlideSurface
        document={document}
        slideId={slideId}
        editable
        isTextInsertMode
        onInsertText={handleInsertText}
      />
    )
    const surface = getSlideSurface(container)
    mockSurfaceRect(surface)

    fireEvent.pointerDown(surface, { clientX: 100, clientY: 50, pointerId: 1 })
    fireEvent.pointerMove(surface, { clientX: 120, clientY: 60, pointerId: 1 })
    fireEvent.pointerUp(surface, { clientX: 120, clientY: 60, pointerId: 1 })

    expect(handleInsertText).toHaveBeenCalledWith({
      x: 200,
      y: 100,
      width: 80,
      height: 40,
      autoSize: 'fixed'
    })
  })

  it('enters text editing from a single pointer down inside the text box', () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Edit me' })
    const withText = addElementToSlide(document, slideId, text)

    render(<EditableSurfaceHarness document={withText} slideId={slideId} />)

    const textBox = screen.getByText('Edit me')
    expect(textBox).not.toHaveAttribute('contenteditable', 'true')

    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })

    expect(textBox).toHaveAttribute('contenteditable', 'true')
  })

  it('grows auto-sized text boxes to measured content while typing', () => {
    mockTextMeasurement()
    const handleUpdate = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Hi', width: 80, height: 30, autoWidth: true })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <EditableSurfaceHarness
        document={withText}
        slideId={slideId}
        selectedElementId={text.id}
        onUpdateElement={handleUpdate}
      />
    )

    handleUpdate.mockClear()
    const textBox = screen.getByText('Hi')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
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

  it('does not commit text while the user is composing East Asian input', () => {
    mockTextMeasurement()
    const handleUpdate = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: '', width: 80, height: 30, autoWidth: true })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <EditableSurfaceHarness
        document={withText}
        slideId={slideId}
        selectedElementId={text.id}
        onUpdateElement={handleUpdate}
      />
    )

    handleUpdate.mockClear()
    const textBox = screen.getByRole('textbox')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
    fireEvent.compositionStart(textBox)
    textBox.textContent = 'ㄓ'
    fireEvent.input(textBox)

    expect(handleUpdate).not.toHaveBeenCalled()

    textBox.textContent = '中'
    fireEvent.compositionEnd(textBox)

    expect(handleUpdate).toHaveBeenCalledWith(
      slideId,
      text.id,
      expect.objectContaining({
        text: '中'
      })
    )
  })

  it('keeps focus and editing active while text commits update the document', () => {
    mockTextMeasurement()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: '', width: 80, height: 30, autoWidth: true })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <>
        <button type="button">Confirm target</button>
        <StatefulEditableSurfaceHarness document={withText} slideId={slideId} />
      </>
    )

    const textBox = screen.getByRole('textbox')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })

    expect(textBox).toHaveAttribute('contenteditable', 'true')
    expect(globalThis.document.activeElement).toBe(textBox)

    textBox.textContent = '中'
    fireEvent.input(textBox)

    expect(textBox).toHaveAttribute('contenteditable', 'true')
    expect(globalThis.document.activeElement).toBe(textBox)

    textBox.textContent = '中文'
    fireEvent.input(textBox)

    expect(textBox).toHaveAttribute('contenteditable', 'true')
    expect(globalThis.document.activeElement).toBe(textBox)
    expect(textBox).toHaveTextContent('中文')
  })

  it('can edit the same text box again after blur confirms the edit', () => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'First', width: 220, height: 40, autoWidth: false })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <>
        <button type="button">Confirm target</button>
        <StatefulEditableSurfaceHarness document={withText} slideId={slideId} />
      </>
    )

    const textBox = screen.getByRole('textbox')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
    expect(textBox).toHaveAttribute('contenteditable', 'true')

    textBox.textContent = 'Confirmed'
    act(() => {
      screen.getByRole('button', { name: 'Confirm target' }).focus()
      fireEvent.blur(textBox)
    })

    expect(textBox).not.toHaveAttribute('contenteditable', 'true')
    fireEvent.pointerDown(screen.getByText('Confirmed'), { clientX: 40, clientY: 20, pointerId: 2 })

    expect(screen.getByRole('textbox')).toHaveAttribute('contenteditable', 'true')
  })

  it('does not start moving a text box from inside the text content area', () => {
    const handleUpdate = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Click text', width: 220, height: 40, autoWidth: false })
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

    const textBox = screen.getByText('Click text')
    mockElementRect(textBox, { left: 0, top: 0, width: 220, height: 40 })
    fireEvent.pointerDown(textBox, { clientX: 110, clientY: 20, pointerId: 1 })
    fireEvent.pointerMove(textBox, { clientX: 24, clientY: 18, pointerId: 1 })

    expect(handleUpdate).not.toHaveBeenCalled()
  })

  it('moves a text box when dragging from its frame edge', () => {
    const handleUpdate = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({
      text: 'Move frame',
      x: 100,
      y: 80,
      width: 220,
      height: 40,
      autoWidth: false
    })
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

    const textBox = screen.getByText('Move frame')
    mockElementRect(textBox, { left: 100, top: 80, width: 220, height: 40 })
    fireEvent.pointerDown(textBox, { clientX: 102, clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(textBox, { clientX: 122, clientY: 112, pointerId: 1 })

    expect(handleUpdate).toHaveBeenCalledWith(
      slideId,
      text.id,
      expect.objectContaining({
        x: 120,
        y: 92
      })
    )
  })

  it('groups pointer previews into one transform transaction', () => {
    const onTransformStart = vi.fn()
    const onTransformPreview = vi.fn()
    const onTransformCommit = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({
      text: 'Move once',
      x: 100,
      y: 80,
      width: 220,
      height: 40,
      autoWidth: false
    })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <EditableSlideSurface
        document={withText}
        slideId={slideId}
        editable
        selectedElementId={text.id}
        onTransformStart={onTransformStart}
        onTransformPreview={onTransformPreview}
        onTransformCommit={onTransformCommit}
      />
    )

    const textBox = screen.getByText('Move once')
    mockElementRect(textBox, { left: 100, top: 80, width: 220, height: 40 })
    fireEvent.pointerDown(textBox, { clientX: 102, clientY: 100, pointerId: 1 })
    for (let index = 1; index <= 100; index += 1) {
      fireEvent.pointerMove(textBox, {
        clientX: 102 + index,
        clientY: 100 + index,
        pointerId: 1
      })
    }
    fireEvent.pointerUp(textBox, { clientX: 202, clientY: 200, pointerId: 1 })

    expect(onTransformStart).toHaveBeenCalledTimes(1)
    expect(onTransformPreview).toHaveBeenCalledTimes(100)
    expect(onTransformCommit).toHaveBeenCalledTimes(1)
  })

  it('cancels a pointer transform without committing it', () => {
    const onTransformStart = vi.fn()
    const onTransformCommit = vi.fn()
    const onTransformCancel = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({
      text: 'Cancel move',
      x: 100,
      y: 80,
      width: 220,
      height: 40,
      autoWidth: false
    })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <EditableSlideSurface
        document={withText}
        slideId={slideId}
        editable
        selectedElementId={text.id}
        onTransformStart={onTransformStart}
        onTransformCancel={onTransformCancel}
        onTransformCommit={onTransformCommit}
      />
    )

    const textBox = screen.getByText('Cancel move')
    mockElementRect(textBox, { left: 100, top: 80, width: 220, height: 40 })
    fireEvent.pointerDown(textBox, { clientX: 102, clientY: 100, pointerId: 1 })
    fireEvent.pointerCancel(textBox, { pointerId: 1 })

    expect(onTransformStart).toHaveBeenCalledTimes(1)
    expect(onTransformCancel).toHaveBeenCalledTimes(1)
    expect(onTransformCommit).not.toHaveBeenCalled()
  })

  it('keeps manually-sized text boxes at fixed width and height while typing', () => {
    mockTextMeasurement()
    const handleUpdate = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Hi', width: 80, height: 30, autoWidth: false })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <EditableSurfaceHarness
        document={withText}
        slideId={slideId}
        selectedElementId={text.id}
        onUpdateElement={handleUpdate}
      />
    )

    handleUpdate.mockClear()
    const textBox = screen.getByText('Hi')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
    textBox.textContent = 'Longer title'
    fireEvent.input(textBox)

    expect(handleUpdate).toHaveBeenCalledWith(
      slideId,
      text.id,
      expect.objectContaining({
        text: 'Longer title'
      })
    )
    const updates = handleUpdate.mock.calls[0]?.[2]
    expect(updates).not.toHaveProperty('width')
    expect(updates).not.toHaveProperty('height')
  })

  it('renders imported text runs and clears them on the first plain-text edit', () => {
    const handleUpdate = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Bold plain', autoSize: 'fixed' })
    Object.assign(text, {
      runs: [
        {
          text: 'Bold',
          fontFamily: 'Arial',
          fontSize: 40,
          bold: true,
          italic: false,
          underline: false,
          color: '#ff0000'
        },
        {
          text: ' plain',
          fontFamily: 'Arial',
          fontSize: 24,
          bold: false,
          italic: true,
          underline: false,
          color: '#0000ff'
        }
      ]
    })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <EditableSurfaceHarness
        document={withText}
        slideId={slideId}
        onUpdateElement={handleUpdate}
      />
    )

    expect(screen.getByText('Bold')).toHaveStyle({
      fontSize: '40px',
      fontWeight: '700',
      color: '#ff0000'
    })
    const textBox = screen.getByRole('textbox')
    fireEvent.pointerDown(textBox, { clientX: 40, clientY: 20, pointerId: 1 })
    textBox.textContent = 'Edited'
    fireEvent.input(textBox)

    expect(handleUpdate).toHaveBeenCalledWith(
      slideId,
      text.id,
      expect.objectContaining({ text: 'Edited', runs: undefined })
    )
  })

  it('renders selected text boxes with clearly visible square resize handles', () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Resize me' })
    const withText = addElementToSlide(document, slideId, text)

    render(
      <EditableSlideSurface
        document={withText}
        slideId={slideId}
        editable
        selectedElementId={text.id}
      />
    )

    expect(screen.getAllByLabelText(/Resize text box/)).toHaveLength(8)
    expect(screen.getByLabelText('Resize text box top left')).toHaveClass('rounded-[2px]')
    expect(screen.getByLabelText('Resize text box top left')).toHaveClass('size-4')
    expect(screen.getByLabelText('Resize text box top left')).toHaveClass('border-2')
    expect(screen.getByLabelText('Resize text box top left')).toHaveClass('bg-white')
    expect(screen.getByLabelText('Resize text box right')).toBeInTheDocument()
    expect(screen.queryByLabelText('Resize element')).not.toBeInTheDocument()
  })

  it('resizes text box height from side handles', () => {
    const handleUpdate = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Resize me', width: 220, height: 40, autoWidth: false })
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

    const bottomHandle = screen.getByLabelText('Resize text box bottom')
    fireEvent.pointerDown(bottomHandle, { clientX: 0, clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(bottomHandle, { clientX: 0, clientY: 24, pointerId: 1 })

    expect(handleUpdate).toHaveBeenCalledWith(
      slideId,
      text.id,
      expect.objectContaining({
        height: 64,
        autoWidth: false
      })
    )
  })

  it('renders selected images with native-like resize handles and applied effects', () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const image: EditableImageElement = {
      id: 'image-1',
      type: 'image',
      assetId: 'asset-1',
      x: 100,
      y: 100,
      width: 320,
      height: 180,
      rotation: 0,
      opacity: 0.5,
      borderColor: '#ff0000',
      borderWidth: 6,
      shadow: 'soft'
    }
    const withImage = addElementToSlide(
      {
        ...document,
        assets: {
          'asset-1': {
            id: 'asset-1',
            name: 'photo.png',
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,AAA='
          }
        }
      },
      slideId,
      image
    )

    render(
      <EditableSlideSurface
        document={withImage}
        slideId={slideId}
        editable
        selectedElementId={image.id}
      />
    )

    expect(screen.getAllByLabelText(/Resize image/)).toHaveLength(8)
    const imageFrame = screen.getByAltText('photo.png').parentElement
    expect(imageFrame?.style.borderWidth).toBe('6px')
    expect(imageFrame?.style.borderStyle).toBe('solid')
    expect(imageFrame?.style.borderColor).toBe('rgb(255, 0, 0)')
  })

  it('updates image crop percentages from crop handles', () => {
    const handleUpdate = vi.fn()
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const image: EditableImageElement = {
      id: 'image-1',
      type: 'image',
      assetId: 'asset-1',
      x: 100,
      y: 100,
      width: 320,
      height: 180,
      rotation: 0,
      opacity: 1
    }
    const withImage = addElementToSlide(
      {
        ...document,
        assets: {
          'asset-1': {
            id: 'asset-1',
            name: 'photo.png',
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,AAA='
          }
        }
      },
      slideId,
      image
    )

    render(
      <EditableSlideSurface
        document={withImage}
        slideId={slideId}
        editable
        selectedElementId={image.id}
        cropElementId={image.id}
        onUpdateElement={handleUpdate}
      />
    )

    const handle = screen.getByLabelText('Crop image left')
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientX: 32, clientY: 0, pointerId: 1 })

    expect(handleUpdate).toHaveBeenCalledWith(
      slideId,
      image.id,
      expect.objectContaining({
        crop: expect.objectContaining({ left: 10 })
      })
    )
  })
})

function EditableSurfaceHarness({
  document,
  slideId,
  selectedElementId,
  cropElementId,
  onUpdateElement
}: {
  document: EditablePresentationDocument
  slideId: string
  selectedElementId?: string | null
  cropElementId?: string | null
  onUpdateElement?: ComponentProps<typeof EditableSlideSurface>['onUpdateElement']
}): JSX.Element {
  const [editingElementId, setEditingElementId] = useState<string | null>(null)

  return (
    <EditableSlideSurface
      document={document}
      slideId={slideId}
      editable
      selectedElementId={selectedElementId}
      editingElementId={editingElementId}
      cropElementId={cropElementId}
      onEditingElementChange={setEditingElementId}
      onUpdateElement={onUpdateElement}
    />
  )
}

function StatefulEditableSurfaceHarness({
  document,
  slideId
}: {
  document: EditablePresentationDocument
  slideId: string
}): JSX.Element {
  const [currentDocument, setCurrentDocument] = useState(document)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [editingElementId, setEditingElementId] = useState<string | null>(null)

  return (
    <EditableSlideSurface
      document={currentDocument}
      slideId={slideId}
      editable
      selectedElementId={selectedElementId}
      editingElementId={editingElementId}
      onSelectElement={setSelectedElementId}
      onEditingElementChange={setEditingElementId}
      onUpdateElement={(nextSlideId, elementId, updates) => {
        setCurrentDocument((previous) =>
          updateElementInSlide(previous, nextSlideId, elementId, updates)
        )
      }}
    />
  )
}

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

function getSlideSurface(container: HTMLElement): HTMLElement {
  const surface = container.querySelector('[data-slide-surface]')
  if (!(surface instanceof HTMLElement)) throw new Error('slide surface not found')
  return surface
}

function mockSurfaceRect(surface: HTMLElement): void {
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 960,
    bottom: 540,
    width: 960,
    height: 540,
    toJSON: () => ({})
  })
}

function mockElementRect(
  element: HTMLElement,
  rect: { left: number; top: number; width: number; height: number }
): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width,
    height: rect.height,
    toJSON: () => ({})
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})
