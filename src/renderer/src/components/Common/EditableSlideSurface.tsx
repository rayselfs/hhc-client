import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  EditablePresentationDocument,
  EditablePresentationElement,
  EditablePresentationSlide
} from '@renderer/lib/editable-presentation'
import {
  getSlideBackgroundCss,
  getSlideBackgroundPrimaryColor
} from '@renderer/lib/editable-presentation'

interface EditableSlideSurfaceProps {
  document: EditablePresentationDocument
  slideId: string
  editable?: boolean
  showBorder?: boolean
  selectedElementId?: string | null
  editingElementId?: string | null
  className?: string
  onSelectElement?: (elementId: string | null) => void
  onEditingElementChange?: (elementId: string | null) => void
  onInsertText?: (point: { x: number; y: number }) => void
  onElementContextMenu?: (event: React.MouseEvent, element: EditablePresentationElement) => void
  onUpdateElement?: (
    slideId: string,
    elementId: string,
    updates: Partial<EditablePresentationElement>
  ) => void
}

interface DragState {
  elementId: string
  mode: 'move' | 'resize'
  startX: number
  startY: number
  original: EditablePresentationElement
}

const TEXT_MIN_WIDTH = 60
const TEXT_MIN_HEIGHT = 24

export default function EditableSlideSurface({
  document,
  slideId,
  editable = false,
  showBorder = false,
  selectedElementId = null,
  editingElementId = null,
  className,
  onSelectElement,
  onEditingElementChange,
  onInsertText,
  onElementContextMenu,
  onUpdateElement
}: EditableSlideSurfaceProps): React.JSX.Element {
  const slide = document.slides[slideId]
  const surfaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const scaleRef = useRef({ x: 1, y: 1 })
  const [surfaceScale, setSurfaceScale] = useState(1)

  const orderedElements = useMemo(() => {
    if (!slide) return []
    return slide.elementOrder
      .map((elementId) => slide.elements[elementId])
      .filter((element): element is EditablePresentationElement => Boolean(element))
  }, [slide])

  useEffect(() => {
    const surface = surfaceRef.current
    if (!surface) return
    const updateScale = (): void => {
      const rect = surface.getBoundingClientRect()
      if (rect.width > 0) setSurfaceScale(rect.width / document.width)
    }
    updateScale()
    if (!('ResizeObserver' in window)) return
    const observer = new ResizeObserver(updateScale)
    observer.observe(surface)
    return () => observer.disconnect()
  }, [document.width])

  if (!slide) {
    return <div className={`h-full w-full bg-black ${className ?? ''}`} />
  }

  const borderColor = getReadableBorderColor(getSlideBackgroundPrimaryColor(slide.background))

  const startDrag = (
    event: React.PointerEvent,
    element: EditablePresentationElement,
    mode: DragState['mode']
  ): void => {
    if (!editable || element.locked) return
    const target = event.target as HTMLElement | null
    if (
      mode === 'move' &&
      element.type === 'text' &&
      target?.closest('[data-text-content]') &&
      event.detail > 1
    ) {
      onSelectElement?.(element.id)
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (rect) {
      scaleRef.current = {
        x: document.width / rect.width,
        y: document.height / rect.height
      }
    }
    dragRef.current = {
      elementId: element.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      original: element
    }
    onEditingElementChange?.(null)
    onSelectElement?.(element.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const updateDrag = (event: React.PointerEvent): void => {
    const drag = dragRef.current
    if (!drag) return
    event.preventDefault()
    const dx = (event.clientX - drag.startX) * scaleRef.current.x
    const dy = (event.clientY - drag.startY) * scaleRef.current.y
    if (drag.mode === 'move') {
      onUpdateElement?.(slideId, drag.elementId, {
        x: Math.max(0, drag.original.x + dx),
        y: Math.max(0, drag.original.y + dy)
      } as Partial<EditablePresentationElement>)
    } else if (drag.original.type === 'text') {
      onUpdateElement?.(slideId, drag.elementId, {
        width: Math.max(TEXT_MIN_WIDTH, drag.original.width + dx),
        autoWidth: false
      } as Partial<EditablePresentationElement>)
    } else {
      onUpdateElement?.(slideId, drag.elementId, {
        width: Math.max(20, drag.original.width + dx),
        height: Math.max(20, drag.original.height + dy)
      } as Partial<EditablePresentationElement>)
    }
  }

  const endDrag = (event: React.PointerEvent): void => {
    if (!dragRef.current) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const insertTextAtPointer = (event: React.MouseEvent): void => {
    if (!editable || !onInsertText) return
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-slide-element]')) return
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect) return
    event.preventDefault()
    const scaleX = document.width / rect.width
    const scaleY = document.height / rect.height
    onInsertText({
      x: Math.max(
        0,
        Math.min(document.width - TEXT_MIN_WIDTH, (event.clientX - rect.left) * scaleX)
      ),
      y: Math.max(
        0,
        Math.min(document.height - TEXT_MIN_HEIGHT, (event.clientY - rect.top) * scaleY)
      )
    })
  }

  return (
    <div
      data-slide-surface
      ref={surfaceRef}
      className={`relative aspect-video w-full overflow-hidden bg-black ${className ?? ''}`}
      style={{
        background: getSlideBackgroundCss(slide.background),
        aspectRatio: `${document.width} / ${document.height}`,
        border: showBorder ? `1px solid ${borderColor}` : undefined
      }}
      onPointerDown={() => {
        if (!editable) return
        onEditingElementChange?.(null)
        onSelectElement?.(null)
      }}
      onDoubleClick={insertTextAtPointer}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: document.width,
          height: document.height,
          transform: `scale(${surfaceScale})`,
          transformOrigin: 'top left'
        }}
      >
        {orderedElements.map((element) => (
          <SlideElement
            key={element.id}
            document={document}
            slide={slide}
            element={element}
            editable={editable}
            editing={element.id === editingElementId}
            selected={element.id === selectedElementId}
            onSelect={() => onSelectElement?.(element.id)}
            onPointerDown={(event) => startDrag(event, element, 'move')}
            onPointerMove={updateDrag}
            onPointerUp={endDrag}
            onContextMenu={(event) => onElementContextMenu?.(event, element)}
            onUpdateElement={onUpdateElement}
            onResizePointerDown={(event) => startDrag(event, element, 'resize')}
            onStartTextEdit={() => {
              onSelectElement?.(element.id)
              onEditingElementChange?.(element.id)
            }}
            onFinishTextEdit={() => onEditingElementChange?.(null)}
          />
        ))}
      </div>
    </div>
  )
}

