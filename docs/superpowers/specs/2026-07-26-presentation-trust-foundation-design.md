# Presentation Trust Foundation Design

## Status

Revised 2026-07-26. This revision resolves the lifecycle, authority, history, draft, active-slide,
rename, navigation, Electron close, and projection consistency gaps that blocked R2 implementation.

## Summary

The presentation editor must become safe before its PowerPoint-like layout and feature surface
expand. Today the routed page owns the open document, history, selection, and save calls. Changing
tabs or routes can destroy that state; saves can overlap and complete out of order; derived
documents can be read ahead of the canonical source Blob; rename writes around the editor; and
projection can use a different revision than the canvas.

R2 introduces a small control-window presentation session registry above the routed view. Each
editable document has one session containing its authoritative in-memory document, document-only
history, transient draft, and serialized save coordinator. React renders a session but does not own
its lifetime. The File Explorer source Blob and catalog item are committed together and remain
authoritative. Derived documents and thumbnails are repairable mirrors.

R2 does not redesign the Ribbon, slide rail, canvas, or Media workspace.

## Goals

- Preserve an open editable document while its routed page unmounts or another tab becomes active.
- Guarantee that an older asynchronous save cannot overwrite a newer revision.
- Keep at most one authoritative write in flight per document.
- Coalesce rapid commits and persist the newest revision after a 250 ms trailing debounce.
- Record one history entry for one user-visible document transaction.
- Support Undo and Redo through buttons and platform-standard shortcuts.
- Make pointer and text drafts explicitly begin, preview, commit, and cancel.
- Use one stable slide ID as editor and workspace active-slide truth.
- Expose `dirty`, `saving`, `saved`, and `error` state plus non-blocking mirror warnings.
- Gate tab switch, tab close, route navigation, reload, Electron window close, rename, and
  projection payload creation through the session.
- Preserve browser/Electron dual-mode behavior without duplicating editor logic.

## Non-goals

- PowerPoint layout or Ribbon redesign.
- Slide drag reorder, object multi-selection, guides, crop UI, notes, export, or PPTX round-trip.
- Event sourcing, CRDTs, collaboration, a general command framework, or a new dependency.
- Making a browser `beforeunload` event await IndexedDB.
- Refactoring unrelated Bible, Timer, Media, Projection, or File Explorer paths.

## Alternatives considered

### Keep sessions inside the routed page

This is the smallest code change, but tab switches and route navigation still destroy the owner
before an async guard can finish. It cannot meet the lifecycle acceptance gates.

### Put documents and coordinators directly in Zustand

This would keep state above the route, but timers, repositories, in-flight promises, and disposal
logic are non-serializable services. It would also mix large document bodies with workspace UI
metadata. The project convention assigns those services to Context, so this option is rejected.

### Promote the derived document to authority

The current read order makes this tempting, but catalog/blob cleanup and integrity accounting
already treat the source Blob as the owned source resource. Promoting the mirror would create two
competing lifecycle systems. R2 instead makes source authority explicit and treats derived content
as repairable.

### Selected approach

Use a Context-owned session registry, serializable Zustand metadata, stable slide IDs, and an
authoritative source-Blob/catalog transaction with serialized mirror work. This is the narrowest
design that satisfies route, close, rename, projection, and recovery requirements without a new
framework.

## Authority and persistence contract

### Authoritative records

The authoritative durable revision consists of two records in `hhc-file-explorer`:

1. `file-blobs[itemId]`: canonical editable-presentation JSON Blob;
2. `folder-items[itemId]`: catalog metadata, including name and current serialized size.

They are written in one IndexedDB transaction. A revision is durable only after that transaction
commits.

The following are mirrors and never win reconciliation:

- `editable-presentation-document` derived asset;
- generated cover thumbnail;
- presentation session metadata in Zustand.

`loadEditablePresentation()` reads the source Blob first. If the derived document differs or is
missing, it returns the source immediately and schedules mirror repair. A source-missing document
is an error even if a stale derived copy exists; Recovery Center may offer a future explicit
recovery action, but normal loading never silently promotes the mirror.

### Revision write

Add a narrow persistence operation:

```ts
export interface EditablePresentationRevisionWrite {
  itemId: string
  sourceBlobId: string
  revision: number
  document: EditablePresentationDocument
  catalogName?: string
}

export interface EditablePresentationRevisionResult {
  revision: number
  mirrorWarnings: Array<'derived-document'>
}

export async function persistEditablePresentationRevision(
  write: EditablePresentationRevisionWrite
): Promise<EditablePresentationRevisionResult>
```

The operation:

