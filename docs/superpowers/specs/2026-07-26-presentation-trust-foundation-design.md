# Presentation Trust Foundation Design

## Summary

The presentation editor must become safe to use before its PowerPoint-like layout and feature
surface expand. The current editor saves the complete presentation on every committed document
update, including pointer-move and text-input updates. Those saves can overlap, regenerate
thumbnails repeatedly, and finish out of order. Undo stores only past whole-document snapshots,
has no redo path, and communicates with the workspace header through DOM custom events.

This milestone introduces a small presentation editor controller boundary with transactional
history and a per-document save coordinator. It also exposes visible save state and standard
desktop undo/redo shortcuts. It intentionally does not redesign the Ribbon, slide rail, canvas,
or projection workflow.

## Goals

- Guarantee that an older asynchronous save cannot overwrite a newer revision.
- Keep at most one persistence write in flight for a presentation document.
- Coalesce rapid updates and persist the latest revision after a 250 ms trailing debounce.
- Record one history entry for one user-visible edit transaction.
- Support undo and redo through buttons and platform-standard shortcuts.
- Expose `dirty`, `saving`, `saved`, and `error` states in the presentation workspace header.
- Preserve editing responsiveness while persistence and thumbnail generation run asynchronously.
- Keep the implementation compatible with both Electron and browser modes.

## Non-goals

- Redesigning the presentation workspace layout or Ribbon.
- Adding slide drag reorder, object multi-selection, guides, crop UI, shapes, notes, or export.
- Changing the editable presentation schema or PPTX conversion fidelity.
- Introducing event sourcing, CRDTs, collaboration, or a general application command framework.
- Refactoring unrelated Media, Timer, Projection, File Explorer, or persistence code.

## User-visible behavior

### Save status

The workspace header displays the active editable document's persistence state:

- `dirty`: local edits exist and are waiting for the debounce window.
- `saving`: the coordinator is writing a revision.
- `saved`: the latest committed revision has been persisted.
- `error`: the latest revision is still dirty because persistence failed.

`error` includes a Retry action. Retrying schedules the latest revision; it never retries an older
snapshot. The editor remains usable while saving or after an error.

Raw PPTX read-only documents do not display editable save state.

### Undo and redo

The header contains Undo and Redo actions with disabled states derived from the active editor
session. The editor supports:

- Windows/Linux: `Ctrl+Z` for Undo and `Ctrl+Y` for Redo.
- macOS: `Cmd+Z` for Undo and `Cmd+Shift+Z` for Redo.

Undo restores the document, active slide, selected slide IDs, selected element ID, editing element
ID, and active tool state captured by the transaction. Redo restores the corresponding future
entry. A new edit after Undo clears the redo stack.

Undo and Redo are themselves persisted through the same save coordinator. They do not create new
history entries.

Shortcut handling must respect the existing shortcut scopes. Native text editing owns Undo/Redo
while focus is in an editable text field or presentation text editor; the presentation session
shortcut must not intercept those keystrokes.

## Architecture

### Presentation editor session

Add a focused session module that owns document editing state and history independently of React
component-local event wiring.

```ts
export type PresentationSaveStatus = 'dirty' | 'saving' | 'saved' | 'error'

export interface PresentationEditorSnapshot {
  document: EditablePresentationDocument
  activeSlideIndex: number
  selectedSlideIds: string[]
  selectedElementId: string | null
  editingElementId: string | null
  activeTool: 'select' | 'text'
}

export interface PresentationHistoryState {
  past: PresentationEditorSnapshot[]
  present: PresentationEditorSnapshot
  future: PresentationEditorSnapshot[]
}
```

The session exposes pure operations:

```ts
commitPresentationTransaction(
  state: PresentationHistoryState,
  next: PresentationEditorSnapshot
): PresentationHistoryState

undoPresentationTransaction(state: PresentationHistoryState): PresentationHistoryState

redoPresentationTransaction(state: PresentationHistoryState): PresentationHistoryState
```

History is limited to 30 past entries. Committing an identical snapshot is a no-op. A normal
commit appends the previous present snapshot, replaces present, and clears future.

The initial integration may keep ephemeral pointer/text drafts in `EditableDocumentView`, but all
permanent document changes and history transitions must use these pure operations.

### Save coordinator

Add a per-document coordinator with an injected persistence function:

```ts
export interface PresentationSaveRequest {
  revision: number
  document: EditablePresentationDocument
}

export interface PresentationSaveCoordinator {
  schedule(document: EditablePresentationDocument): number
  retry(): void
  flush(): Promise<void>
  dispose(): Promise<void>
  subscribe(listener: (state: PresentationSaveState) => void): () => void
}
```

Required semantics:

1. `schedule()` increments a monotonic revision and immediately reports `dirty`.
2. A 250 ms trailing debounce starts when no write is running.
3. Only one write may be in flight.
4. If updates arrive during a write, only the newest pending document is written next.
5. Completion of an older revision cannot change the state to `saved` while a newer revision is
   pending.
6. Persistence failure reports `error`, retains the newest pending document, and does not loop
   automatically.
