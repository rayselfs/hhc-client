import { fireEvent, render, screen } from '@testing-library/react'
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
  it('keeps text boxes draggable until the user explicitly edits text', () => {
    const document = createBlankEditablePresentationDocument('Sunday')
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Drag me' })
    const withText = addElementToSlide(document, slideId, text)

    render(<EditableSurfaceHarness document={withText} slideId={slideId} />)

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
      <EditableSurfaceHarness
        document={withText}
        slideId={slideId}
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
    fireEvent.doubleClick(textBox)
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

    render(<StatefulEditableSurfaceHarness document={withText} slideId={slideId} />)

    const textBox = screen.getByRole('textbox')
    fireEvent.doubleClick(textBox)

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

  it('keeps manually-sized text boxes at fixed width and only grows height', () => {
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

  it('renders selected text boxes with native-like square resize handles', () => {
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
    expect(screen.getByLabelText('Resize text box right')).toBeInTheDocument()
    expect(screen.queryByLabelText('Resize element')).not.toBeInTheDocument()
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

afterEach(() => {
  vi.restoreAllMocks()
})
