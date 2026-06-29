import { getBlobId } from './blob-identity'
import { openFileExplorerDB } from './file-explorer-db'
import { getDerivedAsset, putDerivedAsset } from './media-work-db'
import { EDITABLE_PRESENTATION_MIME_TYPE } from './presentation-media'
import { readPresentationArrayBuffer } from './presentation-source'
import { saveThumbnail } from './thumbnail-db'
import { useFileExplorerStore } from '@renderer/stores/file-explorer'
import type { FileItemRecord } from '@shared/types/folder'
import type { PresentationData } from '@aiden0z/pptx-renderer'
import type { SlideData, SlideNode } from '@aiden0z/pptx-renderer'
import type { PicNodeData, ShapeNodeData } from '@aiden0z/pptx-renderer'

export const EDITABLE_PRESENTATION_DOCUMENT_KIND = 'editable-presentation-document'

export type EditablePresentationElementType = 'text' | 'image' | 'shape' | 'line' | 'locked'
export type EditableTextAlign = 'left' | 'center' | 'right'
export type EditableShapeKind = 'rectangle' | 'ellipse'
export type EditableGradientDirection = 'left-right' | 'top-bottom' | 'diagonal'
export type EditableGradientType = 'linear'
export type EditableImageShadow = 'none' | 'soft' | 'medium'

export interface EditableGradientStop {
  color: string
  position: number
  transparency: number
  brightness: number
}

export type EditableSlideBackground =
  | { type: 'solid'; color: string; transparency: number }
  | {
      type: 'gradient'
      gradientType: EditableGradientType
      direction: EditableGradientDirection
      angle: number
      stops: EditableGradientStop[]
    }
  | { type: 'gradient'; from: string; to: string; direction: EditableGradientDirection }
  | { type: 'color'; color: string }

export interface EditablePresentationAsset {
  id: string
  name: string
  mimeType: string
  dataUrl: string
}

interface EditableElementBase {
  id: string
  type: EditablePresentationElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked?: boolean
}

export interface EditableTextElement extends EditableElementBase {
  type: 'text'
  autoWidth?: boolean
  text: string
  fontFamily: string
  fontSize: number
  bold: boolean
  italic: boolean
  underline: boolean
  color: string
  align: EditableTextAlign
  lineHeight: number
}

export interface EditableImageElement extends EditableElementBase {
  type: 'image'
  assetId: string
  crop?: { top: number; right: number; bottom: number; left: number }
  borderColor?: string
  borderWidth?: number
  shadow?: EditableImageShadow
}

export interface EditableShapeElement extends EditableElementBase {
  type: 'shape'
  shape: EditableShapeKind
  fillColor: string
  strokeColor: string
  strokeWidth: number
}

export interface EditableLineElement extends EditableElementBase {
  type: 'line'
  strokeColor: string
  strokeWidth: number
}

export interface EditableLockedElement extends EditableElementBase {
  type: 'locked'
  label: string
}

export type EditablePresentationElement =
  | EditableTextElement
  | EditableImageElement
  | EditableShapeElement
  | EditableLineElement
  | EditableLockedElement

export interface EditablePresentationSlide {
  id: string
  name: string
  background: EditableSlideBackground
  elementOrder: string[]
  elements: Record<string, EditablePresentationElement>
  notes: string
}

export interface EditablePresentationDocument {
  id: string
  name: string
  sourceItemId?: string
  sourceBlobId?: string
  width: number
  height: number
  defaultSlideBackground?: EditableSlideBackground
  slideOrder: string[]
  slides: Record<string, EditablePresentationSlide>
  assets: Record<string, EditablePresentationAsset>
  createdAt: number
  updatedAt: number
}

type EditablePresentationSource = Pick<FileItemRecord, 'id' | 'url' | 'name'>

const DEFAULT_WIDTH = 1920
const DEFAULT_HEIGHT = 1080
const DEFAULT_FONT_FAMILY = 'Inter Variable'
export const DEFAULT_SLIDE_BACKGROUND_COLOR = '#ffffff'
const DEFAULT_FOREGROUND_COLOR = '#111827'

export const DEFAULT_GRADIENT_BACKGROUND: Extract<
  EditableSlideBackground,
  { type: 'gradient'; stops: EditableGradientStop[] }
> = {
  type: 'gradient',
  gradientType: 'linear',
  direction: 'top-bottom',
  angle: 180,
  stops: [
    { color: DEFAULT_SLIDE_BACKGROUND_COLOR, position: 0, transparency: 0, brightness: 0 },
    { color: '#dbeafe', position: 100, transparency: 0, brightness: 0 }
  ]
}

export function createDefaultSlideBackground(): EditableSlideBackground {
  return { type: 'solid', color: DEFAULT_SLIDE_BACKGROUND_COLOR, transparency: 0 }
}

export function normalizeSlideBackground(
  background: EditableSlideBackground | undefined
): EditableSlideBackground {
  if (!background) return createDefaultSlideBackground()
  if (background.type === 'color')
    return { type: 'solid', color: background.color, transparency: 0 }
  if (background.type === 'solid')
    return { ...background, transparency: background.transparency ?? 0 }
  if ('from' in background) {
    return {
      type: 'gradient',
      gradientType: 'linear',
      direction: background.direction,
      angle: getGradientAngleFromDirection(background.direction),
      stops: [
        { color: background.from, position: 0, transparency: 0, brightness: 0 },
        { color: background.to, position: 100, transparency: 0, brightness: 0 }
      ]
    }
  }
  return background
}