function getReadableBorderColor(color: string): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color.trim())
  if (!match) return '#ffffff'
  const red = parseInt(match[1], 16)
  const green = parseInt(match[2], 16)
  const blue = parseInt(match[3], 16)
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
  return luminance > 0.55 ? '#000000' : '#ffffff'
}

function SlideElement({
  document,
  slide,
  element,
  editable,
  editing,
  selected,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onContextMenu,
  onUpdateElement,
  onResizePointerDown,
  onStartTextEdit,
  onFinishTextEdit
}: {
  document: EditablePresentationDocument
  slide: EditablePresentationSlide
  element: EditablePresentationElement
  editable: boolean
  editing: boolean
  selected: boolean
  onSelect: () => void
  onPointerDown: (event: React.PointerEvent) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: (event: React.PointerEvent) => void
  onContextMenu?: (event: React.MouseEvent) => void
  onUpdateElement?: (
    slideId: string,
    elementId: string,
    updates: Partial<EditablePresentationElement>
  ) => void
  onResizePointerDown: (event: React.PointerEvent) => void
  onStartTextEdit: () => void
  onFinishTextEdit: () => void
}): React.JSX.Element {
  const commonStyle: React.CSSProperties = {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation}deg)`,
    opacity: element.opacity
  }

  return (
    <div
      data-slide-element
      className={`absolute ${editable ? 'cursor-move' : ''} ${
        selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''
      }`}
      style={commonStyle}
      onPointerDown={(event) => {
        if (editing) return
        onPointerDown(event)
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      {renderElementContent(
        element,
        document,
        slide.id,
        editable,
        editing,
        onUpdateElement,
        onStartTextEdit,
        onFinishTextEdit
      )}
      {editable && selected && !element.locked && (
        <button
          type="button"
          className={
            element.type === 'text'
              ? 'absolute -right-2 top-1/2 size-5 -translate-y-1/2 cursor-ew-resize rounded-full border border-white bg-primary'
              : 'absolute -bottom-2 -right-2 size-5 cursor-nwse-resize rounded-full border border-white bg-primary'
          }
          aria-label={element.type === 'text' ? 'Resize text box width' : 'Resize element'}
          onPointerDown={onResizePointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
      )}
    </div>
  )
}

function renderElementContent(
  element: EditablePresentationElement,
  document: EditablePresentationDocument,
  slideId: string,
  editable: boolean,
  editing: boolean,
  onUpdateElement?: (
    slideId: string,
    elementId: string,
    updates: Partial<EditablePresentationElement>
  ) => void,
  onStartTextEdit?: () => void,
  onFinishTextEdit?: () => void
): React.ReactNode {
  if (element.type === 'text') {
    return (
      <TextElementContent
        element={element}
        document={document}
        slideId={slideId}
        editable={editable}
        editing={editing}
        onUpdateElement={onUpdateElement}
        onStartTextEdit={onStartTextEdit}
        onFinishTextEdit={onFinishTextEdit}
      />
    )
  }

  if (element.type === 'image') {
    const asset = document.assets[element.assetId]
    return asset ? (
      <img
        src={asset.dataUrl}
        alt={asset.name}
        className="h-full w-full object-fill"
        draggable={false}
      />
    ) : (
      <div className="flex h-full w-full items-center justify-center bg-default-100 text-xs text-default-500">
        Missing image
      </div>
    )
  }

  if (element.type === 'shape') {
    return (
      <div
        className="h-full w-full"
        style={{
          backgroundColor: element.fillColor,
          border: `${element.strokeWidth}px solid ${element.strokeColor}`,
          borderRadius: element.shape === 'ellipse' ? '9999px' : 0
        }}
      />
    )
  }

  if (element.type === 'line') {
    return (
      <div
        className="absolute left-0 top-1/2 w-full"
        style={{
          borderTop: `${element.strokeWidth}px solid ${element.strokeColor}`
        }}
      />
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center rounded border border-dashed border-warning bg-warning/20 p-2 text-center text-xs text-warning-foreground">
      {element.label}
    </div>
  )
}

function TextElementContent({
  element,
  document,
  slideId,
  editable,
  editing,
  onUpdateElement,
  onStartTextEdit,
  onFinishTextEdit
}: {
  element: Extract<EditablePresentationElement, { type: 'text' }>
  document: EditablePresentationDocument
  slideId: string
  editable: boolean
  editing: boolean
  onUpdateElement?: (
    slideId: string,
    elementId: string,
    updates: Partial<EditablePresentationElement>
  ) => void
  onStartTextEdit?: () => void
  onFinishTextEdit?: () => void
}): React.JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null)

  const fitToText = (text: string): Partial<EditablePresentationElement> => {
    const updates = measureTextElement(contentRef.current, element, document.width, text)
    if (!updates) return { text } as Partial<EditablePresentationElement>
    return { text, ...updates } as Partial<EditablePresentationElement>
  }

  useLayoutEffect(() => {
    if (!editable || element.locked || !onUpdateElement) return
    const updates = measureTextElement(contentRef.current, element, document.width, element.text)
    if (!updates) return
    onUpdateElement(slideId, element.id, updates)
  }, [document.width, editable, element, onUpdateElement, slideId])

  useLayoutEffect(() => {
    if (!editing || element.locked) return
    const content = contentRef.current
    if (!content) return
    content.focus()
    const selection = window.getSelection()
    if (!selection) return
    const range = window.document.createRange()
    range.selectNodeContents(content)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [editing, element.locked])

  return (
    <div
      data-text-content
      ref={contentRef}
      className={`h-full w-full whitespace-pre-wrap break-words outline-none ${
        editable ? 'cursor-text' : ''
      }`}
      contentEditable={editing && !element.locked}
      suppressContentEditableWarning
      style={{
        color: element.color,
        fontFamily: element.fontFamily,
        fontSize: `${element.fontSize}px`,
        fontWeight: element.bold ? 700 : 400,
        fontStyle: element.italic ? 'italic' : 'normal',
        textDecoration: element.underline ? 'underline' : 'none',
        textAlign: element.align,
        lineHeight: element.lineHeight
      }}
      onInput={(event) => {
        if (!editing) return
        onUpdateElement?.(slideId, element.id, fitToText(event.currentTarget.textContent ?? ''))
      }}
      onPointerDown={(event) => editing && event.stopPropagation()}
      onDoubleClick={(event) => {
        if (!editable || element.locked) return
        event.stopPropagation()
        onStartTextEdit?.()
      }}
      onBlur={(event) => {
        onUpdateElement?.(slideId, element.id, fitToText(event.currentTarget.textContent ?? ''))
        onFinishTextEdit?.()
      }}
    >
      {element.text}
    </div>
  )
}

function measureTextElement(
  source: HTMLDivElement | null,
  element: Extract<EditablePresentationElement, { type: 'text' }>,
  slideWidth: number,
  text: string
): Partial<EditablePresentationElement> | null {
  if (!source || !document.body) return null
  const measure = source.cloneNode(false) as HTMLDivElement
  measure.textContent = text || ' '
  Object.assign(measure.style, {
    position: 'absolute',
    left: '-10000px',
    top: '-10000px',
    width: 'auto',
    height: 'auto',
    minWidth: '0',
    maxWidth: 'none',
    overflow: 'visible',
    pointerEvents: 'none',
    visibility: 'hidden',
    whiteSpace: 'pre'
  })
  document.body.appendChild(measure)
  const maxWidth = Math.max(TEXT_MIN_WIDTH, slideWidth - element.x)
  const naturalWidth = Math.ceil(measure.scrollWidth)
  const nextWidth =
    element.autoWidth === false
      ? element.width
      : Math.max(TEXT_MIN_WIDTH, Math.min(maxWidth, naturalWidth))

  measure.style.width = `${nextWidth}px`
  measure.style.whiteSpace = 'pre-wrap'
  measure.style.overflowWrap = 'break-word'
  const nextHeight = Math.max(TEXT_MIN_HEIGHT, Math.ceil(measure.scrollHeight))
  measure.remove()

  const updates: Partial<EditablePresentationElement> = {}
  if (element.autoWidth !== false && Math.abs(nextWidth - element.width) >= 1) {
    updates.width = nextWidth
  }
  if (Math.abs(nextHeight - element.height) >= 1) {
    updates.height = nextHeight
  }
  return Object.keys(updates).length > 0 ? updates : null
}
