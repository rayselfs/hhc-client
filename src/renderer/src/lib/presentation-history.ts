import type { EditablePresentationDocument } from './editable-presentation'

const MAX_HISTORY_ENTRIES = 30

export interface PresentationHistoryState {
  past: EditablePresentationDocument[]
  present: EditablePresentationDocument
  future: EditablePresentationDocument[]
}

function documentsEqual(
  left: EditablePresentationDocument,
  right: EditablePresentationDocument
): boolean {
  return left === right || JSON.stringify(left) === JSON.stringify(right)
}

export function commitPresentationDocument(
  state: PresentationHistoryState,
  next: EditablePresentationDocument
): PresentationHistoryState {
  if (documentsEqual(state.present, next)) return state
  return {
    past: [...state.past.slice(-(MAX_HISTORY_ENTRIES - 1)), state.present],
    present: next,
    future: []
  }
}

export function undoPresentationDocument(
  state: PresentationHistoryState
): PresentationHistoryState {
  const previous = state.past.at(-1)
  if (!previous) return state
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future]
  }
}

export function redoPresentationDocument(
  state: PresentationHistoryState
): PresentationHistoryState {
  const [next, ...future] = state.future
  if (!next) return state
  return {
    past: [...state.past.slice(-(MAX_HISTORY_ENTRIES - 1)), state.present],
    present: next,
    future
  }
}