1. serializes the document once;
2. atomically writes source Blob and catalog size/name;
3. after authoritative commit, writes the same body to the derived mirror;
4. returns a derived-mirror warning without converting a committed source revision into a save
   failure.

`DerivedAssetMetadata` gains `presentationRevision?: number` for diagnostics and reconciliation.
`FileBlobRecord` gains `revision?: number`. No IndexedDB version bump is required because both
fields are additive.

Thumbnail refresh is a separate `refreshEditablePresentationThumbnail(document)` operation. The
coordinator calls it only after the latest authoritative revision and derived mirror are idle. If
a new revision arrives while thumbnail persistence is finishing, that thumbnail may be briefly
stale, but the next idle-latest pass replaces it. Thumbnail work never blocks or fails an
authoritative revision.

## Session ownership

### Registry placement

Add `PresentationSessionRegistryProvider` inside `Layout`, above `Outlet`. It is mounted for the
control-window lifetime and is not mounted on `/projection`.

The registry is a Context because it owns non-serializable controllers, timers, promises, and
subscriptions. It is keyed by `itemId`:

```ts
export interface PresentationSessionRegistry {
  open(item: FileItemRecord): Promise<PresentationEditorSession>
  get(itemId: string): PresentationEditorSession | undefined
  activate(itemId: string): Promise<boolean>
  close(itemId: string, decision?: CloseDecision): Promise<boolean>
  flushAll(): Promise<void>
  hasUnsafeWork(): boolean
}
```

The session survives route changes and tab activation. It is destroyed only after a successful
close/dispose or explicit discard.

### Serializable workspace store

`usePresentationWorkspaceStore` contains only serializable metadata and Zustand actions:

```ts
export interface PresentationWorkspaceDocument {
  itemId: string
  mode: 'pptx' | 'editable'
  name: string
  mimeType: string
  url: string
  size: number
  openedAt: number
  slideCount?: number
  saveStatus?: PresentationSaveStatus
  mirrorWarnings?: PresentationMirrorWarning[]
  canUndo?: boolean
  canRedo?: boolean
}

activeSlideIdByItemId: Record<string, string | null>
```

The current `activeSlideByItemId` index map is removed. Indexes for rendering, projection adapters,
and slide counters are derived from `document.slideOrder.indexOf(activeSlideId)`.

The store never contains a session, coordinator, repository, timer, DOM node, or Promise.

## Editor session and history

### Document-only history

History stores documents, not selection or editing UI:

```ts
export interface PresentationHistoryState {
  past: EditablePresentationDocument[]
  present: EditablePresentationDocument
  future: EditablePresentationDocument[]
}
```

`commit(nextDocument)` appends the previous document, replaces `present`, clears `future`, and
schedules the new document. Identical documents are a no-op. History retains 30 past documents.

Undo and Redo move documents between stacks and schedule the restored document without creating a
new history entry.

Selection, active tool, editing element, open panels, copied objects, and insertion markers are
ephemeral view state. After Undo/Redo:

- retain active slide ID if it still exists, otherwise choose the nearest surviving slide;
- clear selected slide/element IDs that no longer exist;
- end text editing and return to the select tool;
- never restore a stale DOM editing mode from history.

This keeps document history deterministic and prevents UI-only changes from consuming Undo steps.

### Session surface

```ts
export interface PresentationEditorSession {
  getSnapshot(): PresentationSessionSnapshot
  subscribe(listener: () => void): () => void
  commit(next: EditablePresentationDocument): void
  undo(): void
  redo(): void
  beginDraft(kind: 'pointer' | 'text'): void
  previewDraft(next: EditablePresentationDocument): void
  commitDraft(): void
  cancelDraft(): void
  rename(nextName: string): void
  flush(): Promise<void>
  discard(): Promise<void>
  dispose(): Promise<void>
}
```

`discard()` is independent from flush. It:

1. cancels debounce and pending unsaved revisions;
2. cancels the active draft;
3. restores `lastPersistedDocument`;
4. resets history to that document;
5. clears save error;
6. does not write.

`dispose()` requires no active draft and no unsafe work. It releases subscriptions and timers; it
does not implicitly turn discard into save.

## Draft transactions

Only a committed draft enters history and persistence.

### Pointer move and resize

- `pointerdown`: `beginDraft('pointer')` captures the pre-drag document.
- `pointermove`: `previewDraft(next)` updates the canvas only.
- `pointerup`: `commitDraft()` creates one history entry and schedules one revision.
- `pointercancel` or Escape: `cancelDraft()` restores the pre-drag document with no history entry.

### Text editing

