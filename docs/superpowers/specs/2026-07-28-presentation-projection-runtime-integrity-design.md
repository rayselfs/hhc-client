# Presentation and Projection Runtime Integrity Design

## Goal

Fix three runtime integrity failures before continuing UI work:

1. An editable presentation must keep increasing its persisted revision after close and reopen.
2. Retrying an Electron projection that timed out while opening must recreate the projection window.
3. The main window must remain closable after its renderer process has exited.

## Scope

This design changes only presentation revision continuity and Electron window lifecycle behavior.

It does not change:

- LAN remote control
- presentation Ribbon or Header layout
- font-size units or local font discovery
- PPTX text fidelity
- browser projection session isolation

Those remain separate, independently testable changes.

## Current Failures

### Presentation revision reuse

`createPresentationSaveCoordinator()` always initializes `nextRevision`,
`scheduledRevision`, and `persistedRevision` to `0`. The persisted source record already contains a
`revision`, but `PresentationSessionRegistryContext` loads only the document.

After saving revision `1`, closing, reopening, and saving again, the new session writes revision `1`
again. `loadEditablePresentation()` caches documents using `<blobId>:<revision>`, so the reused key
can resolve to stale document content.

### Projection retry mismatch

The renderer-side coordinator owns the ready timeout and changes its local recovery state to
`failed`. The Electron main process still reports the window as `opening`. The Retry IPC reaches
`WindowManager.retryProjectionWindow()`, which currently accepts only a main-process `failed`
state, so it returns `retried: false`.

### Main renderer crash close loop

The main-window close handler always prevents close and asks the renderer to confirm presentation
saves. After `render-process-gone`, that renderer cannot answer, so every close request is
prevented permanently.

## Approaches Considered

### Presentation revisions

1. **Seed the editor session from the persisted source revision and reject stale writes.**
   This keeps the existing integer revision contract and fixes both cache identity and concurrent
   stale writes.
2. Use timestamps or random revision IDs. This changes more public types and does not remove the
   need to compare persisted state.
3. Clear the document cache after every save. This treats the cache symptom while revision
   collisions remain.

Selected: approach 1.

### Projection retry

1. **Let Retry replace an existing non-ready Electron projection window.** This preserves the
   current renderer timeout and makes Retry idempotently recreate `opening`, `recovering`, or
   `failed` windows.
2. Move the ready timer entirely into `WindowManager`. This gives the main process complete
   lifecycle ownership but requires separate browser/Electron timeout paths and more coordination.
3. Add a new renderer-to-main “mark failed” IPC. This duplicates failure state across processes and
   expands the trust boundary.

Selected: approach 1. Main still owns window creation and replacement; the renderer only requests
Retry through the existing validated IPC.

### Main-window close after crash

1. **Track whether the current main renderer is gone and bypass confirmation only in that state.**
2. Inspect only `webContents.isDestroyed()`. Electron may report the renderer gone while the
   `WebContents` object still exists.
3. Add a timeout to every close confirmation. This changes healthy close behavior and delays exit.

Selected: approach 1.

## Design

### Revision snapshot

Add a loader that returns the parsed document and the source record revision from the same IndexedDB
read:

```ts
interface EditablePresentationSnapshot {
  document: EditablePresentationDocument
  revision: number
}
```

`loadEditablePresentation()` remains as the document-only compatibility API for preview,
projection, payload, and existing tests. `PresentationSessionRegistryContext` uses the snapshot API
and passes `initialRevision` into `createPresentationEditorSession()`.

`createPresentationSaveCoordinator()` accepts `initialRevision = 0` and initializes:

- `nextRevision`
- `state.scheduledRevision`
- `state.persistedRevision`

to that value.

`persistEditablePresentationRevision()` compares the requested revision with the current source
revision inside the existing read-write transaction. A requested revision less than or equal to
the stored revision is rejected before either source or catalog is written. This makes stale or
colliding sessions fail visibly instead of overwriting newer content.

Documents without a stored revision use `0`, preserving existing files.

### Projection retry replacement

`WindowManager.retryProjectionWindow()` treats `opening`, `recovering`, and `failed` as retryable.
If a projection window still exists, it is marked as intentionally closing, detached from
`this.projectionWindow`, and closed before a replacement is created.

Retry continues to return `retried: false` for `closed` or already `ready` lifecycle states.

The replacement receives a new generation. Late lifecycle events from the previous window remain
ignored by the existing window-identity and generation guards.

### Crash-aware main close

`WindowManager` stores a boolean for whether the current main renderer is gone.

- It resets to `false` when creating the main window.
- `render-process-gone` sets it to `true`.
- The close handler bypasses `app:close-requested` when the flag is true.
- The existing one-use `mainClosePermit` behavior remains unchanged for a healthy renderer.
- Closing and creating a later main window resets the state.

No timeout or automatic save bypass is introduced during normal operation.

## Error Handling

- A stale presentation revision throws a specific error containing the requested and stored
  revisions. The existing save coordinator exposes it through its `error` state.
- A Retry replacement closes only the currently tracked projection window. Stale window events
  cannot close or overwrite the new generation.
- Renderer crash bypass applies only after Electron emits `render-process-gone` for the current main
  window.

## Tests

### Presentation

- Coordinator initialized at revision `4` schedules revision `5`.
- Registry snapshot forwards the stored revision into the editor session.
- Persistence rejects revision `4` when the source already stores revision `4` and leaves source and
  catalog unchanged.
- Save revision `1`, close/reopen, save again, and verify revision `2` loads fresh content rather
  than the cached revision `1`.

### Projection and window lifecycle

- Retry while lifecycle is `opening` closes the old projection and creates a new generation.
- Retry while `failed` retains the existing successful behavior.
- Retry while `ready` or `closed` remains a no-op.
- After main `render-process-gone`, a close event is not prevented and no
  `app:close-requested` message is sent.
- Healthy renderer close confirmation still consumes exactly one permit.

## Acceptance Criteria

- No editable presentation save can overwrite an equal or newer persisted revision.
- Reopening a presentation continues from the persisted revision and produces a new cache key on
  the next save.
- Electron ready-timeout Retry creates a replacement projection window.
- A crashed main renderer cannot trap the application in the close guard.
- Focused tests, node and renderer typechecks, full Vitest, build, and `git diff --check` pass.