export function cloneSlideBackground(background: EditableSlideBackground): EditableSlideBackground {
  const normalized = normalizeSlideBackground(background)
  if (normalized.type === 'gradient' && 'stops' in normalized) {
    return { ...normalized, stops: normalized.stops.map((stop) => ({ ...stop })) }
  }
  if (normalized.type === 'solid') return { ...normalized }
  return { ...normalized }
}

export function getGradientAngleFromDirection(direction: EditableGradientDirection): number {
  return {
    'left-right': 90,
    'top-bottom': 180,
    diagonal: 135
  }[direction]
}

export function getSortedGradientStops(stops: EditableGradientStop[]): EditableGradientStop[] {
  return [...stops]
    .map((stop) => ({
      color: stop.color,
      position: clampPercentage(stop.position),
      transparency: clampPercentage(stop.transparency),
      brightness: Math.max(-100, Math.min(100, stop.brightness))
    }))
    .sort((a, b) => a.position - b.position)
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function colorWithTransparency(color: string, transparency: number): string {
  const rgb = parseHexColor(color)
  if (!rgb) return color
  const opacity = 1 - clampPercentage(transparency) / 100
  const blend = (value: number): number => Math.round(value * opacity + 255 * (1 - opacity))
  return rgbToHex(blend(rgb.red), blend(rgb.green), blend(rgb.blue))
}

function applyBrightness(color: string, brightness: number): string {
  const rgb = parseHexColor(color)
  if (!rgb || brightness === 0) return color
  const amount = Math.max(-100, Math.min(100, brightness)) / 100
  const adjust = (value: number): number => {
    const next = amount >= 0 ? value + (255 - value) * amount : value * (1 + amount)
    return Math.round(Math.max(0, Math.min(255, next)))
  }
  return rgbToHex(adjust(rgb.red), adjust(rgb.green), adjust(rgb.blue))
}

function parseHexColor(color: string): { red: number; green: number; blue: number } | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color.trim())
  if (!match) return null
  return {
    red: parseInt(match[1], 16),
    green: parseInt(match[2], 16),
    blue: parseInt(match[3], 16)
  }
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

export function getSlideBackgroundPrimaryColor(background: EditableSlideBackground): string {
  const normalized = normalizeSlideBackground(background)
  if (normalized.type !== 'gradient') return normalized.color
  if ('stops' in normalized) return normalized.stops[0]?.color ?? '#ffffff'
  return normalized.from
}

export function getSlideBackgroundCss(background: EditableSlideBackground): string {
  const normalized = normalizeSlideBackground(background)
  if (normalized.type !== 'gradient') {
    if (normalized.type !== 'solid') return DEFAULT_SLIDE_BACKGROUND_COLOR
    return colorWithTransparency(normalized.color, normalized.transparency)
  }
  const modern = 'stops' in normalized ? normalized : normalizeSlideBackground(normalized)
  if (modern.type !== 'gradient' || !('stops' in modern)) return '#ffffff'
  const stops = getSortedGradientStops(modern.stops)
    .map(
      (stop) =>
        `${colorWithTransparency(applyBrightness(stop.color, stop.brightness), stop.transparency)} ${stop.position}%`
    )
    .join(', ')
  return `linear-gradient(${modern.angle}deg, ${stops})`
}

export function getEditablePresentationDocumentVariant(itemId: string): string {
  return `document:${itemId}`
}

export function createBlankEditablePresentationDocument(
  name: string,
  id = crypto.randomUUID()
): EditablePresentationDocument {
  const slideId = crypto.randomUUID()
  const now = Date.now()
  return {
    id,
    name,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    defaultSlideBackground: createDefaultSlideBackground(),
    slideOrder: [slideId],
    slides: {
      [slideId]: {
        id: slideId,
        name: 'Slide 1',
        background: createDefaultSlideBackground(),
        elementOrder: [],
        elements: {},
        notes: ''
      }
    },
    assets: {},
    createdAt: now,
    updatedAt: now
  }
}

export function createTextElement(
  input: Partial<Omit<EditableTextElement, 'id' | 'type'>> = {}
): EditableTextElement {
  const fontSize = input.fontSize ?? 64
  const lineHeight = input.lineHeight ?? 1.15
  return {
    id: crypto.randomUUID(),
    type: 'text',
    autoWidth: input.autoWidth ?? input.width == null,
    x: input.x ?? 260,
    y: input.y ?? 220,
    width: input.width ?? 220,
    height: input.height ?? Math.ceil(fontSize * lineHeight),
    rotation: input.rotation ?? 0,
    opacity: input.opacity ?? 1,
    text: input.text ?? '',
    fontFamily: input.fontFamily ?? DEFAULT_FONT_FAMILY,
    fontSize,
    bold: input.bold ?? false,
    italic: input.italic ?? false,
    underline: input.underline ?? false,
    color: input.color ?? DEFAULT_FOREGROUND_COLOR,
    align: input.align ?? 'left',
    lineHeight
  }
}