- focus/first input: `beginDraft('text')`;
- IME composition and input: `previewDraft(next)`;
- commit on blur, selection change, active-slide change, 750 ms idle, tab activation, route
  navigation, close, rename, Undo/Redo, or projection;
- Escape before commit: `cancelDraft()`.

An IME composition never commits during `compositionstart` to `compositionend`.

Discrete commands such as add/delete/paste/reorder/format/background/canvas-size first commit any
active text draft, then create one new document transaction.

## Save coordinator

```ts
export type PresentationSaveStatus = 'dirty' | 'saving' | 'saved' | 'error'
export type PresentationMirrorWarning = 'derived-document' | 'thumbnail'

export interface PresentationSaveState {
  status: PresentationSaveStatus
  scheduledRevision: number
  persistedRevision: number
  error: string | null
  mirrorWarnings: PresentationMirrorWarning[]
}

export interface PresentationSaveCoordinator {
  schedule(document: EditablePresentationDocument, catalogName?: string): number
  retry(): void
  flush(): Promise<void>
  discard(): Promise<void>
  subscribe(listener: (state: PresentationSaveState) => void): () => void
  dispose(): void
}
```

Semantics:

1. `schedule()` increments a monotonic revision and immediately reports `dirty`.
2. One 250 ms trailing debounce exists per session.
3. At most one authoritative write is in flight.
4. Updates during a write replace the pending request with only the newest document and metadata.
5. An older completion never reports `saved` while a newer revision is pending.
6. Authoritative failure reports `error`, retains the newest request, and never loops.
7. `retry()` retries only the newest request.
8. `flush()` commits the active draft first at the session boundary, skips debounce, and resolves
   only when the highest scheduled revision is authoritative or rejects with its save error.
9. `discard()` cancels revisions that have not started. An authoritative IndexedDB transaction
   already in flight cannot be truthfully cancelled, so discard awaits it: if it succeeds, that
   revision becomes `lastPersistedDocument`; if it fails, the previous persisted revision remains.
   The session then restores the last actually persisted document. A generation token prevents
   stale completion callbacks from mutating the discarded session, but is not claimed to cancel a
   durable write.
10. Mirror warnings do not change authoritative `saved` status. When the coordinator becomes idle
    at the latest revision, it retries mirror/thumbnail refresh once; later retries are manual or
    occur on the next successful revision.

## Rename contract

Header rename no longer calls `loadEditablePresentation()` or `saveEditablePresentation()`
directly.

For an editable document:

1. validate name and sibling conflict;
2. commit any active draft;
3. call `session.rename(nextName)`;
4. update the in-memory document name without adding an Undo history step;
5. schedule a revision with `catalogName`;
6. await `session.flush()` before ending rename UI;
7. update workspace/File Explorer display metadata after authoritative commit.

For a read-only PPTX, the existing catalog-only rename remains, but it uses the File Explorer
persistence queue rather than direct optimistic success.

All editable-document writers now pass through the session.

## Lifecycle gates

### Tab activation

`registry.activate(nextItemId)` commits the current session draft and flushes the current editable
document before changing `activeItemId` or navigating. If flush fails, activation is cancelled and
the current tab stays active with inline error state.

### Tab close

Closing an editable tab commits its draft and flushes it. On failure, show:

- **Keep editing**: cancel close;
- **Retry save**: retry and close only after success;
- **Close without saving**: `discard()`, then dispose and close.

Closing a non-active tab applies the same rule without activating it.

### Route navigation

A `PresentationNavigationGuard` mounted beside the registry uses React Router's blocker API.
Leaving `/presentations` commits drafts and flushes every dirty/saving/error editable session.
Navigation proceeds only after success. Failure opens the same decision UI and leaves the current
route intact.

Programmatic Home/File buttons, sidebar navigation, browser Back/Forward, tab activation, and
workspace redirects all use this gate. No component calls `navigate()` first and tries to save
after unmount.

### Browser reload and close

Browser `beforeunload` cannot await IndexedDB. When any session is dirty, saving, or errored, the
guard calls `preventDefault()` and lets the browser show its native confirmation. It does not claim
that async flush completed. The 250 ms coordinator normally minimizes this exposure.

On explicit in-app close, the async route/close gate runs before `window.close()`.

### Electron window close

Electron uses an explicit main/renderer handshake:

1. main-window `close` prevents default unless a one-shot close permit is set;
2. main sends `app:close-requested`;
3. renderer commits drafts and calls `registry.flushAll()`;
4. on success renderer invokes `app:confirm-close`;
5. main consumes the one-shot permit and closes;
6. on failure renderer keeps the window open and shows Retry / Keep editing / Close without saving;
7. Close without saving discards all unsafe sessions before confirming close.

