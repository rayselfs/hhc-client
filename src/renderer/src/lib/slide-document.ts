import {
  SLIDE_DOCUMENT_VERSION,
  type SlideBackground,
  type SlideDocument,
  type SlideElement,
  type SlideImageElement,
  type SlideRecord,
  type SlideSize,
  type SlideTextElement,
  type SlideTextStyle,
  type SlideTheme
} from '@shared/types/slides'

export const DEFAULT_SLIDE_SIZE: SlideSize = { width: 1920, height: 1080 }

export const DEFAULT_SLIDE_THEME: SlideTheme = {
  id: 'default-dark',
  name: 'Default Dark',
  fontFamily: 'Inter Variable',
  textColor: '#ffffff',
  backgroundColor: '#050505',
  accentColor: '#0ea5e9'
}

const DEFAULT_TEXT_STYLE: SlideTextStyle = {
  fontFamily: DEFAULT_SLIDE_THEME.fontFamily,
  fontSize: 72,
  fontWeight: 700,
  color: DEFAULT_SLIDE_THEME.textColor,
  align: 'center',
  lineHeight: 1.15
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `slide-${Date.now()}-${Math.random()}`
}

function now(): number {
  return Date.now()
}

function defaultBackground(theme: SlideTheme): SlideBackground {
  return { type: 'color', color: theme.backgroundColor }
}

function sortElements(elements: SlideElement[]): SlideElement[] {
  return [...elements].sort((a, b) => a.zIndex - b.zIndex)
}

export function createBlankSlide(
  input: Partial<Pick<SlideRecord, 'title' | 'background'>> = {}
): SlideRecord {
  return {
    id: createId(),
    title: input.title ?? 'Untitled Slide',
    background: input.background ?? defaultBackground(DEFAULT_SLIDE_THEME),
    elements: []
  }
}

export function createSlideDocument(
  input: Partial<Pick<SlideDocument, 'title' | 'size' | 'theme' | 'slides'>> = {}
): SlideDocument {
  const createdAt = now()
  const theme = input.theme ?? DEFAULT_SLIDE_THEME
  const slides = input.slides && input.slides.length > 0 ? input.slides : [createBlankSlide()]
  return {
    id: createId(),
    version: SLIDE_DOCUMENT_VERSION,
    title: input.title ?? 'Untitled Slide Deck',
    size: input.size ?? DEFAULT_SLIDE_SIZE,
    theme,
    slides,
    createdAt,
    updatedAt: createdAt
  }
}

export function createTextElement(
  input: Partial<Omit<SlideTextElement, 'id' | 'type' | 'style'>> & {
    text: string
    style?: Partial<SlideTextStyle>
  }
): SlideTextElement {
  return {
    id: createId(),
    type: 'text',
    text: input.text,
    x: input.x ?? 240,
    y: input.y ?? 360,
    width: input.width ?? 1440,
    height: input.height ?? 240,
    rotation: input.rotation ?? 0,
    opacity: input.opacity ?? 1,
    zIndex: input.zIndex ?? 0,
    style: { ...DEFAULT_TEXT_STYLE, ...input.style }
  }
}

export function createImageElement(
  input: Partial<Omit<SlideImageElement, 'id' | 'type'>> & {
    mediaId: string
  }
): SlideImageElement {
  return {
    id: createId(),
    type: 'image',
    mediaId: input.mediaId,
    alt: input.alt ?? '',
    fit: input.fit ?? 'contain',
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width ?? DEFAULT_SLIDE_SIZE.width,
    height: input.height ?? DEFAULT_SLIDE_SIZE.height,
    rotation: input.rotation ?? 0,
    opacity: input.opacity ?? 1,
    zIndex: input.zIndex ?? 0
  }
}

export function upsertSlideElement(slide: SlideRecord, element: SlideElement): SlideRecord {
  const existingIndex = slide.elements.findIndex((item) => item.id === element.id)
  const elements =
    existingIndex >= 0
      ? slide.elements.map((item) => (item.id === element.id ? element : item))
      : [...slide.elements, element]
  return { ...slide, elements: sortElements(elements) }
}

export function removeSlideElement(slide: SlideRecord, elementId: string): SlideRecord {
  return {
    ...slide,
    elements: slide.elements.filter((element) => element.id !== elementId)
  }
}

export function updateSlideInDocument(
  document: SlideDocument,
  slideId: string,
  updater: (slide: SlideRecord) => SlideRecord
): SlideDocument {
  const slides = document.slides.map((slide) => (slide.id === slideId ? updater(slide) : slide))
  return {
    ...document,
    slides,
    updatedAt: now()
  }
}

export function reorderSlides(
  document: SlideDocument,
  fromIndex: number,
  toIndex: number
): SlideDocument {
  if (fromIndex === toIndex) return document
  if (fromIndex < 0 || fromIndex >= document.slides.length) return document
  const clampedTo = Math.max(0, Math.min(toIndex, document.slides.length - 1))
  const slides = [...document.slides]
  const [slide] = slides.splice(fromIndex, 1)
  if (!slide) return document
  slides.splice(clampedTo, 0, slide)
  return {
    ...document,
    slides,
    updatedAt: now()
  }
}

export function getSlideById(document: SlideDocument, slideId: string): SlideRecord | null {
  return document.slides.find((slide) => slide.id === slideId) ?? null
}
