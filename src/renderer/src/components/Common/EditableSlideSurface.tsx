import React, { useEffect, useMemo, useRef, useState } from 'react'
import type {
  EditablePresentationDocument,
  EditablePresentationElement,
  EditablePresentationSlide
} from '@renderer/lib/editable-presentation'

interface EditableSlideSurfaceProps {
  document: EditablePresentationDocument
  slideId: string
  editable?: boolean
  showBorder?: boolean
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
  showBorder = false,
  selectedElementId = null,
  className,
  onSelectElement,
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

  const borderColor = getReadableBorderColor(slide.background.color)

  const startDrag = (
    event: React.PointerEvent,
    element: EditablePresentationElement,
    mode: DragState['mode']
  ): void => {
    if (!editable || element.locked) return
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
      ref={surfaceRef}
      className={`relative aspect-video w-full overflow-hidden bg-black ${className ?? ''}`}
      style={{
        background: slide.background.type === 'color' ? slide.background.color : undefined,
        aspectRatio: `${document.width} / ${document.height}`,
        border: showBorder ? `1px solid ${borderColor}` : undefined
      }}
      onPointerDown={() => editable && onSelectElement?.(null)}
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
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
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
