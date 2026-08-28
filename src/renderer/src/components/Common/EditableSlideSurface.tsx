import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type {
  EditablePresentationDocument,
  EditablePresentationElement,
  EditablePresentationSlide,
  EditableTextInsertFrame
} from '@renderer/lib/editable-presentation'
import {
  INSERTED_TEXT_CLICK_SIZE,
  INSERTED_TEXT_DRAG_MIN_SIZE,
  getSlideBackgroundCss,
  getSlideBackgroundPrimaryColor
} from '@renderer/lib/editable-presentation'

interface EditableSlideSurfaceProps {
  document: EditablePresentationDocument
  slideId: string
  editable?: boolean
  showBorder?: boolean
  selectedElementId?: string | null
  selectedElementIds?: ReadonlySet<string>
  editingElementId?: string | null
  cropElementId?: string | null
  isTextInsertMode?: boolean
  className?: string
  onSelectElement?: (
    elementId: string | null,
    event?: React.MouseEvent | React.PointerEvent
  ) => void
  onMarqueeSelect?: (
    bounds: { x: number; y: number; width: number; height: number },
    additive: boolean
  ) => void
  onEditingElementChange?: (elementId: string | null) => void
  onInsertText?: (frame: EditableTextInsertFrame) => void
  onElementContextMenu?: (event: React.MouseEvent, element: EditablePresentationElement) => void
  onTransformStart?: () => void
  onTransformPreview?: (elementId: string, updates: Partial<EditablePresentationElement>) => void
  onTransformCommit?: () => void
  onTransformCancel?: () => void
  onUpdateElement?: (
    slideId: string,
    elementId: string,
    updates: Partial<EditablePresentationElement>
  ) => void
}

interface DragState {
  elementId: string
  mode: 'move' | 'resize' | 'crop'
  handle?: ResizeHandle
  startX: number
  startY: number
  original: EditablePresentationElement
}

interface TextInsertState {
  pointerId: number
  startX: number
  startY: number
}

interface MarqueeState {
  pointerId: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  additive: boolean
}

type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const TEXT_MIN_WIDTH = 60
const TEXT_MIN_HEIGHT = 24
const TEXT_AUTO_MIN_WIDTH = INSERTED_TEXT_CLICK_SIZE.width
const TEXT_FRAME_HIT_AREA = 6
const MIN_ELEMENT_SIZE = 20
const MAX_CROP_TOTAL = 95