export function createShapeElement(
  shape: EditableShapeKind,
  input: Partial<Omit<EditableShapeElement, 'id' | 'type' | 'shape'>> = {}
): EditableShapeElement {
  return {
    id: crypto.randomUUID(),
    type: 'shape',
    shape,
    x: input.x ?? 360,
    y: input.y ?? 280,
    width: input.width ?? 360,
    height: input.height ?? 220,
    rotation: input.rotation ?? 0,
    opacity: input.opacity ?? 1,
    fillColor: input.fillColor ?? '#2563eb',
    strokeColor: input.strokeColor ?? DEFAULT_FOREGROUND_COLOR,
    strokeWidth: input.strokeWidth ?? 0
  }
}

export function createLineElement(
  input: Partial<Omit<EditableLineElement, 'id' | 'type'>> = {}
): EditableLineElement {
  return {
    id: crypto.randomUUID(),
    type: 'line',
    x: input.x ?? 360,
    y: input.y ?? 360,
    width: input.width ?? 520,
    height: input.height ?? 0,
    rotation: input.rotation ?? 0,
    opacity: input.opacity ?? 1,
    strokeColor: input.strokeColor ?? DEFAULT_FOREGROUND_COLOR,
    strokeWidth: input.strokeWidth ?? 4
  }
}

export function addElementToSlide(
  document: EditablePresentationDocument,
  slideId: string,
  element: EditablePresentationElement
): EditablePresentationDocument {
  const slide = document.slides[slideId]
  if (!slide) return document
  return {
    ...document,
    slides: {
      ...document.slides,
      [slideId]: {
        ...slide,
        elementOrder: [...slide.elementOrder, element.id],
        elements: { ...slide.elements, [element.id]: element }
      }
    },
    updatedAt: Date.now()
  }
}

export function updateElementInSlide(
  document: EditablePresentationDocument,
  slideId: string,
  elementId: string,
  updates: Partial<EditablePresentationElement>
): EditablePresentationDocument {
  const slide = document.slides[slideId]
  const element = slide?.elements[elementId]
  if (!slide || !element) return document
  return {
    ...document,
    slides: {
      ...document.slides,
      [slideId]: {
        ...slide,
        elements: {
          ...slide.elements,
          [elementId]: { ...element, ...updates } as EditablePresentationElement
        }
      }
    },
    updatedAt: Date.now()
  }
}

export function reorderElementInSlide(
  document: EditablePresentationDocument,
  slideId: string,
  elementId: string,
  action: 'bring-forward' | 'bring-to-front' | 'send-backward' | 'send-to-back'
): EditablePresentationDocument {
  const slide = document.slides[slideId]
  if (!slide || !slide.elements[elementId]) return document
  const currentIndex = slide.elementOrder.indexOf(elementId)
  if (currentIndex === -1) return document

  const elementOrder = [...slide.elementOrder]
  elementOrder.splice(currentIndex, 1)
  const nextIndex = (() => {
    if (action === 'bring-to-front') return elementOrder.length
    if (action === 'send-to-back') return 0
    if (action === 'bring-forward') return Math.min(elementOrder.length, currentIndex + 1)
    return Math.max(0, currentIndex - 1)
  })()

  elementOrder.splice(nextIndex, 0, elementId)
  return {
    ...document,
    slides: {
      ...document.slides,
      [slideId]: {
        ...slide,
        elementOrder
      }
    },
    updatedAt: Date.now()
  }
}

export function removeElementFromSlide(
  document: EditablePresentationDocument,
  slideId: string,
  elementId: string
): EditablePresentationDocument {
  const slide = document.slides[slideId]
  if (!slide?.elements[elementId]) return document
  const { [elementId]: _removed, ...elements } = slide.elements
  return {
    ...document,
    slides: {
      ...document.slides,
      [slideId]: {
        ...slide,
        elementOrder: slide.elementOrder.filter((id) => id !== elementId),
        elements
      }
    },
    updatedAt: Date.now()
  }
}

export function duplicateElementInSlide(
  document: EditablePresentationDocument,
  slideId: string,
  elementId: string
): { document: EditablePresentationDocument; elementId: string } {
  const slide = document.slides[slideId]
  const element = slide?.elements[elementId]
  if (!slide || !element) return { document, elementId }
  const nextElement = {
    ...element,
    id: crypto.randomUUID(),
    x: element.x + 24,
    y: element.y + 24
  } as EditablePresentationElement
  return {
    document: addElementToSlide(document, slideId, nextElement),
    elementId: nextElement.id
  }
}

export function moveEditableSlide(
  document: EditablePresentationDocument,
  slideId: string,
  direction: -1 | 1
): EditablePresentationDocument {
  const index = document.slideOrder.indexOf(slideId)
  const nextIndex = index + direction
  if (index === -1 || nextIndex < 0 || nextIndex >= document.slideOrder.length) return document
  const slideOrder = [...document.slideOrder]
  const [moved] = slideOrder.splice(index, 1)
  slideOrder.splice(nextIndex, 0, moved)
  return { ...document, slideOrder, updatedAt: Date.now() }
}

export function duplicateEditableSlide(
  document: EditablePresentationDocument,
  slideId: string
): EditablePresentationDocument {
  const index = document.slideOrder.indexOf(slideId)
  if (index === -1) return document
  return duplicateEditableSlides(document, [slideId], index + 1).document
}

