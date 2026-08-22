import { describe, expect, it } from 'vitest'
import { createBlankEditablePresentationDocument } from '../editable-presentation'
import {
  commitPresentationDocument,
  redoPresentationDocument,
  undoPresentationDocument,
  type PresentationHistoryState
} from '../presentation-history'

function createHistory(): PresentationHistoryState {
  return {
    past: [],
    present: createBlankEditablePresentationDocument('Revision 0'),
    future: []
  }
}

describe('presentation document history', () => {
  it('does not create an entry for the same document reference', () => {
    const history = createHistory()

    const committed = commitPresentationDocument(history, history.present)

    expect(committed).toBe(history)
  })

  it('records a distinct document without deep-comparing it', () => {
    const history = createHistory()

    const committed = commitPresentationDocument(history, structuredClone(history.present))

    expect(committed).not.toBe(history)
    expect(committed.past).toEqual([history.present])
  })

  it('keeps only the latest 30 undo entries', () => {
    let history = createHistory()
    for (let revision = 1; revision <= 35; revision += 1) {
      history = commitPresentationDocument(history, {
        ...history.present,
        name: `Revision ${revision}`
      })
    }

    expect(history.past).toHaveLength(30)
    expect(history.past[0].name).toBe('Revision 5')
    expect(history.past[29].name).toBe('Revision 34')
  })

  it('moves complete documents through undo and redo', () => {
    const initial = createHistory()
    const second = commitPresentationDocument(initial, {
      ...initial.present,
      name: 'Revision 1'
    })

    const undone = undoPresentationDocument(second)
    const redone = redoPresentationDocument(undone)

    expect(undone.present.name).toBe('Revision 0')
    expect(undone.future.map((document) => document.name)).toEqual(['Revision 1'])
    expect(redone.present.name).toBe('Revision 1')
    expect(redone.past.map((document) => document.name)).toEqual(['Revision 0'])
  })

  it('returns the same state when undo or redo is unavailable', () => {
    const history = createHistory()

    expect(undoPresentationDocument(history)).toBe(history)
    expect(redoPresentationDocument(history)).toBe(history)
  })

  it('clears redo entries after a new committed edit', () => {
    const initial = createHistory()
    const second = commitPresentationDocument(initial, {
      ...initial.present,
      name: 'Revision 1'
    })
    const undone = undoPresentationDocument(second)

    const committed = commitPresentationDocument(undone, {
      ...undone.present,
      name: 'Replacement'
    })

    expect(committed.present.name).toBe('Replacement')
    expect(committed.future).toEqual([])
  })
})
