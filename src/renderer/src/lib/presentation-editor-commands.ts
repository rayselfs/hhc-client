import type {
  EditablePresentationDocument,
  EditablePresentationElement,
  EditablePresentationSlide
} from './editable-presentation'

export interface EditorBounds {
  x: number
  y: number
  width: number
  height: number
}

export type ElementAlignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
export type ElementDistribution = 'horizontal' | 'vertical'

export interface SnappedElementPosition {
  x: number
  y: number
  verticalGuide?: number
  horizontalGuide?: number
}

export function reorderSelectedSlides(
  document: EditablePresentationDocument,
  selectedSlideIds: string[],
  targetIndex: number
): EditablePresentationDocument {
  const selected = new Set(selectedSlideIds)
  const moving = document.slideOrder.filter((slideId) => selected.has(slideId))
  if (moving.length === 0) return document

  const boundedTarget = Math.max(0, Math.min(document.slideOrder.length, targetIndex))
  const removedBeforeTarget = document.slideOrder
    .slice(0, boundedTarget)
    .filter((slideId) => selected.has(slideId)).length
  const remaining = document.slideOrder.filter((slideId) => !selected.has(slideId))
  const insertionIndex = Math.max(
    0,
    Math.min(remaining.length, boundedTarget - removedBeforeTarget)
  )
  const slideOrder = [
    ...remaining.slice(0, insertionIndex),
    ...moving,
    ...remaining.slice(insertionIndex)
  ]
  if (slideOrder.every((slideId, index) => slideId === document.slideOrder[index])) return document
  return { ...document, slideOrder, updatedAt: Date.now() }
}

export function selectElementsInBounds(
  slide: EditablePresentationSlide,
  bounds: EditorBounds
): string[] {
  const right = bounds.x + bounds.width
  const bottom = bounds.y + bounds.height
  return slide.elementOrder.filter((elementId) => {
    const element = slide.elements[elementId]
    if (!element || element.locked) return false
    return (
      element.x < right &&
      element.x + element.width > bounds.x &&
      element.y < bottom &&
      element.y + element.height > bounds.y
    )
  })
}

export function nudgeElements(
  document: EditablePresentationDocument,
  slideId: string,
  elementIds: string[],
  dx: number,
  dy: number
): EditablePresentationDocument {
  const elements = getElements(document, slideId, elementIds)
  if (elements.length === 0) return document
  const bounds = getCollectiveBounds(elements)
  const boundedDx = Math.max(-bounds.x, Math.min(document.width - (bounds.x + bounds.width), dx))
  const boundedDy = Math.max(-bounds.y, Math.min(document.height - (bounds.y + bounds.height), dy))
  if (boundedDx === 0 && boundedDy === 0) return document
  return patchElements(document, slideId, elementIds, (element) => ({
    ...element,
    x: element.x + boundedDx,
    y: element.y + boundedDy
  }))
}

export function alignElements(
  document: EditablePresentationDocument,
  slideId: string,
  elementIds: string[],
  alignment: ElementAlignment
): EditablePresentationDocument {
  const elements = getElements(document, slideId, elementIds)
  if (elements.length < 2) return document
  const bounds = getCollectiveBounds(elements)
  return patchElements(document, slideId, elementIds, (element) => {
    if (alignment === 'left') return { ...element, x: bounds.x }
    if (alignment === 'center')
      return { ...element, x: bounds.x + (bounds.width - element.width) / 2 }
    if (alignment === 'right') return { ...element, x: bounds.x + bounds.width - element.width }
    if (alignment === 'top') return { ...element, y: bounds.y }
    if (alignment === 'middle')
      return { ...element, y: bounds.y + (bounds.height - element.height) / 2 }
    return { ...element, y: bounds.y + bounds.height - element.height }
  })
}

