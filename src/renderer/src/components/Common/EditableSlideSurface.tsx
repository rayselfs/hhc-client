import React, { useMemo, useRef } from 'react'
import type {
  EditablePresentationDocument,
  EditablePresentationElement,
  EditablePresentationSlide
} from '@renderer/lib/editable-presentation'

interface EditableSlideSurfaceProps {
  document: EditablePresentationDocument
  slideId: string
  editable?: boolean
  selectedElementId?: string | null
  className?: string
  onSelectElement?: (elementId: string | null) => void
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

export default function EditableSlideSurface({
  document,
  slideId,
  editable = false,
  selectedElementId = null,
  className,
  onSelectElement,
  onUpdateElement
}: EditableSlideSurfaceProps): React.JSX.Element {
  const slide = document.slides[slideId]
  const dragRef = useRef<DragState | null>(null)
  const scaleRef = useRef({ x: 1, y: 1 })

  const orderedElements = useMemo(() => {
    if (!slide) return []
    return slide.elementOrder
      .map((elementId) => slide.elements[elementId])
      .filter((element): element is EditablePresentationElement => Boolean(element))
  }, [slide])

  if (!slide) {
    return <div className={`h-full w-full bg-black ${className ?? ''}`} />
  }

  const startDrag = (
    event: React.PointerEvent,
    element: EditablePresentationElement,
    mode: DragState['mode']
  ): void => {
    if (!editable || element.locked) return
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.closest('[data-slide-surface]')?.getBoundingClientRect()
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
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div
      data-slide-surface
      className={`relative aspect-video w-full overflow-hidden bg-black ${className ?? ''}`}
      style={{
        background: slide.background.type === 'color' ? slide.background.color : undefined,
        aspectRatio: `${document.width} / ${document.height}`
      }}
      onPointerDown={() => editable && onSelectElement?.(null)}
    >
      {orderedElements.map((element) => (
        <SlideElement
          key={element.id}
          document={document}
          slide={slide}
          element={element}
          editable={editable}
          selected={element.id === selectedElementId}
          onSelect={() => onSelectElement?.(element.id)}
          onPointerDown={(event) => startDrag(event, element, 'move')}
          onPointerMove={updateDrag}
          onPointerUp={endDrag}
          onUpdateElement={onUpdateElement}
          onResizePointerDown={(event) => startDrag(event, element, 'resize')}
        />
      ))}
    </div>
  )
}

function SlideElement({
  document,
  slide,
  element,
  editable,
  selected,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onUpdateElement,
  onResizePointerDown
}: {
  document: EditablePresentationDocument
  slide: EditablePresentationSlide
  element: EditablePresentationElement
  editable: boolean
  selected: boolean
  onSelect: () => void
  onPointerDown: (event: React.PointerEvent) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: (event: React.PointerEvent) => void
  onUpdateElement?: (
    slideId: string,
    elementId: string,
    updates: Partial<EditablePresentationElement>
  ) => void
  onResizePointerDown: (event: React.PointerEvent) => void
}): React.JSX.Element {
  const commonStyle: React.CSSProperties = {
    left: `${(element.x / document.width) * 100}%`,
    top: `${(element.y / document.height) * 100}%`,
    width: `${(element.width / document.width) * 100}%`,
    height: `${(element.height / document.height) * 100}%`,
    transform: `rotate(${element.rotation}deg)`,
    opacity: element.opacity
  }

  return (
    <div
      className={`absolute ${editable ? 'cursor-move' : ''} ${
        selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-black' : ''
      }`}
      style={commonStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      {renderElementContent(element, document, slide.id, editable, onUpdateElement)}
      {editable && selected && !element.locked && (
        <button
          type="button"
          className="absolute -bottom-2 -right-2 size-4 rounded-full border border-white bg-primary"
          aria-label="Resize element"
          onPointerDown={onResizePointerDown}
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
  onUpdateElement?: (
    slideId: string,
    elementId: string,
    updates: Partial<EditablePresentationElement>
  ) => void
): React.ReactNode {
  if (element.type === 'text') {
    return (
      <div
        className="h-full w-full whitespace-pre-wrap break-words outline-none"
        contentEditable={editable && !element.locked}
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
        onPointerDown={(event) => editable && event.stopPropagation()}
        onBlur={(event) =>
          onUpdateElement?.(slideId, element.id, {
            text: event.currentTarget.textContent ?? ''
          } as Partial<EditablePresentationElement>)
        }
      >
        {element.text}
      </div>
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