const IMAGE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const CONTENT_TEXT_HANDLES: ResizeHandle[] = ['nw', 'w', 'sw', 'ne', 'e', 'se']
const FIXED_TEXT_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export default function EditableSlideSurface({
  document,
  slideId,
  editable = false,
  showBorder = false,
  selectedElementId = null,
  selectedElementIds,
  editingElementId = null,
  cropElementId = null,
  isTextInsertMode = false,
  className,
  onSelectElement,
  onMarqueeSelect,
  onEditingElementChange,
  onInsertText,
  onElementContextMenu,
  onTransformStart,
  onTransformPreview,
  onTransformCommit,
  onTransformCancel,
  onUpdateElement
}: EditableSlideSurfaceProps): React.JSX.Element {
  const slide = document.slides[slideId]
  const surfaceRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const textInsertRef = useRef<TextInsertState | null>(null)
  const marqueeRef = useRef<MarqueeState | null>(null)
  const scaleRef = useRef({ x: 1, y: 1 })
  const [surfaceScale, setSurfaceScale] = useState(1)
  const [marquee, setMarquee] = useState<MarqueeState | null>(null)

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
    mode: DragState['mode'],
    handle?: ResizeHandle
  ): void => {
    if (!editable || element.locked) return
    event.preventDefault()
    event.stopPropagation()
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (rect && rect.width > 0 && rect.height > 0) {
      scaleRef.current = {
        x: document.width / rect.width,
        y: document.height / rect.height
      }
    }
    dragRef.current = {
      elementId: element.id,
      mode,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      original: element
    }
    onEditingElementChange?.(null)
    onSelectElement?.(element.id, event)
    onTransformStart?.()
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const updateDrag = (event: React.PointerEvent): void => {
    const drag = dragRef.current
    if (!drag) return
    event.preventDefault()
    const dx = (event.clientX - drag.startX) * scaleRef.current.x
    const dy = (event.clientY - drag.startY) * scaleRef.current.y
    let updates: Partial<EditablePresentationElement>
    if (drag.mode === 'move') {
      updates = {
        x: Math.max(0, drag.original.x + dx),
        y: Math.max(0, drag.original.y + dy)
      } as Partial<EditablePresentationElement>
    } else if (drag.mode === 'crop' && drag.original.type === 'image' && drag.handle) {
      updates = {
        crop: calculateImageCrop(drag.original.crop, drag.handle, dx, dy, drag.original)
      } as Partial<EditablePresentationElement>
    } else if (drag.original.type === 'text' && drag.handle) {
      updates = {
        ...calculateTextResize(drag.original, drag.handle, dx, dy),
        autoWidth: false,
        autoSize: drag.original.autoSize === 'content' ? 'content' : 'fixed'
      } as Partial<EditablePresentationElement>
    } else if (drag.original.type === 'image' && drag.handle) {
      updates = calculateImageResize(
        drag.original,
        drag.handle,
        dx,
        dy
      ) as Partial<EditablePresentationElement>
    } else {
      updates = {
        width: Math.max(MIN_ELEMENT_SIZE, drag.original.width + dx),
        height: Math.max(MIN_ELEMENT_SIZE, drag.original.height + dy)
      } as Partial<EditablePresentationElement>
    }
    if (onTransformPreview) {
      onTransformPreview(drag.elementId, updates)
    } else {
      onUpdateElement?.(slideId, drag.elementId, updates)
    }
  }

  const endDrag = (event: React.PointerEvent): void => {
    if (!dragRef.current) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onTransformCommit?.()
  }

  const cancelDrag = (event: React.PointerEvent): void => {
    if (!dragRef.current) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onTransformCancel?.()
  }

  const getCanvasPoint = (
    event: React.PointerEvent | React.MouseEvent
  ): { x: number; y: number } | null => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return null
    const scaleX = document.width / rect.width
    const scaleY = document.height / rect.height
    return {
      x: Math.max(0, Math.min(document.width, (event.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(document.height, (event.clientY - rect.top) * scaleY))
    }
  }

  const startTextInsert = (event: React.PointerEvent): boolean => {
    if (!editable || !isTextInsertMode || !onInsertText) return false
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-slide-element]')) return false
    const point = getCanvasPoint(event)
    if (!point) return false

    event.preventDefault()
    event.stopPropagation()
    textInsertRef.current = { pointerId: event.pointerId, startX: point.x, startY: point.y }
    onEditingElementChange?.(null)
    onSelectElement?.(null)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    return true
  }

  const finishTextInsert = (event: React.PointerEvent): void => {
    const insert = textInsertRef.current
    if (!insert || insert.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    textInsertRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const point = getCanvasPoint(event)
    if (!point) return
    const dx = point.x - insert.startX
    const dy = point.y - insert.startY
    const isDrag = Math.abs(dx) >= 1 || Math.abs(dy) >= 1
    if (!isDrag) {
      onInsertText?.({
        x: Math.max(0, Math.min(document.width - INSERTED_TEXT_CLICK_SIZE.width, insert.startX)),
        y: Math.max(0, Math.min(document.height - INSERTED_TEXT_CLICK_SIZE.height, insert.startY)),
        width: INSERTED_TEXT_CLICK_SIZE.width,
        height: INSERTED_TEXT_CLICK_SIZE.height,
        autoSize: 'content',
        autoWidth: true
      })
      return
    }

    const width = Math.max(INSERTED_TEXT_DRAG_MIN_SIZE.width, Math.abs(dx))
    const height = Math.max(INSERTED_TEXT_DRAG_MIN_SIZE.height, Math.abs(dy))
    const x = dx < 0 ? insert.startX - width : insert.startX
    const y = dy < 0 ? insert.startY - height : insert.startY
    onInsertText?.({
      x: Math.max(0, Math.min(document.width - width, x)),
      y: Math.max(0, Math.min(document.height - height, y)),
      width,
      height,
      autoSize: 'content',
      autoWidth: false
    })
  }

  const startMarquee = (event: React.PointerEvent): void => {
    if (!editable || !onMarqueeSelect || isTextInsertMode) return
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-slide-element]')) return
    const point = getCanvasPoint(event)
    if (!point) return
    const next: MarqueeState = {
      pointerId: event.pointerId,
      startX: point.x,
      startY: point.y,
      currentX: point.x,
      currentY: point.y,
      additive: event.metaKey || event.ctrlKey
    }
    marqueeRef.current = next
    setMarquee(next)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const updateMarquee = (event: React.PointerEvent): void => {
    const current = marqueeRef.current
    if (!current || current.pointerId !== event.pointerId) return
    const point = getCanvasPoint(event)
    if (!point) return
    const next = { ...current, currentX: point.x, currentY: point.y }
    marqueeRef.current = next
    setMarquee(next)
  }

  const finishMarquee = (event: React.PointerEvent): void => {
    const current = marqueeRef.current
    if (!current || current.pointerId !== event.pointerId) return
    marqueeRef.current = null
    setMarquee(null)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const x = Math.min(current.startX, current.currentX)
    const y = Math.min(current.startY, current.currentY)
    const width = Math.abs(current.currentX - current.startX)
    const height = Math.abs(current.currentY - current.startY)
    if (width >= 4 || height >= 4) {
      onMarqueeSelect?.({ x, y, width, height }, current.additive)
    }
  }

  const insertTextAtPointer = (event: React.MouseEvent): void => {
    if (!editable || !onInsertText) return
    const target = event.target as HTMLElement | null
    if (target?.closest('[data-slide-element]')) return
    const point = getCanvasPoint(event)
    if (!point) return
    event.preventDefault()
    onInsertText({
      x: Math.max(0, Math.min(document.width - INSERTED_TEXT_CLICK_SIZE.width, point.x)),
      y: Math.max(0, Math.min(document.height - INSERTED_TEXT_CLICK_SIZE.height, point.y)),
      width: INSERTED_TEXT_CLICK_SIZE.width,
      height: INSERTED_TEXT_CLICK_SIZE.height,
      autoSize: 'content',
      autoWidth: true
    })
  }

  return (
    <div
      data-slide-surface
      ref={surfaceRef}
      className={`relative aspect-video w-full overflow-hidden bg-black ${
        isTextInsertMode ? 'cursor-crosshair' : ''
      } ${className ?? ''}`}
      style={{
        background: getSlideBackgroundCss(slide.background),
        aspectRatio: `${document.width} / ${document.height}`,
        border: showBorder ? `1px solid ${borderColor}` : undefined
      }}
      onPointerDown={(event) => {
        if (!editable) return
        if (startTextInsert(event)) return
        onEditingElementChange?.(null)
        if (!(event.metaKey || event.ctrlKey)) onSelectElement?.(null, event)
        startMarquee(event)
      }}
      onPointerMove={updateMarquee}
      onPointerUp={(event) => {
        finishTextInsert(event)
        finishMarquee(event)
      }}
      onPointerCancel={(event) => {
        marqueeRef.current = null
        setMarquee(null)
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
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
            cropMode={element.id === cropElementId}
            selected={
              element.id === selectedElementId || Boolean(selectedElementIds?.has(element.id))
            }
            primarySelected={element.id === selectedElementId}
            onSelect={(event) => onSelectElement?.(element.id, event)}
            onPointerDown={(event) => startDrag(event, element, 'move')}
            onPointerMove={updateDrag}
            onPointerUp={endDrag}
            onPointerCancel={cancelDrag}
            onContextMenu={(event) => onElementContextMenu?.(event, element)}
            onUpdateElement={onUpdateElement}
            onResizePointerDown={(event, handle) => startDrag(event, element, 'resize', handle)}
            onCropPointerDown={(event, handle) => startDrag(event, element, 'crop', handle)}
            onStartTextEdit={() => {
              onSelectElement?.(element.id)
              onEditingElementChange?.(element.id)
            }}
            onFinishTextEdit={() => onEditingElementChange?.(null)}
          />
        ))}
        {marquee && (
          <div
            data-testid="element-marquee"
            className="pointer-events-none absolute border border-primary bg-primary/15"
            style={{
              left: Math.min(marquee.startX, marquee.currentX),
              top: Math.min(marquee.startY, marquee.currentY),
              width: Math.abs(marquee.currentX - marquee.startX),
              height: Math.abs(marquee.currentY - marquee.startY)
            }}
          />
        )}
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
  cropMode,
  selected,
  primarySelected,
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onContextMenu,
  onUpdateElement,
  onResizePointerDown,
  onCropPointerDown,
  onStartTextEdit,
  onFinishTextEdit
}: {
  document: EditablePresentationDocument
  slide: EditablePresentationSlide
  element: EditablePresentationElement
  editable: boolean
  editing: boolean
  cropMode: boolean
  selected: boolean
  primarySelected: boolean
  onSelect: (event: React.MouseEvent) => void
  onPointerDown: (event: React.PointerEvent) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: (event: React.PointerEvent) => void
  onPointerCancel: (event: React.PointerEvent) => void
  onContextMenu?: (event: React.MouseEvent) => void
  onUpdateElement?: (
    slideId: string,
    elementId: string,
    updates: Partial<EditablePresentationElement>
  ) => void
  onResizePointerDown: (event: React.PointerEvent, handle: ResizeHandle) => void
  onCropPointerDown: (event: React.PointerEvent, handle: ResizeHandle) => void
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
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenu}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(event)
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
      {editable && primarySelected && !element.locked && (
        <ElementHandles
          element={element}
          cropMode={cropMode}
          onResizePointerDown={onResizePointerDown}
          onCropPointerDown={onCropPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        />
      )}
    </div>
  )
}