function cloneEditableSlide(slide: EditablePresentationSlide): {
  slide: EditablePresentationSlide
  slideId: string
} {
  const nextSlideId = crypto.randomUUID()
  const elementIdMap = new Map<string, string>()
  const elements: Record<string, EditablePresentationElement> = {}
  for (const sourceId of slide.elementOrder) {
    const element = slide.elements[sourceId]
    if (!element) continue
    const nextId = crypto.randomUUID()
    elementIdMap.set(sourceId, nextId)
    elements[nextId] = { ...element, id: nextId } as EditablePresentationElement
  }
  const nextSlide: EditablePresentationSlide = {
    ...slide,
    id: nextSlideId,
    name: `${slide.name} Copy`,
    elementOrder: slide.elementOrder
      .map((sourceId) => elementIdMap.get(sourceId))
      .filter((id): id is string => Boolean(id)),
    elements
  }
  return { slide: nextSlide, slideId: nextSlideId }
}

export function duplicateEditableSlides(
  document: EditablePresentationDocument,
  slideIds: string[],
  targetIndex: number
): { document: EditablePresentationDocument; slideIds: string[] } {
  const requestedIds = new Set(slideIds)
  const sourceIds = document.slideOrder.filter((sourceId) => requestedIds.has(sourceId))
  if (sourceIds.length === 0) return { document, slideIds: [] }

  const safeIndex = Math.max(0, Math.min(targetIndex, document.slideOrder.length))
  const slides = { ...document.slides }
  const insertedSlideIds: string[] = []

  for (const sourceId of sourceIds) {
    const sourceSlide = document.slides[sourceId]
    if (!sourceSlide) continue
    const cloned = cloneEditableSlide(sourceSlide)
    slides[cloned.slideId] = cloned.slide
    insertedSlideIds.push(cloned.slideId)
  }

  const slideOrder = [
    ...document.slideOrder.slice(0, safeIndex),
    ...insertedSlideIds,
    ...document.slideOrder.slice(safeIndex)
  ]

  return {
    document: { ...document, slideOrder, slides, updatedAt: Date.now() },
    slideIds: insertedSlideIds
  }
}

export function addBlankEditableSlide(
  document: EditablePresentationDocument
): EditablePresentationDocument {
  const slideId = crypto.randomUUID()
  const background = cloneSlideBackground(
    document.defaultSlideBackground ?? createDefaultSlideBackground()
  )
  return {
    ...document,
    slideOrder: [...document.slideOrder, slideId],
    slides: {
      ...document.slides,
      [slideId]: {
        id: slideId,
        name: `Slide ${document.slideOrder.length + 1}`,
        background,
        elementOrder: [],
        elements: {},
        notes: ''
      }
    },
    updatedAt: Date.now()
  }
}

export function insertBlankEditableSlide(
  document: EditablePresentationDocument,
  targetIndex: number
): { document: EditablePresentationDocument; slideId: string } {
  const slideId = crypto.randomUUID()
  const background = cloneSlideBackground(
    document.defaultSlideBackground ?? createDefaultSlideBackground()
  )
  const safeIndex = Math.max(0, Math.min(targetIndex, document.slideOrder.length))
  return {
    document: {
      ...document,
      slideOrder: [
        ...document.slideOrder.slice(0, safeIndex),
        slideId,
        ...document.slideOrder.slice(safeIndex)
      ],
      slides: {
        ...document.slides,
        [slideId]: {
          id: slideId,
          name: `Slide ${document.slideOrder.length + 1}`,
          background,
          elementOrder: [],
          elements: {},
          notes: ''
        }
      },
      updatedAt: Date.now()
    },
    slideId
  }
}

export function updateSlideBackground(
  document: EditablePresentationDocument,
  slideId: string,
  background: EditableSlideBackground
): EditablePresentationDocument {
  const slide = document.slides[slideId]
  if (!slide) return document
  return {
    ...document,
    slides: {
      ...document.slides,
      [slideId]: {
        ...slide,
        background: cloneSlideBackground(background)
      }
    },
    updatedAt: Date.now()
  }
}

export function applySlideBackgroundToAllSlides(
  document: EditablePresentationDocument,
  background: EditableSlideBackground
): EditablePresentationDocument {
  const normalized = cloneSlideBackground(background)
  const slides: Record<string, EditablePresentationSlide> = {}
  for (const [slideId, slide] of Object.entries(document.slides)) {
    slides[slideId] = { ...slide, background: cloneSlideBackground(normalized) }
  }
  return {
    ...document,
    defaultSlideBackground: cloneSlideBackground(normalized),
    slides,
    updatedAt: Date.now()
  }
}

export function resetSlideBackground(
  document: EditablePresentationDocument,
  slideId: string
): EditablePresentationDocument {
  return updateSlideBackground(
    document,
    slideId,
    document.defaultSlideBackground ?? createDefaultSlideBackground()
  )
}

export function removeEditableSlide(
  document: EditablePresentationDocument,
  slideId: string
): EditablePresentationDocument {
  if (document.slideOrder.length <= 1) return document
  const { [slideId]: _removed, ...slides } = document.slides
  return {
    ...document,
    slideOrder: document.slideOrder.filter((id) => id !== slideId),
    slides,
    updatedAt: Date.now()
  }
}