7. `retry()` retries the newest pending revision.
8. `flush()` cancels the debounce delay and resolves only when the newest scheduled revision is
   saved or rejects with the persistence error.
9. `dispose()` flushes pending work and releases timers and subscriptions.

The injected persistence function calls the existing `saveEditablePresentation()`. This milestone
does not change the editable document storage format.

### Thumbnail scheduling

`saveEditablePresentation()` currently persists the document and regenerates its thumbnail as one
operation. To avoid thumbnail work for each intermediate revision, split the existing function
internally into:

- document/blob persistence;
- thumbnail generation and persistence.

The save coordinator invokes document persistence for every serialized save and thumbnail
generation only after the latest revision becomes idle and saved. A failed thumbnail update does
not invalidate the saved document; it reports a non-blocking warning and remains eligible for a
later refresh.

No new public storage abstraction is introduced beyond the minimum functions needed by the
coordinator.

## Transaction boundaries

### Discrete commands

Adding, deleting, pasting, reordering, formatting, changing slide background, and changing canvas
size each create one transaction.

### Pointer move and resize

Pointer movement updates a transient draft rendered in memory. Pointer up commits the final
document as one transaction. Pointer cancel restores the pre-drag snapshot and creates no history
entry.

### Text editing

IME composition and consecutive text input update a transient draft. The draft commits as one
transaction when any of the following occurs:

- the text editor loses focus;
- selection changes;
- the active slide changes;
- 750 ms passes without further text input.

Unmount and document-tab close flush the current text draft before the save coordinator flushes.

## React integration

`EditableDocumentView` creates one editor session and one save coordinator for each opened
editable document. It subscribes to coordinator state and publishes the active document's editor
commands and save state through the existing presentation workspace Zustand store.

The workspace store remains serializable. It contains presentation editor metadata and actions,
not the coordinator instance, DOM nodes, timers, or repository functions.

`PresentationWorkspaceHeader` reads Undo, Redo, and save status from the store. The
`hhc:presentation-undo-state` and `hhc:presentation-undo-request` custom events are removed.

## Error handling

- Save errors preserve the local latest document and history.
- A failed save displays an actionable error status with Retry.
- Closing a document with an unresolved save error requires explicit confirmation:
  - Keep editing cancels close.
  - Close anyway discards only unsaved local changes from the current session.
- Navigating away triggers `flush()`. If it fails, the workspace remains open and displays the
  save error.
- Error messages use the existing toast system for the initial failure and persistent inline
  status for recovery.

## Testing strategy

### Pure history tests

- Commit stores one past snapshot and clears future.
- Identical commit is a no-op.
- Undo and redo restore document and selection state.
- New commit after Undo clears future.
- History keeps the latest 30 past entries.

### Save coordinator tests

Use fake timers and a controllable persistence promise:

- 100 rapid schedules result in the newest revision being persisted.
- Only one persistence call is in flight.
- An older completion never marks a newer pending revision as saved.
- Updates during a write produce one follow-up write containing the newest document.
- Failure retains the latest pending revision.
- Retry saves the retained latest revision.
- Flush bypasses debounce and waits for the newest revision.
- Dispose releases timers and subscriptions after flushing.

### Editor interaction tests

- A multi-event pointer drag creates one Undo entry and at most one thumbnail refresh.
- Consecutive text input creates one Undo entry after the 750 ms idle boundary.
- IME composition is not split into multiple transactions.
- Undo/Redo buttons reflect active document state.
- Platform shortcuts invoke presentation history outside text editing.
- Native text editing retains browser-native Undo/Redo.
- Save status progresses through dirty, saving, saved, and error.

### Regression verification

- Existing editable presentation load, save, conversion, projection payload, and workspace tests
  remain passing.
- `npm run lint`
- `npm run typecheck`
- `npx vitest run`
- `npm run build`

No adapter behavior changes in this milestone, so Electron and browser use the same renderer-side
implementation. Browser and Electron smoke checks remain required before merging because storage
and lifecycle timing can differ.

## Acceptance criteria

- A two-second drag creates exactly one Undo entry.
- A continuous text edit creates one Undo entry after idle, blur, slide change, or selection
  change.
- Undo and Redo restore document and selection state through buttons and platform shortcuts.
- A new edit after Undo disables Redo.
- At most one save per document is in flight.
- The last persisted revision always equals the highest scheduled revision.
- Save failure remains visible and retryable without losing local edits.
- The header always reflects the active editable document's current save state.
- Closing or navigating with pending work flushes the newest revision before teardown.
- Intermediate pointer and text updates do not regenerate thumbnails.
- No DOM custom event remains for presentation Undo state or requests.
- No new dependency, storage schema, or environment-specific code is introduced.

## Follow-up milestones

After this foundation passes its acceptance gates:

1. Implement the PowerPoint-like workspace shell, responsive panel behavior, status bar, and
   contextual inspector.
2. Add slide rail drag reorder, duplicate/new-slide shortcuts, and projected-slide indicators.
3. Add object multi-selection, keyboard nudge, guides, crop entry, basic shapes, and slide notes.
4. Build the persistent Media/Projection workspace and safe preview flow.