function ElementHandles({
  element,
  cropMode,
  onResizePointerDown,
  onCropPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel
}: {
  element: EditablePresentationElement
  cropMode: boolean
  onResizePointerDown: (event: React.PointerEvent, handle: ResizeHandle) => void
  onCropPointerDown: (event: React.PointerEvent, handle: ResizeHandle) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: (event: React.PointerEvent) => void
  onPointerCancel: (event: React.PointerEvent) => void
}): React.JSX.Element {
  if (element.type === 'text') {
    const handles = element.autoSize === 'content' ? CONTENT_TEXT_HANDLES : FIXED_TEXT_HANDLES
    return (
      <>
        {handles.map((handle) => (
          <button
            key={`resize-text-${handle}`}
            type="button"
            className={`${getHandlePositionClass(handle)} ${getHandleCursorClass(handle)} absolute size-4 rounded-[2px] border-2 border-primary bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.65)]`}
            aria-label={`Resize text box ${handleToLabel(handle)}`}
            onPointerDown={(event) => onResizePointerDown(event, handle)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
        ))}
      </>
    )
  }

  if (element.type === 'image') {
    return (
      <>
        {cropMode && (
          <div className="pointer-events-none absolute inset-0 border border-dashed border-warning" />
        )}
        {IMAGE_HANDLES.map((handle) => (
          <button
            key={`${cropMode ? 'crop' : 'resize'}-${handle}`}
            type="button"
            className={`${getHandlePositionClass(handle)} ${getHandleCursorClass(handle)} absolute size-4 rounded-full border border-white ${
              cropMode ? 'bg-warning' : 'bg-primary'
            }`}
            aria-label={`${cropMode ? 'Crop' : 'Resize'} image ${handleToLabel(handle)}`}
            onPointerDown={(event) =>
              cropMode ? onCropPointerDown(event, handle) : onResizePointerDown(event, handle)
            }
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
        ))}
      </>
    )
  }

  return (
    <button
      type="button"
      className="absolute -bottom-2 -right-2 size-5 cursor-nwse-resize rounded-full border border-white bg-primary"
      aria-label="Resize element"
      onPointerDown={(event) => onResizePointerDown(event, 'se')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
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
      <ImageElementContent element={element} asset={asset} />
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

function ImageElementContent({
  element,
  asset
}: {
  element: Extract<EditablePresentationElement, { type: 'image' }>
  asset: { name: string; dataUrl: string }
}): React.JSX.Element {
  const crop = normalizeImageCrop(element.crop)
  const visibleWidth = Math.max(1, 100 - crop.left - crop.right)
  const visibleHeight = Math.max(1, 100 - crop.top - crop.bottom)

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        border:
          element.borderWidth && element.borderWidth > 0
            ? `${element.borderWidth}px solid ${element.borderColor ?? '#ffffff'}`
            : undefined,
        boxShadow: getImageShadow(element.shadow)
      }}
    >
      <img
        src={asset.dataUrl}
        alt={asset.name}
        className="absolute max-w-none object-fill"
        draggable={false}
        style={{
          left: `${-(crop.left / visibleWidth) * 100}%`,
          top: `${-(crop.top / visibleHeight) * 100}%`,
          width: `${(100 / visibleWidth) * 100}%`,
          height: `${(100 / visibleHeight) * 100}%`
        }}
      />
    </div>
  )
}

function calculateTextResize(
  element: Extract<EditablePresentationElement, { type: 'text' }>,
  handle: ResizeHandle,
  dx: number,
  dy: number
): Partial<EditablePresentationElement> {
  const hasWest = handle.includes('w')
  const hasEast = handle.includes('e')
  const width = Math.max(TEXT_MIN_WIDTH, element.width + (hasEast ? dx : hasWest ? -dx : 0))
  if (element.autoSize === 'content') {
    return {
      x: hasWest ? element.x + (element.width - width) : element.x,
      width
    } as Partial<EditablePresentationElement>
  }

  const hasNorth = handle.includes('n')
  const hasSouth = handle.includes('s')
  const height = Math.max(TEXT_MIN_HEIGHT, element.height + (hasSouth ? dy : hasNorth ? -dy : 0))

  return {
    x: hasWest ? element.x + (element.width - width) : element.x,
    y: hasNorth ? element.y + (element.height - height) : element.y,
    width,
    height
  } as Partial<EditablePresentationElement>
}

function isContentAutoSizedText(
  element: Extract<EditablePresentationElement, { type: 'text' }>
): boolean {
  return element.autoSize === 'content' || element.autoWidth === true
}

function measureAutoSizedTextElement(
  source: HTMLDivElement | null,
  element: Extract<EditablePresentationElement, { type: 'text' }>,
  text: string
): Partial<EditablePresentationElement> {
  if (!source || !window.document.body) return {}
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
  window.document.body.appendChild(measure)

  const width = Math.max(TEXT_AUTO_MIN_WIDTH, Math.ceil(measure.scrollWidth))
  measure.style.width = `${width}px`
  measure.style.whiteSpace = 'pre-wrap'
  measure.style.overflowWrap = 'break-word'
  const height = Math.max(
    Math.ceil(element.fontSize * element.lineHeight),
    Math.ceil(measure.scrollHeight)
  )
  measure.remove()

  const updates: Partial<EditablePresentationElement> = {}
  if (element.autoWidth === true && Math.abs(width - element.width) >= 1) updates.width = width
  if (element.autoSize === 'content' && Math.abs(height - element.height) >= 1) {
    updates.height = height
  }
  return updates
}

type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
  caretRangeFromPoint?: (x: number, y: number) => Range | null
}

