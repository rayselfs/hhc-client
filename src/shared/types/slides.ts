export const SLIDE_DOCUMENT_VERSION = 1

export interface SlideSize {
  width: number
  height: number
}

export interface SlideTheme {
  id: string
  name: string
  fontFamily: string
  textColor: string
  backgroundColor: string
  accentColor: string
}

export type SlideBackground =
  | { type: 'color'; color: string }
  | { type: 'image'; mediaId: string; fit: 'cover' | 'contain' | 'fill' }

export interface SlideElementBase {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  zIndex: number
}

export interface SlideTextStyle {
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  align: 'left' | 'center' | 'right'
  lineHeight: number
}

export interface SlideTextElement extends SlideElementBase {
  type: 'text'
  text: string
  style: SlideTextStyle
}

export interface SlideImageElement extends SlideElementBase {
  type: 'image'
  mediaId: string
  alt: string
  fit: 'cover' | 'contain' | 'fill'
}

export type SlideElement = SlideTextElement | SlideImageElement

export interface SlideRecord {
  id: string
  title: string
  background: SlideBackground
  elements: SlideElement[]
  notes?: string
}

export interface SlideDocument {
  id: string
  version: typeof SLIDE_DOCUMENT_VERSION
  title: string
  size: SlideSize
  theme: SlideTheme
  slides: SlideRecord[]
  createdAt: number
  updatedAt: number
}