Preload exposes typed listener/confirmation methods. Browser mode uses only the browser gate.
Projection-window closing remains unchanged.

## Projection consistency

Every editable projection command:

1. gets the open session by item ID;
2. commits its active draft;
3. awaits `session.flush()`;
4. reads the session's highest persisted document;
5. resolves the active slide ID to an index only at the projection adapter boundary;
6. builds the payload from that exact document revision.

If flush fails, projection is not changed and the operator sees the save error. Projection never
reloads the derived mirror to build a payload for an open session.

Read-only PPTX projection behavior remains unchanged.

## React integration

- `PresentationWorkspacePage` opens/activates sessions through the registry.
- `EditableDocumentView` uses `useSyncExternalStore` to render a session snapshot.
- Local component state contains only ephemeral selection/tool/panel state.
- Header reads `canUndo`, `canRedo`, save status, and warnings from the serializable workspace
  store, then calls registry commands.
- Remove `hhc:presentation-undo-state` and `hhc:presentation-undo-request`.
- Standard shortcuts use the existing shortcut registry and presentation scope.
- Presentation Undo/Redo does not intercept events from input, textarea, contenteditable, or the
  active presentation text editor.

## User-visible behavior

- Header shows Saving, Saved, Unsaved, or Save failed; failure includes Retry.
- Derived/thumbnail warning is a non-blocking indicator and does not say the document is unsaved.
- Undo and Redo buttons have truthful disabled state.
- Windows/Linux: Ctrl+Z and Ctrl+Y.
- macOS: Cmd+Z and Cmd+Shift+Z.
- A tab/route/window cannot silently discard a dirty revision.
- A user can explicitly choose Close without saving after a failed flush.

## Testing strategy

### Pure history

- identical commit is a no-op;
- one command creates one past entry and clears future;
- Undo/Redo move documents correctly;
- new commit after Undo clears future;
- history keeps 30 entries;
- selection/tool changes create no document history.

### Drafts

- two-second pointer drag creates one transaction;
- pointer cancel restores the original document;
- consecutive text input creates one transaction after 750 ms idle;
- IME composition is not split;
- slide/tab/navigation/projection commits text draft first;
- Escape cancels an uncommitted draft.

### Save coordinator

- 100 rapid schedules persist only the newest request after debounce;
- at most one authoritative write is in flight;
- updates during a write produce one newest follow-up write;
- stale completion never reports saved;
- failure retains the newest request;
- Retry and flush target the newest revision;
- discard generation invalidates stale completion;
- derived/thumbnail failure reports warning while source remains saved;
- dispose leaves no timers or subscribers.

### Persistence reconciliation

- source Blob and catalog metadata commit together;
- load always prefers source over stale derived JSON;
- derived revision mismatch schedules repair;
- source missing with derived present is an explicit error;
- editable rename updates catalog and canonical document through one coordinator revision.

### Lifecycle

- activating, closing, navigating, browser Back, and Electron close flush before teardown;
- failed flush blocks transition;
- Close without saving restores the last persisted document and performs no write;
- `beforeunload` is registered only while unsafe work exists;
- Electron close permit is one-shot and projection close is unaffected.

### Projection

- active draft commits before projection;
- projection uses the highest persisted session revision;
- save failure leaves existing projection unchanged;
- active slide ID resolves to the correct index after slide insert/delete.

### Regression gates

- existing presentation load/save/conversion/payload/workspace tests;
- focused browser and Electron lifecycle tests;
- `npm run lint`;
- `npm run typecheck`;
- `npx vitest run`;
- `npm run build`;
- browser projection E2E and packaged Windows projection smoke.

## Acceptance criteria

- Open editor sessions survive routed-view unmount until explicit close.
- A pointer drag and continuous text edit each create exactly one Undo entry.
- Undo/Redo operate on documents and never resurrect stale selection/editing UI.
- One stable slide ID is the only workspace active-slide truth.
- At most one authoritative save per document is in flight.
- Highest scheduled revision equals highest authoritative persisted revision after flush.
- Source Blob wins every normal load reconciliation.
- Save failure remains visible and retryable without losing local edits.
- Editable rename cannot bypass the session coordinator.
- Tab switch, close, navigation, reload warning, Electron close, and projection obey their gates.
- Projection payload equals the flushed session revision.
- No presentation Undo custom DOM event remains.
- No new dependency is introduced.

## Follow-up milestones

After R2 passes:

1. R3 adds durable projection-session replay and display recovery.
2. R4 makes the operator Media workspace persistent while projection remains live.
3. R5 implements the PowerPoint-like shell and essential editing operations on this session model.