function createCaretRangeFromPoint(x: number, y: number, content: HTMLElement): Range | null {
  const ownerDocument = window.document as CaretDocument
  const position = ownerDocument.caretPositionFromPoint?.(x, y)
  if (position && content.contains(position.offsetNode)) {
    const range = ownerDocument.createRange()
    range.setStart(position.offsetNode, position.offset)
    range.collapse(true)
    return range
  }

  const range = ownerDocument.caretRangeFromPoint?.(x, y) ?? null
  return range && content.contains(range.startContainer) ? range : null
}

function isTextFramePointer(
  event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>
): boolean {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  return (
    x <= TEXT_FRAME_HIT_AREA ||
    y <= TEXT_FRAME_HIT_AREA ||
    rect.width - x <= TEXT_FRAME_HIT_AREA ||
    rect.height - y <= TEXT_FRAME_HIT_AREA
  )
}

function TextElementContent({
  element,
  slideId,
  editable,
  editing,
  onUpdateElement,
  onStartTextEdit,
  onFinishTextEdit
}: {
  element: Extract<EditablePresentationElement, { type: 'text' }>
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
  const isComposingRef = useRef(false)
  const initializedEditingElementRef = useRef<string | null>(null)
  const blurFrameRef = useRef<number | null>(null)
  const pendingCaretPointRef = useRef<{ x: number; y: number } | null>(null)

  const cancelPendingBlur = (): void => {
    if (blurFrameRef.current == null) return
    window.cancelAnimationFrame(blurFrameRef.current)
    blurFrameRef.current = null
  }

  const commitText = (text: string): void => {
    onUpdateElement?.(slideId, element.id, {
      text,
      runs: undefined,
      ...(isContentAutoSizedText(element)
        ? measureAutoSizedTextElement(contentRef.current, element, text)
        : {})
    } as Partial<EditablePresentationElement>)
  }

  const focusEditableContent = (
    content: HTMLDivElement,
    point: { x: number; y: number } | null = null
  ): void => {
    content.focus()
    const range = point ? createCaretRangeFromPoint(point.x, point.y, content) : null
    const selection = window.getSelection()
    if (!selection) return
    const nextRange = range ?? window.document.createRange()
    if (!range) {
      nextRange.selectNodeContents(content)
      nextRange.collapse(false)
    }
    selection.removeAllRanges()
    selection.addRange(nextRange)
  }

  useLayoutEffect(() => {
    if (!editing || element.locked) return
    const content = contentRef.current
    if (!content) return
    if (initializedEditingElementRef.current === element.id) return
    initializedEditingElementRef.current = element.id
    content.textContent = element.text
    focusEditableContent(content, pendingCaretPointRef.current)
    pendingCaretPointRef.current = null
  }, [editing, element.id, element.locked, element.text])

  useLayoutEffect(() => {
    if (!editing || element.locked) return
    const content = contentRef.current
    if (!content) return
    if (window.document.activeElement === content) return
    focusEditableContent(content)
  }, [editing, element.height, element.locked, element.width])

  useLayoutEffect(() => {
    if (editing) return
    initializedEditingElementRef.current = null
  }, [editing])

  useEffect(() => {
    return () => {
      if (blurFrameRef.current != null) window.cancelAnimationFrame(blurFrameRef.current)
    }
  }, [])

  return (
    <div
      data-text-content
      ref={contentRef}
      role="textbox"
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
        if (isComposingRef.current) return
        commitText(event.currentTarget.textContent ?? '')
      }}
      onCompositionStart={() => {
        isComposingRef.current = true
      }}
      onCompositionEnd={(event) => {
        isComposingRef.current = false
        if (!editing) return
        commitText(event.currentTarget.textContent ?? '')
      }}
      onPointerDown={(event) => {
        if (!editable) return
        cancelPendingBlur()
        if (isTextFramePointer(event)) return
        event.stopPropagation()
        if (!editing && !element.locked) {
          pendingCaretPointRef.current = { x: event.clientX, y: event.clientY }
          onStartTextEdit?.()
        }
      }}
      onClick={(event) => {
        if (!editable || element.locked) return
        if (isTextFramePointer(event)) return
        event.stopPropagation()
        cancelPendingBlur()
        if (!editing) {
          pendingCaretPointRef.current = { x: event.clientX, y: event.clientY }
          onStartTextEdit?.()
        }
      }}
      onBlur={(event) => {
        const target = event.currentTarget
        if (blurFrameRef.current != null) window.cancelAnimationFrame(blurFrameRef.current)
        blurFrameRef.current = window.requestAnimationFrame(() => {
          blurFrameRef.current = null
          if (window.document.activeElement === target) return
          isComposingRef.current = false
          commitText(target.textContent ?? '')
          onFinishTextEdit?.()
        })
      }}
    >
      {editing
        ? null
        : element.runs?.length
          ? element.runs.map((run, index) => (
              <span
                key={index}
                style={{
                  color: run.color,
                  fontFamily: run.fontFamily,
                  fontSize: `${run.fontSize}px`,
                  fontWeight: run.bold ? 700 : 400,
                  fontStyle: run.italic ? 'italic' : 'normal',
                  textDecoration: run.underline ? 'underline' : 'none'
                }}
              >
                {run.text}
              </span>
            ))
          : element.text}
    </div>
  )
}

