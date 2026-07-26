import { describe, expect, it, vi } from 'vitest'
import {
  buildEditableProjectionPayloadForSession,
  buildEditableSlideProjectionPayload,
  buildFileProjectionPayload
} from '../media-projection-payload'
import {
  addElementToSlide,
  createBlankEditablePresentationDocument,
  createImageElement,
  createTextElement,
  insertBlankEditableSlide
} from '../editable-presentation'
import { EDITABLE_PRESENTATION_MIME_TYPE } from '../presentation-media'
import type { PresentationEditorSession } from '../presentation-editor-session'
import type { PresentationSnapshot } from '../presentation-readiness'
import type { FileItemRecord } from '@shared/types/folder'

function makeFile(id: string, url = `blob:${id}`): FileItemRecord {
  return {
    id,
    type: 'file',
    parentId: 'root',
    sortIndex: 0,
    createdAt: 0,
    expiresAt: null,
    name: `${id}.mp4`,
    url,
    size: 100,
    mimeType: 'video/mp4'
  }
}

describe('buildFileProjectionPayload', () => {
  it('builds a file projection payload from snapshot metadata', () => {
    const playlist = [makeFile('copy-id', 'blob:original-id')]
    const snapshot: PresentationSnapshot = {
      id: 'snapshot-1',
      createdAt: 0,
      entries: [
        {
          index: 0,
          itemId: 'copy-id',
          blobId: 'original-id',
          name: 'copy.mp4',
          mimeType: 'video/mp4',
          sourceUrl: 'blob:original-id',
          playbackMode: 'vlc-embedded',
          seekable: true,
          durationMs: 1234
        }
      ]
    }

    expect(buildFileProjectionPayload({ playlist, currentIndex: 0, snapshot })).toEqual({
      itemId: 'copy-id',
      blobId: 'original-id',
      fileName: 'copy-id.mp4',
      mimeType: 'video/mp4',
      playlist: [{ id: 'copy-id', name: 'copy-id.mp4', mimeType: 'video/mp4' }],
      currentIndex: 0,
      playbackMode: 'vlc-embedded',
      seekable: true,
      durationMs: 1234
    })
  })

  it('returns null when the current index has no item', () => {
    expect(buildFileProjectionPayload({ playlist: [], currentIndex: 0 })).toBeNull()
  })

  it('includes presentation slide state for PPTX media', () => {
    const playlist = [
      {
        ...makeFile('deck-id'),
        name: 'deck.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      }
    ]

    expect(
      buildFileProjectionPayload({
        playlist,
        currentIndex: 0,
        typeStates: { presentation: { slideIndex: 3, slideCount: 12 } }
      })
    ).toMatchObject({
      itemId: 'deck-id',
      presentation: { slideIndex: 3, slideCount: 12 }
    })
  })

  it('includes active editable slide text and image content for projection', async () => {
    const item = {
      ...makeFile('editable-deck'),
      name: 'Editable deck.lpdeck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    }
    const document = createBlankEditablePresentationDocument(
      'Sunday',
      '00000000-0000-4000-8000-000000000004'
    )
    const slideId = document.slideOrder[0]
    const text = createTextElement({ text: 'Amazing grace\n主愛永不止息', width: 420 })
    const asset = {
      id: 'asset-1',
      name: 'photo.png',
      mimeType: 'image/png',
      dataUrl: 'data:image/png;base64,AAA='
    }
    const image = createImageElement({
      assetId: asset.id,
      slideWidth: document.width,
      slideHeight: document.height,
      sourceWidth: 800,
      sourceHeight: 400
    })
    const savedDocument = addElementToSlide(
      addElementToSlide({ ...document, assets: { [asset.id]: asset } }, slideId, text),
      slideId,
      image
    )
    const basePayload = buildFileProjectionPayload({
      playlist: [item],
      currentIndex: 0,
      typeStates: { presentation: { slideIndex: 0 } }
    })!
    const payload = buildEditableSlideProjectionPayload(basePayload, savedDocument, slideId)

    expect(payload?.editablePresentation).toMatchObject({
      width: document.width,
      height: document.height,
      slide: {
        id: slideId,
        elements: {
          [text.id]: expect.objectContaining({ type: 'text', text: 'Amazing grace\n主愛永不止息' }),
          [image.id]: expect.objectContaining({ type: 'image', assetId: asset.id })
        }
      },
      assets: { [asset.id]: asset }
    })
    expect(payload?.presentation).toEqual({ slideIndex: 0, slideCount: 1 })
  })

  it('keeps the active editable slide by ID after an earlier insertion', () => {
    const item = {
      ...makeFile('editable-deck'),
      name: 'Editable deck.lpdeck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    }
    let document = createBlankEditablePresentationDocument('Sunday')
    document = insertBlankEditableSlide(document, 1).document
    document = insertBlankEditableSlide(document, 2).document
    const activeSlideId = document.slideOrder[1]
    const inserted = insertBlankEditableSlide(document, 0).document
    const basePayload = buildFileProjectionPayload({
      playlist: [item],
      currentIndex: 0
    })!

    const payload = buildEditableSlideProjectionPayload(basePayload, inserted, activeSlideId)

    expect(payload.presentation?.slideIndex).toBe(2)
    expect(payload.editablePresentation?.slide.id).toBe(activeSlideId)
  })

  it('selects the first editable slide when the active ID is missing', () => {
    const item = {
      ...makeFile('editable-deck'),
      name: 'Editable deck.lpdeck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    }
    const document = insertBlankEditableSlide(
      createBlankEditablePresentationDocument('Sunday'),
      1
    ).document
    const basePayload = buildFileProjectionPayload({
      playlist: [item],
      currentIndex: 0
    })!

    const payload = buildEditableSlideProjectionPayload(basePayload, document, 'missing-slide')

    expect(payload.presentation).toEqual({ slideIndex: 0, slideCount: 2 })
    expect(payload.editablePresentation?.slide.id).toBe(document.slideOrder[0])
  })

  it('commits and flushes a session before reading its exact projection document', async () => {
    const item = {
      ...makeFile('editable-deck'),
      name: 'Editable deck.lpdeck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    }
    const document = createBlankEditablePresentationDocument('Sunday')
    const calls: string[] = []
    const session = {
      commitDraft: vi.fn(() => calls.push('commit')),
      flush: vi.fn(async () => {
        calls.push('flush')
      }),
      getSnapshot: vi.fn(() => {
        calls.push('snapshot')
        return { history: { present: document } }
      })
    } as unknown as PresentationEditorSession
    const basePayload = buildFileProjectionPayload({
      playlist: [item],
      currentIndex: 0
    })!

    const payload = await buildEditableProjectionPayloadForSession(
      basePayload,
      session,
      document.slideOrder[0]
    )

    expect(calls).toEqual(['commit', 'flush', 'snapshot'])
    expect(payload.editablePresentation?.slide.id).toBe(document.slideOrder[0])
  })

  it('does not read session state when the exact revision cannot flush', async () => {
    const item = {
      ...makeFile('editable-deck'),
      name: 'Editable deck.lpdeck',
      mimeType: EDITABLE_PRESENTATION_MIME_TYPE
    }
    const session = {
      commitDraft: vi.fn(),
      flush: vi.fn().mockRejectedValue(new Error('quota exceeded')),
      getSnapshot: vi.fn()
    } as unknown as PresentationEditorSession
    const basePayload = buildFileProjectionPayload({
      playlist: [item],
      currentIndex: 0
    })!

    await expect(
      buildEditableProjectionPayloadForSession(basePayload, session, 'slide-1')
    ).rejects.toThrow('quota exceeded')

    expect(session.commitDraft).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot).not.toHaveBeenCalled()
  })
})
