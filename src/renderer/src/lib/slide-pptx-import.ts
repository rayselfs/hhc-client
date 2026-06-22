import JSZip from 'jszip'
import {
  createBlankSlide,
  createSlideDocument,
  createTextElement,
  upsertSlideElement
} from '@renderer/lib/slide-document'
import type { SlideDocument, SlideRecord } from '@shared/types/slides'

export interface ImportPptxOptions {
  title?: string
}

function getSlideNumber(path: string): number {
  const match = /slide(\d+)\.xml$/i.exec(path)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

function extractTextFromSlideXml(xmlText: string): string {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  const textNodes = Array.from(doc.getElementsByTagName('*')).filter(
    (node) => node.localName === 't'
  )
  return textNodes
    .map((node) => node.textContent?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
}

function createImportedSlide(xmlText: string, index: number): SlideRecord {
  const text = extractTextFromSlideXml(xmlText)
  const slide = createBlankSlide({ title: `Slide ${index + 1}` })
  if (!text) return slide
  return upsertSlideElement(
    slide,
    createTextElement({
      text,
      y: 320,
      height: 440,
      style: { fontSize: 68 }
    })
  )
}

export async function importPptxSlideDocument(
  input: ArrayBuffer,
  options: ImportPptxOptions = {}
): Promise<SlideDocument> {
  const zip = await JSZip.loadAsync(input)
  const slideFiles = Object.values(zip.files)
    .filter((entry) => !entry.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(entry.name))
    .sort((a, b) => getSlideNumber(a.name) - getSlideNumber(b.name))

  if (slideFiles.length === 0) {
    throw new Error('No slides found in PPTX file')
  }

  const slides = await Promise.all(
    slideFiles.map(async (entry, index) => createImportedSlide(await entry.async('text'), index))
  )

  return createSlideDocument({
    title: options.title ?? 'Imported PPTX',
    slides
  })
}