function calculateImageResize(
  element: Extract<EditablePresentationElement, { type: 'image' }>,
  handle: ResizeHandle,
  dx: number,
  dy: number
): Partial<EditablePresentationElement> {
  const hasWest = handle.includes('w')
  const hasEast = handle.includes('e')
  const hasNorth = handle.includes('n')
  const hasSouth = handle.includes('s')
  const isCorner = (hasWest || hasEast) && (hasNorth || hasSouth)

  let width = element.width + (hasEast ? dx : hasWest ? -dx : 0)
  let height = element.height + (hasSouth ? dy : hasNorth ? -dy : 0)

  if (isCorner) {
    const aspectRatio = element.width / element.height
    const widthDelta = Math.abs(width - element.width)
    const heightDelta = Math.abs(height - element.height) * aspectRatio
    if (widthDelta >= heightDelta) {
      height = width / aspectRatio
    } else {
      width = height * aspectRatio
    }
  }

  width = Math.max(MIN_ELEMENT_SIZE, width)
  height = Math.max(MIN_ELEMENT_SIZE, height)

  return {
    x: hasWest ? element.x + (element.width - width) : element.x,
    y: hasNorth ? element.y + (element.height - height) : element.y,
    width,
    height
  } as Partial<EditablePresentationElement>
}