export function removeEditableSlides(
  document: EditablePresentationDocument,
  slideIds: string[]
): EditablePresentationDocument {
  if (document.slideOrder.length <= 1) return document
  const requestedIds = new Set(slideIds)
  if (requestedIds.size === 0) return document
  if (document.slideOrder.every((id) => requestedIds.has(id))) {
    requestedIds.delete(document.slideOrder[0])
  }
  const slideOrder = document.slideOrder.filter((id) => !requestedIds.has(id))
  const slides = Object.fromEntries(
    Object.entries(document.slides).filter(([id]) => !requestedIds.has(id))
  )
  return {
    ...document,
    slideOrder,
    slides,
    updatedAt: Date.now()
  }
}

export async function createEditablePresentation(
  name: string,
  parentId: string
): Promise<FileItemRecord> {
  const itemId = crypto.randomUUID()
  const normalizedName = name.trim() || 'Untitled Presentation'
  const document = createBlankEditablePresentationDocument(normalizedName, itemId)
  return createEditablePresentationItem(document, parentId)
}

export async function convertPptxToEditablePresentation(
  item: FileItemRecord
): Promise<FileItemRecord> {
  const buffer = await readPresentationArrayBuffer(item)
  const { parseZip, buildPresentation, materializeAllSlideNodes, RECOMMENDED_ZIP_LIMITS } =
    await import('@aiden0z/pptx-renderer')
  const files = await parseZip(buffer, RECOMMENDED_ZIP_LIMITS)
  const presentation = buildPresentation(files)
  materializeAllSlideNodes(presentation)
  const document = convertPresentationData(item, presentation)
  return createEditablePresentationItem(document, item.parentId)
}

async function createEditablePresentationItem(
  document: EditablePresentationDocument,
  parentId: string
): Promise<FileItemRecord> {
  const itemId = document.id
  const blob = createDocumentBlob(document)
  const db = await openFileExplorerDB()

  await db.put('file-blobs', {
    id: itemId,
    blob,
    size: blob.size,
    refCount: 1
  })

  const itemData: Omit<FileItemRecord, 'sortIndex' | 'createdAt' | 'expiresAt'> = {
    id: itemId,
    parentId,
    type: 'file',
    name: document.name,
    url: `blob:${itemId}`,
    size: blob.size,
    mimeType: EDITABLE_PRESENTATION_MIME_TYPE
  }
  useFileExplorerStore.getState().addItem(itemData)
  const item = useFileExplorerStore.getState().items[itemId]
  if (!item || item.type !== 'file') throw new Error('Failed to create presentation item')
  await saveEditablePresentation(item, document)
  return item
}

function convertPresentationData(
  source: FileItemRecord,
  presentation: PresentationData
): EditablePresentationDocument {
  const documentId = crypto.randomUUID()
  const now = Date.now()
  const slides: Record<string, EditablePresentationSlide> = {}
  const slideOrder: string[] = []
  const assets: Record<string, EditablePresentationAsset> = {}

  for (const slide of presentation.slides) {
    const slideId = crypto.randomUUID()
    const convertedSlide = convertSlide(slide, presentation, assets)
    slides[slideId] = {
      ...convertedSlide,
      id: slideId,
      name: `Slide ${slide.index + 1}`
    }
    slideOrder.push(slideId)
  }

  return {
    id: documentId,
    name: `${stripPresentationExtension(source.name)} Editable`,
    sourceItemId: source.id,
    sourceBlobId: getBlobId(source),
    width: presentation.width,
    height: presentation.height,
    defaultSlideBackground: createDefaultSlideBackground(),
    slideOrder,
    slides,
    assets,
    createdAt: now,
    updatedAt: now
  }
}

function convertSlide(
  slide: SlideData,
  presentation: PresentationData,
  assets: Record<string, EditablePresentationAsset>
): Omit<EditablePresentationSlide, 'id' | 'name'> {
  const elementOrder: string[] = []
  const elements: Record<string, EditablePresentationElement> = {}

  for (const node of slide.nodes) {
    const converted = convertNode(node, slide, presentation, assets)
    for (const element of converted) {
      elementOrder.push(element.id)
      elements[element.id] = element
    }
  }

  return {
    background: createDefaultSlideBackground(),
    elementOrder,
    elements,
    notes: ''
  }
}

function convertNode(
  node: SlideNode,
  slide: SlideData,
  presentation: PresentationData,
  assets: Record<string, EditablePresentationAsset>
): EditablePresentationElement[] {
  if (node.nodeType === 'shape') return convertShapeNode(node)
  if (node.nodeType === 'picture') return convertPictureNode(node, slide, presentation, assets)
  return [createLockedElement(node, `${node.nodeType} object`)]
}

