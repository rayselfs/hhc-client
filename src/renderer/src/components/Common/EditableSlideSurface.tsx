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
  cropElementId?: string | null
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
  mode: 'move' | 'resize' | 'crop'
  handle?: ResizeHandle
  startX: number
  startY: number
  original: EditablePresentationElement
}

type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const TEXT_MIN_WIDTH = 60
const TEXT_MIN_HEIGHT = 24
const MIN_ELEMENT_SIZE = 20
const MAX_CROP_TOTAL = 95

const IMAGE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const TEXT_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export default function EditableSlideSurface({
  document,
  slideId,
  editable = false,
  showBorder = false,
  selectedElementId = null,
  editingElementId = null,
  cropElementId = null,
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
    mode: DragState['mode'],
    handle?: ResizeHandle
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
    onSelectElement?.(element.id)
    event.currentTarget.setPointerCapture?.(event.pointerId)
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
    } else if (drag.mode === 'crop' && drag.original.type === 'image' && drag.handle) {
      onUpdateElement?.(slideId, drag.elementId, {
        crop: calculateImageCrop(drag.original.crop, drag.handle, dx, dy, drag.original)
      } as Partial<EditablePresentationElement>)
    } else if (drag.original.type === 'text' && drag.handle) {
      onUpdateElement?.(slideId, drag.elementId, {
        ...calculateTextResize(drag.original, drag.handle, dx, dy),
        autoWidth: false
      } as Partial<EditablePresentationElement>)
    } else if (drag.original.type === 'image' && drag.handle) {
      onUpdateElement?.(
        slideId,
        drag.elementId,
        calculateImageResize(
          drag.original,
          drag.handle,
          dx,
          dy
        ) as Partial<EditablePresentationElement>
      )
    } else {
      onUpdateElement?.(slideId, drag.elementId, {
        width: Math.max(MIN_ELEMENT_SIZE, drag.original.width + dx),
        height: Math.max(MIN_ELEMENT_SIZE, drag.original.height + dy)
      } as Partial<EditablePresentationElement>)
    }
  }

  const endDrag = (event: React.PointerEvent): void => {
    if (!dragRef.current) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
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
            cropMode={element.id === cropElementId}
            selected={element.id === selectedElementId}
            onSelect={() => onSelectElement?.(element.id)}
            onPointerDown={(event) => startDrag(event, element, 'move')}
            onPointerMove={updateDrag}
            onPointerUp={endDrag}
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
  onSelect,
  onPointerDown,
  onPointerMove,
  onPointerUp,
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
        <ElementHandles
          element={element}
          cropMode={cropMode}
          onResizePointerDown={onResizePointerDown}
          onCropPointerDown={onCropPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
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
  onPointerUp
}: {
  element: EditablePresentationElement
  cropMode: boolean
  onResizePointerDown: (event: React.PointerEvent, handle: ResizeHandle) => void
  onCropPointerDown: (event: React.PointerEvent, handle: ResizeHandle) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: (event: React.PointerEvent) => void
}): React.JSX.Element {
  if (element.type === 'text') {
    return (
      <>
        {TEXT_HANDLES.map((handle) => (
          <button
            key={`resize-text-${handle}`}
            type="button"
            className={`${getHandlePositionClass(handle)} ${getHandleCursorClass(handle)} absolute size-3 rounded-[2px] border border-white bg-primary`}
            aria-label={`Resize text box ${handleToLabel(handle)}`}
            onPointerDown={(event) => onResizePointerDown(event, handle)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
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
  const hasNorth = handle.includes('n')
  const hasSouth = handle.includes('s')

  const width = Math.max(TEXT_MIN_WIDTH, element.width + (hasEast ? dx : hasWest ? -dx : 0))
  const height = Math.max(TEXT_MIN_HEIGHT, element.height + (hasSouth ? dy : hasNorth ? -dy : 0))

  return {
    x: hasWest ? element.x + (element.width - width) : element.x,
    y: hasNorth ? element.y + (element.height - height) : element.y,
    width,
    height
  } as Partial<EditablePresentationElement>
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
  const isComposingRef = useRef(false)
  const initializedEditingElementRef = useRef<string | null>(null)
  const blurFrameRef = useRef<number | null>(null)

  const fitToText = (text: string): Partial<EditablePresentationElement> => {
    const updates = measureTextElement(contentRef.current, element, document.width, text)
    if (!updates) return { text } as Partial<EditablePresentationElement>
    return { text, ...updates } as Partial<EditablePresentationElement>
  }

  const commitText = (text: string): void => {
    onUpdateElement?.(slideId, element.id, fitToText(text))
  }

  const focusEditableContent = (content: HTMLDivElement): void => {
    content.focus()
    const selection = window.getSelection()
    if (!selection) return
    const range = window.document.createRange()
    range.selectNodeContents(content)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  useLayoutEffect(() => {
    if (!editable || editing || element.locked || !onUpdateElement) return
    const updates = measureTextElement(contentRef.current, element, document.width, element.text)
    if (!updates) return
    onUpdateElement(slideId, element.id, updates)
  }, [document.width, editable, editing, element, onUpdateElement, slideId])

  useLayoutEffect(() => {
    if (!editing || element.locked) return
    const content = contentRef.current
    if (!content) return
    if (initializedEditingElementRef.current === element.id) return
    initializedEditingElementRef.current = element.id
    content.textContent = element.text
    focusEditableContent(content)
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
      onPointerDown={(event) => editing && event.stopPropagation()}
      onDoubleClick={(event) => {
        if (!editable || element.locked) return
        event.stopPropagation()
        onStartTextEdit?.()
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
      {editing ? null : element.text}
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