function calculateImageCrop(
  crop: Extract<EditablePresentationElement, { type: 'image' }>['crop'],
  handle: ResizeHandle,
  dx: number,
  dy: number,
  element: Extract<EditablePresentationElement, { type: 'image' }>
): NonNullable<Extract<EditablePresentationElement, { type: 'image' }>['crop']> {
  const next = normalizeImageCrop(crop)
  const dxPercent = (dx / Math.max(1, element.width)) * 100
  const dyPercent = (dy / Math.max(1, element.height)) * 100

  if (handle.includes('w')) next.left += dxPercent
  if (handle.includes('e')) next.right -= dxPercent
  if (handle.includes('n')) next.top += dyPercent
  if (handle.includes('s')) next.bottom -= dyPercent

  return clampCrop(next)
}

function normalizeImageCrop(
  crop: Extract<EditablePresentationElement, { type: 'image' }>['crop']
): NonNullable<Extract<EditablePresentationElement, { type: 'image' }>['crop']> {
  return {
    top: crop?.top ?? 0,
    right: crop?.right ?? 0,
    bottom: crop?.bottom ?? 0,
    left: crop?.left ?? 0
  }
}

function clampCrop(
  crop: NonNullable<Extract<EditablePresentationElement, { type: 'image' }>['crop']>
): NonNullable<Extract<EditablePresentationElement, { type: 'image' }>['crop']> {
  const next = {
    top: clamp(crop.top, 0, MAX_CROP_TOTAL),
    right: clamp(crop.right, 0, MAX_CROP_TOTAL),
    bottom: clamp(crop.bottom, 0, MAX_CROP_TOTAL),
    left: clamp(crop.left, 0, MAX_CROP_TOTAL)
  }
  if (next.left + next.right > MAX_CROP_TOTAL) {
    next.right = MAX_CROP_TOTAL - next.left
  }
  if (next.top + next.bottom > MAX_CROP_TOTAL) {
    next.bottom = MAX_CROP_TOTAL - next.top
  }
  return next
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getImageShadow(
  shadow: Extract<EditablePresentationElement, { type: 'image' }>['shadow']
): string | undefined {
  if (shadow === 'soft') return '0 8px 20px rgba(0, 0, 0, 0.22)'
  if (shadow === 'medium') return '0 14px 32px rgba(0, 0, 0, 0.32)'
  return undefined
}

function getHandlePositionClass(handle: ResizeHandle): string {
  const vertical = handle.includes('n')
    ? '-top-2'
    : handle.includes('s')
      ? '-bottom-2'
      : 'top-1/2 -translate-y-1/2'
  const horizontal = handle.includes('w')
    ? '-left-2'
    : handle.includes('e')
      ? '-right-2'
      : 'left-1/2 -translate-x-1/2'
  return `${vertical} ${horizontal}`
}

function getHandleCursorClass(handle: ResizeHandle): string {
  if (handle === 'n' || handle === 's') return 'cursor-ns-resize'
  if (handle === 'e' || handle === 'w') return 'cursor-ew-resize'
  if (handle === 'ne' || handle === 'sw') return 'cursor-nesw-resize'
  return 'cursor-nwse-resize'
}

function handleToLabel(handle: ResizeHandle): string {
  const labels: Record<ResizeHandle, string> = {
    n: 'top',
    ne: 'top right',
    e: 'right',
    se: 'bottom right',
    s: 'bottom',
    sw: 'bottom left',
    w: 'left',
    nw: 'top left'
  }
  return labels[handle]
}