function convertShapeNode(node: ShapeNodeData): EditablePresentationElement[] {
  const elements: EditablePresentationElement[] = []
  const text = getShapeText(node)
  const shape = getEditableShapeKind(node.presetGeometry)
  const fillColor = readSrgbColor(node.fill) ?? 'transparent'
  const strokeColor = readSrgbColor(node.line) ?? '#000000'
  const strokeWidth = node.line?.exists() ? 1 : 0

  if (shape && (fillColor !== 'transparent' || strokeWidth > 0)) {
    elements.push({
      id: crypto.randomUUID(),
      type: 'shape',
      shape,
      x: node.position.x,
      y: node.position.y,
      width: node.size.w,
      height: node.size.h,
      rotation: node.rotation,
      opacity: 1,
      fillColor,
      strokeColor,
      strokeWidth
    })
  }

  if (node.presetGeometry === 'line') {
    elements.push({
      id: crypto.randomUUID(),
      type: 'line',
      x: node.position.x,
      y: node.position.y,
      width: node.size.w,
      height: node.size.h,
      rotation: node.rotation,
      opacity: 1,
      strokeColor,
      strokeWidth: Math.max(1, strokeWidth)
    })
  }

  if (text) {
    const firstParagraph = node.textBody?.paragraphs[0]
    const firstRun = firstParagraph?.runs[0]
    elements.push({
      id: crypto.randomUUID(),
      type: 'text',
      autoWidth: false,
      x: node.position.x,
      y: node.position.y,
      width: node.size.w,
      height: node.size.h,
      rotation: node.rotation,
      opacity: 1,
      text,
      fontFamily: 'Inter Variable',
      fontSize: (firstRun?.properties?.numAttr('sz') ?? 3200) / 100,
      bold: firstRun?.properties?.attr('b') === '1',
      italic: firstRun?.properties?.attr('i') === '1',
      underline: Boolean(firstRun?.properties?.attr('u')),
      color: readSrgbColor(firstRun?.properties) ?? '#111827',
      align: normalizeTextAlign(firstParagraph?.properties?.attr('algn')),
      lineHeight: 1.15
    })
  }

  if (elements.length === 0) return [createLockedElement(node, 'Shape')]
  return elements
}

function convertPictureNode(
  node: PicNodeData,
  slide: SlideData,
  presentation: PresentationData,
  assets: Record<string, EditablePresentationAsset>
): EditablePresentationElement[] {
  const asset = resolvePictureAsset(node, slide, presentation, assets)
  if (!asset) return [createLockedElement(node, 'Picture')]
  return [
    {
      id: crypto.randomUUID(),
      type: 'image',
      assetId: asset.id,
      x: node.position.x,
      y: node.position.y,
      width: node.size.w,
      height: node.size.h,
      rotation: node.rotation,
      opacity: 1,
      crop: node.crop
    }
  ]
}

function resolvePictureAsset(
  node: PicNodeData,
  slide: SlideData,
  presentation: PresentationData,
  assets: Record<string, EditablePresentationAsset>
): EditablePresentationAsset | null {
  if (!node.blipEmbed) return null
  const rel = slide.rels.get(node.blipEmbed)
  if (!rel || rel.targetMode) return null
  const mediaPath = resolveRelTarget(getDirname(slide.slidePath), rel.target)
  const bytes =
    presentation.media.get(mediaPath) ??
    presentation.media.get(mediaPath.replace(/^ppt\//, '')) ??
    findMediaByBasename(presentation, mediaPath)
  if (!bytes) return null
  const assetId = crypto.randomUUID()
  const mimeType = getMimeTypeFromPath(mediaPath)
  const asset: EditablePresentationAsset = {
    id: assetId,
    name: mediaPath.split('/').at(-1) ?? 'image',
    mimeType,
    dataUrl: uint8ArrayToDataUrl(bytes, mimeType)
  }
  assets[assetId] = asset
  return asset
}

function createLockedElement(node: SlideNode, label: string): EditableLockedElement {
  return {
    id: crypto.randomUUID(),
    type: 'locked',
    x: node.position.x,
    y: node.position.y,
    width: node.size.w,
    height: node.size.h,
    rotation: node.rotation,
    opacity: 1,
    locked: true,
    label
  }
}

function getShapeText(node: ShapeNodeData): string {
  return (
    node.textBody?.paragraphs
      .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
      .join('\n')
      .trim() ?? ''
  )
}

function getEditableShapeKind(presetGeometry: string | undefined): EditableShapeKind | null {
  if (!presetGeometry || ['rect', 'roundRect'].includes(presetGeometry)) return 'rectangle'
  if (['ellipse', 'oval'].includes(presetGeometry)) return 'ellipse'
  return null
}

function normalizeTextAlign(value: string | undefined): EditableTextAlign {
  if (value === 'ctr') return 'center'
  if (value === 'r') return 'right'
  return 'left'
}

function readSrgbColor(
  node:
    | {
        child: (name: string) => {
          child: (name: string) => { attr: (name: string) => string | undefined }
        }
      }
    | undefined
): string | null {
  const value = node?.child('solidFill').child('srgbClr').attr('val')
  return value ? `#${value}` : null
}

function resolveRelTarget(basePath: string, target: string): string {
  const parts = `${basePath}/${target}`.split('/')
  const resolved: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      resolved.pop()
    } else {
      resolved.push(part)
    }
  }
  return resolved.join('/')
}

function getDirname(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

function findMediaByBasename(
  presentation: PresentationData,
  mediaPath: string
): Uint8Array | undefined {
  const basename = mediaPath.split('/').at(-1)
  if (!basename) return undefined
  for (const [key, value] of presentation.media) {
    if (key.split('/').at(-1) === basename) return value
  }
  return undefined
}

function getMimeTypeFromPath(path: string): string {
  const extension = path.split('.').at(-1)?.toLowerCase()
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'gif') return 'image/gif'
  if (extension === 'webp') return 'image/webp'
  if (extension === 'svg') return 'image/svg+xml'
  return 'image/png'
}

