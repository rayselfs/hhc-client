import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addElementToSlide,
  createTextElement,
  updateElementInSlide,
  createBlankEditablePresentationDocument
} from '../editable-presentation'
import {
  createPresentationEditorSession,
  type PresentationEditorSession
} from '../presentation-editor-session'
import type { PersistPresentationRevision } from '../presentation-save-coordinator'

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('presentation editor session', () => {
  const initialDocument = createBlankEditablePresentationDocument('Initial')
  const sessions: PresentationEditorSession[] = []

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    for (const session of sessions) session.dispose()
    sessions.length = 0
    vi.useRealTimers()
  })

  function createSession(
    options: {
      persist?: PersistPresentationRevision
      refreshThumbnail?: (document: typeof initialDocument) => Promise<void>
      initialRevision?: number
    } = {}
  ): PresentationEditorSession {
    const persist: PersistPresentationRevision =
      options.persist ??
      (async (request) => ({
        revision: request.revision,
        mirrorWarnings: []
      }))
    const session = createPresentationEditorSession({
      initialDocument,
      initialRevision: options.initialRevision,
      persist,
      refreshThumbnail: options.refreshThumbnail ?? vi.fn().mockResolvedValue(undefined)
    })
    sessions.push(session)
    return session
  }

  it('reflows derived text geometry without adding an undo entry or clearing redo', () => {
    const session = createSession()
    const slideId = initialDocument.slideOrder[0]
    const element = createTextElement({ text: 'Hello' })
    session.commit(addElementToSlide(initialDocument, slideId, element))
    session.commit(
      updateElementInSlide(session.getSnapshot().renderedDocument, slideId, element.id, {
        bold: true
      })
    )
    const undoCount = session.getSnapshot().history.past.length
    session.reflowText(slideId, element.id, { height: 90 })
    expect(session.getSnapshot().history.past).toHaveLength(undoCount)
    session.undo()
    expect(
      session.getSnapshot().renderedDocument.slides[slideId].elements[element.id]
    ).toMatchObject({ bold: false })
    session.reflowText(slideId, element.id, { height: 70 })
    expect(session.getSnapshot().history.future).toHaveLength(1)
    session.redo()
    expect(
      session.getSnapshot().renderedDocument.slides[slideId].elements[element.id]
    ).toMatchObject({ bold: true, height: 90 })
  })

  it('continues scheduling after the persisted revision', () => {
    const session = createSession({ initialRevision: 4 })

    session.commit({ ...initialDocument, name: 'Changed' })

    expect(session.getSnapshot().save.scheduledRevision).toBe(5)
  })

  it('commits 120 pointer previews as one document transaction', () => {
    const session = createSession()
    session.beginDraft('pointer')
    for (let index = 0; index < 120; index += 1) {
      session.previewDraft({
        ...session.getSnapshot().renderedDocument,
        name: `Preview ${index}`
      })
    }

    session.commitDraft()

    expect(session.getSnapshot().history.past).toHaveLength(1)
    expect(session.getSnapshot().history.present.name).toBe('Preview 119')
    expect(session.getSnapshot().save.scheduledRevision).toBe(1)
  })

  it('cancels a pointer draft without history or persistence', () => {
    const session = createSession()
    session.beginDraft('pointer')
    session.previewDraft({ ...initialDocument, name: 'Preview' })

    session.cancelDraft()

    expect(session.getSnapshot().history).toMatchObject({
      past: [],
      present: initialDocument,
      future: []
    })
    expect(session.getSnapshot().save.scheduledRevision).toBe(0)
  })

  it('commits a continuous text draft as one transaction', () => {
    const session = createSession()
    session.beginDraft('text')
    session.previewDraft({ ...initialDocument, name: 'H' })
    session.previewDraft({ ...initialDocument, name: 'He' })
    session.previewDraft({ ...initialDocument, name: 'Hello' })

    session.commitDraft()

    expect(session.getSnapshot().history.past).toHaveLength(1)
    expect(session.getSnapshot().history.present.name).toBe('Hello')
    expect(session.getSnapshot().save.scheduledRevision).toBe(1)
  })

  it('commits an active draft before a discrete command', () => {
    const session = createSession()
    session.beginDraft('text')
    session.previewDraft({ ...initialDocument, name: 'Draft' })

    session.commit({ ...initialDocument, name: 'Discrete' })

    expect(session.getSnapshot().history.past.map((document) => document.name)).toEqual([
      'Initial',
      'Draft'
    ])
    expect(session.getSnapshot().history.present.name).toBe('Discrete')
    expect(session.getSnapshot().save.scheduledRevision).toBe(2)
  })

  it('commits an active draft before undo and redo', () => {
    const session = createSession()
    session.beginDraft('text')
    session.previewDraft({ ...initialDocument, name: 'Draft' })

    session.undo()
    expect(session.getSnapshot().history.present.name).toBe('Initial')
    expect(session.getSnapshot().history.future[0].name).toBe('Draft')

    session.redo()
    expect(session.getSnapshot().history.present.name).toBe('Draft')
    expect(session.getSnapshot().save.scheduledRevision).toBe(3)
  })

  it('flushes an active draft before awaiting persistence', async () => {
    const persist = vi.fn<PersistPresentationRevision>().mockImplementation(async (request) => ({
      revision: request.revision,
      mirrorWarnings: []
    }))
    const session = createSession({ persist })
    session.beginDraft('text')
    session.previewDraft({ ...initialDocument, name: 'Durable' })

    await session.flush()

    expect(persist).toHaveBeenCalledTimes(1)
    expect(persist.mock.calls[0][0].document.name).toBe('Durable')
    expect(session.getSnapshot().save.status).toBe('saved')
  })

  it('renames without adding an undo step or resurrecting the old name', () => {
    const session = createSession()
    session.commit({ ...initialDocument, name: 'Initial', updatedAt: 2 })
    const historyLength = session.getSnapshot().history.past.length

    session.rename('Renamed', 'Renamed')
    session.undo()

    expect(session.getSnapshot().history.past).toHaveLength(historyLength - 1)
    expect(session.getSnapshot().history.present.name).toBe('Renamed')
  })

  it('discards a pending edit and restores the last persisted document', async () => {
    const persist = vi.fn<PersistPresentationRevision>()
    const session = createSession({ persist })
    session.commit({ ...initialDocument, name: 'Pending' })

    await session.discard()

    expect(persist).not.toHaveBeenCalled()
    expect(session.getSnapshot().history).toMatchObject({
      past: [],
      present: initialDocument,
      future: []
    })
    expect(session.getSnapshot().save.status).toBe('saved')
  })

  it('keeps getSnapshot stable until a session transition occurs', () => {
    const session = createSession()
    const before = session.getSnapshot()

    expect(session.getSnapshot()).toBe(before)
    session.beginDraft('pointer')
    expect(session.getSnapshot()).not.toBe(before)
    expect(session.getSnapshot()).toBe(session.getSnapshot())
  })

  it('refreshes the thumbnail once after the latest revision becomes idle', async () => {
    const refreshThumbnail = vi.fn().mockResolvedValue(undefined)
    const session = createSession({ refreshThumbnail })
    session.commit({ ...initialDocument, name: 'Saved' })

    await session.flush()
    await Promise.resolve()

    expect(refreshThumbnail).toHaveBeenCalledTimes(1)
    expect(refreshThumbnail).toHaveBeenCalledWith(expect.objectContaining({ name: 'Saved' }))
  })

  it('reports a thumbnail warning and retries it without rewriting the document', async () => {
    const refreshThumbnail = vi
      .fn()
      .mockRejectedValueOnce(new Error('thumbnail unavailable'))
      .mockResolvedValueOnce(undefined)
    const persist = vi.fn<PersistPresentationRevision>().mockImplementation(async (request) => ({
      revision: request.revision,
      mirrorWarnings: []
    }))
    const session = createSession({ persist, refreshThumbnail })
    session.commit({ ...initialDocument, name: 'Saved' })
    await session.flush()
    await Promise.resolve()
    await Promise.resolve()
    expect(session.getSnapshot().save.mirrorWarnings).toContain('thumbnail')

    session.retry()
    await Promise.resolve()
    await Promise.resolve()

    expect(refreshThumbnail).toHaveBeenCalledTimes(2)
    expect(persist).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot().save.mirrorWarnings).not.toContain('thumbnail')
  })

  it('refreshes a newer saved revision after an older thumbnail finishes', async () => {
    const firstThumbnail = deferred<void>()
    const secondThumbnail = deferred<void>()
    const refreshThumbnail = vi
      .fn()
      .mockReturnValueOnce(firstThumbnail.promise)
      .mockReturnValueOnce(secondThumbnail.promise)
    const session = createSession({ refreshThumbnail })
    session.commit({ ...initialDocument, name: 'First' })
    await session.flush()
    session.commit({ ...initialDocument, name: 'Second' })
    await session.flush()

    expect(refreshThumbnail).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot().save.mirrorWarnings).toContain('thumbnail')

    firstThumbnail.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(refreshThumbnail).toHaveBeenCalledTimes(2)
    expect(refreshThumbnail.mock.calls[1][0].name).toBe('Second')

    secondThumbnail.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(session.getSnapshot().save.mirrorWarnings).not.toContain('thumbnail')
  })
})
