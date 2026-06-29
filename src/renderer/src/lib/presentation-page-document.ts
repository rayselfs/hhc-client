import { getBlobId } from './blob-identity'
import { getDerivedAsset, putDerivedAsset } from './media-work-db'
import type { FileItemRecord } from '@shared/types/folder'

export const PRESENTATION_PAGE_DOCUMENT_KIND = 'presentation-page-document'

export interface PresentationPageRef {
  id: string
  sourceItemId: string
  sourceBlobId: string
  sourceSlideIndex: number
  copiedFrom?: {
    documentId: string
    pageId: string
  }
}

export interface PresentationPageDocument {
  id: string
  sourceItemId: string
  sourceBlobId: string
  slideOrder: string[]
  pages: Record<string, PresentationPageRef>
  notesByPageId: Record<string, string>
  rendererWarnings: string[]
  createdAt: number
  updatedAt: number
}

type PresentationDocumentSource = Pick<FileItemRecord, 'id' | 'url'>

export function getPresentationPageDocumentVariant(sourceItemId: string): string {
  return `document:${sourceItemId}`
}

export async function getPresentationPageDocument(
  source: PresentationDocumentSource
): Promise<PresentationPageDocument | null> {
  const sourceBlobId = getBlobId(source)
  const asset = await getDerivedAsset(
    sourceBlobId,
    PRESENTATION_PAGE_DOCUMENT_KIND,
    getPresentationPageDocumentVariant(source.id)
  )
  if (!asset?.blob) return null
  if (asset.metadata?.presentationDocumentJson) {
    return parsePresentationPageDocument(asset.metadata.presentationDocumentJson)
  }
  return parsePresentationPageDocument(await readBlobText(asset.blob))
}

export async function ensurePresentationPageDocument(
  source: PresentationDocumentSource,
  slideCount: number,
  rendererWarnings: string[] = []
): Promise<PresentationPageDocument> {
  const existing = await getPresentationPageDocument(source)
  const sourceBlobId = getBlobId(source)
  const now = Date.now()

  const document: PresentationPageDocument =
    existing ??
    ({
      id: crypto.randomUUID(),
      sourceItemId: source.id,
      sourceBlobId,
      slideOrder: [],
      pages: {},
      notesByPageId: {},
      rendererWarnings: [],
      createdAt: now,
      updatedAt: now
    } satisfies PresentationPageDocument)

  let changed = false
  if (document.sourceBlobId !== sourceBlobId || document.sourceItemId !== source.id) {
    changed = true
    document.sourceBlobId = sourceBlobId
    document.sourceItemId = source.id
  }

  for (let index = 0; index < slideCount; index += 1) {
    const existingPage = Object.values(document.pages).find(
      (page) =>
        page.sourceItemId === source.id &&
        page.sourceBlobId === sourceBlobId &&
        page.sourceSlideIndex === index &&
        !page.copiedFrom
    )
    if (existingPage) continue

    const page = createSourcePage(source.id, sourceBlobId, index)
    document.pages[page.id] = page
    document.slideOrder.push(page.id)
    changed = true
  }

  if (!arraysEqual(document.rendererWarnings, rendererWarnings)) {
    document.rendererWarnings = [...rendererWarnings]
    changed = true
  }

  if (changed || !existing) {
    document.updatedAt = now
    await savePresentationPageDocument(document)
  }

  return document
}

export async function savePresentationPageDocument(
  document: PresentationPageDocument
): Promise<void> {
  const body = JSON.stringify(document)
  const blob = new Blob([body], { type: 'application/json' })
  await putDerivedAsset({
    sourceBlobId: document.sourceBlobId,
    kind: PRESENTATION_PAGE_DOCUMENT_KIND,
    variant: getPresentationPageDocumentVariant(document.sourceItemId),
    storage: 'indexed-db',
    mimeType: 'application/json',
    size: blob.size,
    status: 'ready',
    blob,
    metadata: {
      presentationDocumentJson: body
    }
  })
}

export function copyPresentationPage(
  sourceDocument: PresentationPageDocument,
  sourcePageId: string,
  targetDocument: PresentationPageDocument,
  insertIndex = targetDocument.slideOrder.length
): PresentationPageDocument {
  const sourcePage = sourceDocument.pages[sourcePageId]
  if (!sourcePage) throw new Error('Presentation source page is missing')

  const copiedPage: PresentationPageRef = {
    ...sourcePage,
    id: crypto.randomUUID(),
    copiedFrom: {
      documentId: sourceDocument.id,
      pageId: sourcePageId
    }
  }
  const safeInsertIndex = Math.min(Math.max(0, insertIndex), targetDocument.slideOrder.length)
  const slideOrder = [...targetDocument.slideOrder]
  slideOrder.splice(safeInsertIndex, 0, copiedPage.id)

  return {
    ...targetDocument,
    pages: {
      ...targetDocument.pages,
      [copiedPage.id]: copiedPage
    },
    slideOrder,
    updatedAt: Date.now()
  }
}

function createSourcePage(
  sourceItemId: string,
  sourceBlobId: string,
  sourceSlideIndex: number
): PresentationPageRef {
  return {
    id: `${sourceItemId}:slide:${sourceSlideIndex}`,
    sourceItemId,
    sourceBlobId,
    sourceSlideIndex
  }
}

function parsePresentationPageDocument(value: string): PresentationPageDocument {
  const parsed = JSON.parse(value) as Partial<PresentationPageDocument>
  if (
    !parsed.id ||
    !parsed.sourceItemId ||
    !parsed.sourceBlobId ||
    !Array.isArray(parsed.slideOrder) ||
    typeof parsed.pages !== 'object' ||
    !parsed.pages
  ) {
    throw new Error('Invalid presentation page document')
  }
  return {
    id: parsed.id,
    sourceItemId: parsed.sourceItemId,
    sourceBlobId: parsed.sourceBlobId,
    slideOrder: parsed.slideOrder,
    pages: parsed.pages as Record<string, PresentationPageRef>,
    notesByPageId: parsed.notesByPageId ?? {},
    rendererWarnings: parsed.rendererWarnings ?? [],
    createdAt: parsed.createdAt ?? Date.now(),
    updatedAt: parsed.updatedAt ?? Date.now()
  }
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function readBlobText(blob: Blob): Promise<string> {
  if ('text' in blob && typeof blob.text === 'function') return blob.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read presentation document'))
    reader.readAsText(blob)
  })
}