function uint8ArrayToDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = ''
  const chunkSize = 8192
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize))
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

function stripPresentationExtension(name: string): string {
  return name.replace(/\.(pptx|lpdeck)$/i, '')
}

export async function loadEditablePresentation(
  source: EditablePresentationSource
): Promise<EditablePresentationDocument> {
  const blobId = getBlobId(source)
  const asset = await getDerivedAsset(
    blobId,
    EDITABLE_PRESENTATION_DOCUMENT_KIND,
    getEditablePresentationDocumentVariant(source.id)
  )
  if (asset?.metadata?.presentationDocumentJson) {
    return parseEditablePresentation(asset.metadata.presentationDocumentJson)
  }
  if (asset?.blob) return parseEditablePresentation(await readBlobText(asset.blob))

  const db = await openFileExplorerDB()
  const record = await db.get('file-blobs', blobId)
  if (record?.blob) return parseEditablePresentation(await readBlobText(record.blob))

  throw new Error(`Editable presentation document is missing: ${source.id}`)
}

export async function saveEditablePresentation(
  item: Pick<FileItemRecord, 'id' | 'url'>,
  document: EditablePresentationDocument
): Promise<void> {
  const sourceBlobId = getBlobId(item)
  const nextDocument = { ...document, updatedAt: Date.now() }
  const body = JSON.stringify(nextDocument)
  const blob = new Blob([body], { type: EDITABLE_PRESENTATION_MIME_TYPE })

  await putDerivedAsset({
    sourceBlobId,
    kind: EDITABLE_PRESENTATION_DOCUMENT_KIND,
    variant: getEditablePresentationDocumentVariant(item.id),
    storage: 'indexed-db',
    mimeType: EDITABLE_PRESENTATION_MIME_TYPE,
    size: blob.size,
    status: 'ready',
    blob,
    metadata: {
      presentationDocumentJson: body
    }
  })

  const db = await openFileExplorerDB()
  const record = await db.get('file-blobs', sourceBlobId)
  await db.put('file-blobs', {
    id: sourceBlobId,
    blob,
    size: blob.size,
    refCount: record?.refCount ?? 1
  })
  const thumbnail = generateEditablePresentationThumbnail(nextDocument)
  await saveThumbnail(sourceBlobId, thumbnail)
  window.dispatchEvent(
    new CustomEvent('hhc:thumbnail-ready', {
      detail: { itemId: item.id, dataUrl: thumbnail }
    })
  )
}

