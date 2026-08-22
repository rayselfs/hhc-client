import { beforeEach, describe, expect, it } from 'vitest'
import { getDerivedAsset, resetMediaWorkDBForTests } from '../media-work-db'
import {
  copyPresentationPage,
  ensurePresentationPageDocument,
  getPresentationPageDocument,
  getPresentationPageDocumentVariant,
  savePresentationPageDocument
} from '../presentation-page-document'

beforeEach(async () => {
  await resetMediaWorkDBForTests()
})

describe('presentation page documents', () => {
  it('creates and persists page references for every source slide', async () => {
    const document = await ensurePresentationPageDocument({ id: 'deck-1', url: 'blob:blob-1' }, 3, [
      'missing font'
    ])

    expect(document.sourceItemId).toBe('deck-1')
    expect(document.sourceBlobId).toBe('blob-1')
    expect(document.slideOrder).toEqual(['deck-1:slide:0', 'deck-1:slide:1', 'deck-1:slide:2'])
    expect(document.rendererWarnings).toEqual(['missing font'])
    expect(document.pages['deck-1:slide:2']).toMatchObject({
      sourceItemId: 'deck-1',
      sourceBlobId: 'blob-1',
      sourceSlideIndex: 2
    })

    const asset = await getDerivedAsset(
      'blob-1',
      'presentation-page-document',
      getPresentationPageDocumentVariant('deck-1')
    )
    expect(asset?.mimeType).toBe('application/json')
    expect(asset?.status).toBe('ready')
  })

  it('reuses existing documents and appends missing source slides', async () => {
    const first = await ensurePresentationPageDocument({ id: 'deck-1', url: 'blob:blob-1' }, 1)
    const second = await ensurePresentationPageDocument({ id: 'deck-1', url: 'blob:blob-1' }, 2)

    expect(second.id).toBe(first.id)
    expect(second.slideOrder).toEqual(['deck-1:slide:0', 'deck-1:slide:1'])
  })

  it('copies a page into another deck without reusing the page id', async () => {
    const source = await ensurePresentationPageDocument({ id: 'deck-1', url: 'blob:blob-1' }, 2)
    const target = await ensurePresentationPageDocument({ id: 'deck-2', url: 'blob:blob-2' }, 1)
    const copied = copyPresentationPage(source, source.slideOrder[1], target, 1)

    expect(copied.slideOrder).toHaveLength(2)
    const copiedPageId = copied.slideOrder[1]
    expect(copiedPageId).not.toBe(source.slideOrder[1])
    expect(copied.pages[copiedPageId]).toMatchObject({
      sourceItemId: 'deck-1',
      sourceBlobId: 'blob-1',
      sourceSlideIndex: 1,
      copiedFrom: {
        documentId: source.id,
        pageId: source.slideOrder[1]
      }
    })

    await savePresentationPageDocument(copied)
    const persisted = await getPresentationPageDocument({ id: 'deck-2', url: 'blob:blob-2' })
    expect(persisted?.slideOrder).toEqual(copied.slideOrder)
  })
})