export function distributeElements(
  document: EditablePresentationDocument,
  slideId: string,
  elementIds: string[],
  distribution: ElementDistribution
): EditablePresentationDocument {
  const elements = getElements(document, slideId, elementIds)
  if (elements.length < 3) return document
  const axis = distribution === 'horizontal' ? 'x' : 'y'
  const size = distribution === 'horizontal' ? 'width' : 'height'
  const sorted = [...elements].sort(
    (left, right) => left[axis] + left[size] / 2 - (right[axis] + right[size] / 2)
  )
  const firstCenter = sorted[0][axis] + sorted[0][size] / 2
  const last = sorted[sorted.length - 1]
  const lastCenter = last[axis] + last[size] / 2
  const spacing = (lastCenter - firstCenter) / (sorted.length - 1)
  const positions = new Map(
    sorted.map((element, index) => [element.id, firstCenter + spacing * index - element[size] / 2])
  )
  return patchElements(document, slideId, elementIds, (element) => ({
    ...element,
    [axis]: positions.get(element.id) ?? element[axis]
  }))
}

export function snapElementPosition(
  element: Pick<EditablePresentationElement, 'x' | 'y' | 'width' | 'height'>,
  slide: { width: number; height: number },
  tolerance: number
): SnappedElementPosition {
  const vertical = findSnap(
    [
      { distance: element.x, position: 0, value: 0 },
      {
        distance: element.x + element.width / 2 - slide.width / 2,
        position: slide.width / 2,
        value: slide.width / 2 - element.width / 2
      },
      {
        distance: element.x + element.width - slide.width,
        position: slide.width,
        value: slide.width - element.width
      }
    ],
    tolerance
  )
  const horizontal = findSnap(
    [
      { distance: element.y, position: 0, value: 0 },
      {
        distance: element.y + element.height / 2 - slide.height / 2,
        position: slide.height / 2,
        value: slide.height / 2 - element.height / 2
      },
      {
        distance: element.y + element.height - slide.height,
        position: slide.height,
        value: slide.height - element.height
      }
    ],
    tolerance
  )
  return {
    x: vertical?.value ?? element.x,
    y: horizontal?.value ?? element.y,
    ...(vertical ? { verticalGuide: vertical.position } : {}),
    ...(horizontal ? { horizontalGuide: horizontal.position } : {})
  }
}

function getElements(
  document: EditablePresentationDocument,
  slideId: string,
  elementIds: string[]
): EditablePresentationElement[] {
  const slide = document.slides[slideId]
  if (!slide) return []
  const selected = new Set(elementIds)
  return slide.elementOrder
    .filter((elementId) => selected.has(elementId))
    .map((elementId) => slide.elements[elementId])
    .filter((element): element is EditablePresentationElement =>
      Boolean(element && !element.locked)
    )
}

function getCollectiveBounds(elements: EditablePresentationElement[]): EditorBounds {
  const left = Math.min(...elements.map((element) => element.x))
  const top = Math.min(...elements.map((element) => element.y))
  const right = Math.max(...elements.map((element) => element.x + element.width))
  const bottom = Math.max(...elements.map((element) => element.y + element.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

function patchElements(
  document: EditablePresentationDocument,
  slideId: string,
  elementIds: string[],
  patch: (element: EditablePresentationElement) => EditablePresentationElement
): EditablePresentationDocument {
  const slide = document.slides[slideId]
  if (!slide) return document
  const selected = new Set(elementIds)
  const elements = { ...slide.elements }
  let changed = false
  for (const elementId of slide.elementOrder) {
    const element = elements[elementId]
    if (!element || element.locked || !selected.has(elementId)) continue
    elements[elementId] = patch(element)
    changed = true
  }
  if (!changed) return document
  return {
    ...document,
    slides: {
      ...document.slides,
      [slideId]: { ...slide, elements }
    },
    updatedAt: Date.now()
  }
}

function findSnap(
  candidates: Array<{ distance: number; position: number; value: number }>,
  tolerance: number
): { position: number; value: number } | undefined {
  return candidates
    .filter((candidate) => Math.abs(candidate.distance) <= tolerance)
    .sort((left, right) => Math.abs(left.distance) - Math.abs(right.distance))[0]
}