export function generateEditablePresentationThumbnail(
  document: EditablePresentationDocument
): string {
  const slideId = document.slideOrder[0]
  const slide = slideId ? document.slides[slideId] : null
  const elements = slide
    ? slide.elementOrder
        .map((elementId) => slide.elements[elementId])
        .filter((element): element is EditablePresentationElement => Boolean(element))
    : []
  const body = elements.map((element) => renderElementSvg(element, document.assets)).join('')
  const background = renderBackgroundSvg(slide?.background)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${document.width}" height="${document.height}" viewBox="0 0 ${document.width} ${document.height}">${background}${body}</svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}

function renderBackgroundSvg(background: EditableSlideBackground | undefined): string {
  const normalized = normalizeSlideBackground(background)
  if (normalized.type !== 'gradient') {
    if (normalized.type !== 'solid') {
      return `<rect width="100%" height="100%" fill="${DEFAULT_SLIDE_BACKGROUND_COLOR}"/>`
    }
    return `<rect width="100%" height="100%" fill="${escapeXml(colorWithTransparency(normalized.color, normalized.transparency))}"/>`
  }
  const modern = 'stops' in normalized ? normalized : normalizeSlideBackground(normalized)
  if (modern.type !== 'gradient' || !('stops' in modern)) {
    return `<rect width="100%" height="100%" fill="${DEFAULT_SLIDE_BACKGROUND_COLOR}"/>`
  }

  const coordinates = {
    'left-right': { x1: '0%', y1: '0%', x2: '100%', y2: '0%' },
    'top-bottom': { x1: '0%', y1: '0%', x2: '0%', y2: '100%' },
    diagonal: { x1: '0%', y1: '0%', x2: '100%', y2: '100%' }
  } satisfies Record<EditableGradientDirection, { x1: string; y1: string; x2: string; y2: string }>

  const { x1, y1, x2, y2 } = coordinates[modern.direction]
  const stops = getSortedGradientStops(modern.stops)
    .map(
      (stop) =>
        `<stop offset="${stop.position}%" stop-color="${escapeXml(colorWithTransparency(applyBrightness(stop.color, stop.brightness), stop.transparency))}"/>`
    )
    .join('')
  return `<defs><linearGradient id="slide-bg" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient></defs><rect width="100%" height="100%" fill="url(#slide-bg)"/>`
}

function renderElementSvg(
  element: EditablePresentationElement,
  assets: Record<string, EditablePresentationAsset>
): string {
  const transform = `rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})`
  if (element.type === 'text') {
    return `<text x="${element.x}" y="${element.y + element.fontSize}" width="${element.width}" fill="${escapeXml(element.color)}" font-size="${element.fontSize}" font-family="${escapeXml(element.fontFamily)}" font-weight="${element.bold ? 700 : 400}" font-style="${element.italic ? 'italic' : 'normal'}" opacity="${element.opacity}" transform="${transform}">${escapeXml(element.text)}</text>`
  }
  if (element.type === 'shape') {
    if (element.shape === 'ellipse') {
      return `<ellipse cx="${element.x + element.width / 2}" cy="${element.y + element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" fill="${escapeXml(element.fillColor)}" stroke="${escapeXml(element.strokeColor)}" stroke-width="${element.strokeWidth}" opacity="${element.opacity}" transform="${transform}"/>`
    }
    return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="${escapeXml(element.fillColor)}" stroke="${escapeXml(element.strokeColor)}" stroke-width="${element.strokeWidth}" opacity="${element.opacity}" transform="${transform}"/>`
  }
  if (element.type === 'image') {
    return renderImageElementSvg(element, assets[element.assetId])
  }
  if (element.type === 'line') {
    return `<line x1="${element.x}" y1="${element.y}" x2="${element.x + element.width}" y2="${element.y + element.height}" stroke="${escapeXml(element.strokeColor)}" stroke-width="${element.strokeWidth}" opacity="${element.opacity}" transform="${transform}"/>`
  }
  return ''
}

function renderImageElementSvg(
  element: EditableImageElement,
  asset: EditablePresentationAsset | undefined
): string {
  if (!asset) return ''
  const crop = normalizeImageCrop(element.crop)
  const visibleWidth = Math.max(1, 100 - crop.left - crop.right)
  const visibleHeight = Math.max(1, 100 - crop.top - crop.bottom)
  const imageX = element.x - element.width * (crop.left / visibleWidth)
  const imageY = element.y - element.height * (crop.top / visibleHeight)
  const imageWidth = element.width * (100 / visibleWidth)
  const imageHeight = element.height * (100 / visibleHeight)
  const transform = `rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})`
  const clipId = `clip-${element.id.replaceAll(/[^a-zA-Z0-9_-]/g, '')}`
  const border =
    element.borderWidth && element.borderWidth > 0
      ? `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" fill="none" stroke="${escapeXml(element.borderColor ?? '#ffffff')}" stroke-width="${element.borderWidth}" opacity="${element.opacity}" transform="${transform}"/>`
      : ''
  const shadowFilter = getImageShadowFilter(element.shadow, element.id)
  const shadowFilterId = shadowFilter ? `filter="url(#shadow-${element.id})"` : ''

  return `${shadowFilter ?? ''}<defs><clipPath id="${clipId}"><rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}"/></clipPath></defs><image href="${escapeXml(asset.dataUrl)}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" opacity="${element.opacity}" transform="${transform}" clip-path="url(#${clipId})" ${shadowFilterId}/>${border}`
}

function normalizeImageCrop(
  crop: EditableImageElement['crop']
): NonNullable<EditableImageElement['crop']> {
  return {
    top: crop?.top ?? 0,
    right: crop?.right ?? 0,
    bottom: crop?.bottom ?? 0,
    left: crop?.left ?? 0
  }
}

function getImageShadowFilter(
  shadow: EditableImageElement['shadow'],
  elementId: string
): string | null {
  if (!shadow || shadow === 'none') return null
  const blur = shadow === 'medium' ? 12 : 8
  const offset = shadow === 'medium' ? 8 : 5
  return `<filter id="shadow-${escapeXml(elementId)}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${offset}" stdDeviation="${blur}" flood-color="#000000" flood-opacity="0.28"/></filter>`
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function createDocumentBlob(document: EditablePresentationDocument): Blob {
  return new Blob([JSON.stringify(document)], { type: EDITABLE_PRESENTATION_MIME_TYPE })
}

function parseEditablePresentation(value: string): EditablePresentationDocument {
  const parsed = JSON.parse(value) as Partial<EditablePresentationDocument>
  if (
    !parsed.id ||
    !parsed.name ||
    typeof parsed.width !== 'number' ||
    typeof parsed.height !== 'number' ||
    !Array.isArray(parsed.slideOrder) ||
    typeof parsed.slides !== 'object' ||
    !parsed.slides
  ) {
    throw new Error('Invalid editable presentation document')
  }
  const slides: Record<string, EditablePresentationSlide> = {}
  for (const [slideId, slide] of Object.entries(
    parsed.slides as Record<string, EditablePresentationSlide>
  )) {
    slides[slideId] = {
      ...slide,
      background: normalizeSlideBackground(slide.background)
    }
  }
  return {
    id: parsed.id,
    name: parsed.name,
    sourceItemId: parsed.sourceItemId,
    sourceBlobId: parsed.sourceBlobId,
    width: parsed.width,
    height: parsed.height,
    slideOrder: parsed.slideOrder,
    slides,
    assets: parsed.assets ?? {},
    createdAt: parsed.createdAt ?? Date.now(),
    updatedAt: parsed.updatedAt ?? Date.now()
  }
}

function readBlobText(blob: Blob): Promise<string> {
  if ('text' in blob && typeof blob.text === 'function') return blob.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to read editable presentation document'))
    reader.readAsText(blob)
  })
}
