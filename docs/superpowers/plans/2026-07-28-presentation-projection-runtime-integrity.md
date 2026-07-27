# Presentation and Projection Runtime Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve editable-presentation revision continuity, make Electron projection Retry recover an opening timeout, and allow app shutdown after the main renderer exits.

**Architecture:** Keep the existing integer revision and Electron IPC contracts. Load the editable document and its persisted revision as one IndexedDB snapshot, seed the editor save coordinator from that revision, reject stale writes transactionally, and make `WindowManager` replace non-ready projection windows while bypassing close confirmation only after `render-process-gone`.

**Tech Stack:** TypeScript, React 19, Electron, IndexedDB/idb, Vitest

## Global Constraints

- Preserve Electron and browser mode behavior.
- Do not change LAN, Ribbon, font, PPTX layout, or browser projection-session behavior in this batch.
- No new dependencies or speculative abstractions.
- Use the existing `file-blobs.revision` field and projection generation guards.
- Write each regression test first and verify its expected failure before production edits.

---

### Task 1: Seed Presentation Sessions from Persisted Revision

**Files:**
- Modify: `src/renderer/src/lib/editable-presentation.ts`
- Modify: `src/renderer/src/lib/presentation-save-coordinator.ts`
- Modify: `src/renderer/src/lib/presentation-editor-session.ts`
- Modify: `src/renderer/src/contexts/PresentationSessionRegistryContext.tsx`
- Test: `src/renderer/src/lib/__tests__/editable-presentation.test.ts`
- Test: `src/renderer/src/lib/__tests__/presentation-save-coordinator.test.ts`
- Test: `src/renderer/src/lib/__tests__/presentation-editor-session.test.ts`
- Test: `src/renderer/src/contexts/__tests__/PresentationSessionRegistryContext.test.tsx`

**Interfaces:**
- Produces: `loadEditablePresentationSnapshot(source): Promise<EditablePresentationSnapshot>`
- Produces: `EditablePresentationSnapshot = { document: EditablePresentationDocument; revision: number }`
- Extends: `createPresentationEditorSession({ initialDocument, initialRevision, persist, refreshThumbnail })`
- Extends: `createPresentationSaveCoordinator(initialDocument, persist, initialRevision?, debounceMs?)`

- [x] **Step 1: Add a failing loader snapshot test**

Seed `file-blobs` with revision `4`, call the new snapshot API, and assert:

```ts
await expect(loadEditablePresentationSnapshot(source)).resolves.toMatchObject({
  revision: 4,
  document: { name: 'Sunday' }
})
```

- [x] **Step 2: Run the loader test and verify RED**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/editable-presentation.test.ts
```

Expected: FAIL because `loadEditablePresentationSnapshot` is not exported.

- [x] **Step 3: Add the minimal snapshot loader**

Move the existing IndexedDB read, cache lookup, blob parse, and cache population into:

```ts
export interface EditablePresentationSnapshot {
  document: EditablePresentationDocument
  revision: number
}

export async function loadEditablePresentationSnapshot(
  source: EditablePresentationSource
): Promise<EditablePresentationSnapshot>
```

Use `record.revision ?? 0`. Keep the existing compatibility API:

```ts
export async function loadEditablePresentation(
  source: EditablePresentationSource
): Promise<EditablePresentationDocument> {
  return (await loadEditablePresentationSnapshot(source)).document
}
```

- [x] **Step 4: Run the loader test and verify GREEN**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/editable-presentation.test.ts
```

Expected: PASS.

- [x] **Step 5: Add failing coordinator and session tests**

Coordinator:

```ts
const coordinator = createPresentationSaveCoordinator(initialDocument, persist, 4)
expect(coordinator.getState()).toMatchObject({
  scheduledRevision: 4,
  persistedRevision: 4
})
expect(coordinator.schedule(changedDocument)).toBe(5)
```

Editor session:

```ts
const session = createPresentationEditorSession({
  initialDocument,
  initialRevision: 4,
  persist,
  refreshThumbnail
})
session.commit(changedDocument)
expect(session.getSnapshot().save.scheduledRevision).toBe(5)
```

Registry test: mock `loadEditablePresentationSnapshot()` with revision `4`, open the item, and assert `createPresentationEditorSession()` receives `initialRevision: 4`.

- [x] **Step 6: Run the three tests and verify RED**

Run:

```bash
npx vitest run \
  src/renderer/src/lib/__tests__/presentation-save-coordinator.test.ts \
  src/renderer/src/lib/__tests__/presentation-editor-session.test.ts \
  src/renderer/src/contexts/__tests__/PresentationSessionRegistryContext.test.tsx
```

Expected: FAIL because the coordinator/session do not accept or forward `initialRevision`.

- [x] **Step 7: Implement revision seeding**

Initialize coordinator state and `nextRevision` from `initialRevision`. Add `initialRevision?: number`
to the editor session options and forward it. Change the registry loader mock and production import
from `loadEditablePresentation` to `loadEditablePresentationSnapshot`.

- [x] **Step 8: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run \
  src/renderer/src/lib/__tests__/editable-presentation.test.ts \
  src/renderer/src/lib/__tests__/presentation-save-coordinator.test.ts \
  src/renderer/src/lib/__tests__/presentation-editor-session.test.ts \
  src/renderer/src/contexts/__tests__/PresentationSessionRegistryContext.test.tsx
```

Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add \
  src/renderer/src/lib/editable-presentation.ts \
  src/renderer/src/lib/presentation-save-coordinator.ts \
  src/renderer/src/lib/presentation-editor-session.ts \
  src/renderer/src/contexts/PresentationSessionRegistryContext.tsx \
  src/renderer/src/lib/__tests__/editable-presentation.test.ts \
  src/renderer/src/lib/__tests__/presentation-save-coordinator.test.ts \
  src/renderer/src/lib/__tests__/presentation-editor-session.test.ts \
  src/renderer/src/contexts/__tests__/PresentationSessionRegistryContext.test.tsx
git commit -m "fix: preserve presentation revisions across sessions"
```

### Task 2: Reject Stale Presentation Writes

**Files:**
- Modify: `src/renderer/src/lib/editable-presentation-persistence.ts`
- Test: `src/renderer/src/lib/__tests__/editable-presentation-persistence.test.ts`

**Interfaces:**
- Consumes: `EditablePresentationRevisionWrite.revision`
- Consumes: `FileBlobRecord.revision`
- Produces: rejection before source or catalog mutation when `write.revision <= storedRevision`

- [x] **Step 1: Write the failing stale-write transaction test**

Seed source revision `4`, attempt to persist a different document at revision `4`, and assert:

```ts
await expect(persistEditablePresentationRevision(write)).rejects.toThrow(
  'Presentation revision 4 is not newer than persisted revision 4'
)
await expect(db.get('file-blobs', 'deck-source')).resolves.toMatchObject({ revision: 4 })
await expect(db.get('folder-items', item.id)).resolves.toMatchObject({ name: item.name })
```

Also parse the stored blob and assert its original document name is unchanged.

- [x] **Step 2: Run the persistence test and verify RED**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/editable-presentation-persistence.test.ts
```

Expected: FAIL because equal revisions currently overwrite.

- [x] **Step 3: Implement the transactional revision guard**

After loading source and catalog records, compute:

```ts
const storedRevision = source.revision ?? 0
```

If `write.revision <= storedRevision`, abort the transaction, await the aborted transaction
rejection, and throw the specific stale-revision error. Do not write either object store.

- [x] **Step 4: Run the persistence test and verify GREEN**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/editable-presentation-persistence.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add \
  src/renderer/src/lib/editable-presentation-persistence.ts \
  src/renderer/src/lib/__tests__/editable-presentation-persistence.test.ts
git commit -m "fix: reject stale presentation revisions"
```

### Task 3: Replace Timed-Out Projection Windows on Retry

**Files:**
- Modify: `src/main/windowManager.ts`
- Test: `src/main/__tests__/windowManager.test.ts`

**Interfaces:**
- Consumes: existing `retryProjectionWindow(): { retried: boolean; generation: number }`
- Preserves: `retried: false` for `closed` and `ready`
- Produces: a replacement generation for `opening`, `recovering`, and `failed`

- [x] **Step 1: Write the failing opening-Retry test**

Create a projection window and call Retry before it reports ready:

```ts
const firstGeneration = wm.createProjectionWindow()
const firstWindow = FakeBrowserWindow.instances[0]

expect(wm.retryProjectionWindow()).toEqual({
  retried: true,
  generation: firstGeneration + 1
})
expect(firstWindow.close).toHaveBeenCalledOnce()
expect(FakeBrowserWindow.instances).toHaveLength(2)
```

Assert the new lifecycle is `opening` and stale `closed`/renderer events from the first window do
not clear the replacement.

- [x] **Step 2: Run the WindowManager test and verify RED**

Run:

```bash
npx vitest run src/main/__tests__/windowManager.test.ts
```

Expected: FAIL with `retried: false`.

- [x] **Step 3: Implement non-ready replacement**

Return no-op for `closed` and `ready`. For an existing tracked window:

```ts
this.closingProjectionWindows.add(projectionWindow)
this.projectionWindow = null
projectionWindow.close()
```

Reset the automatic recovery budget and call `createProjectionWindow()` to allocate a new
generation.

- [x] **Step 4: Run WindowManager tests and verify GREEN**

Run:

```bash
npx vitest run src/main/__tests__/windowManager.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/main/windowManager.ts src/main/__tests__/windowManager.test.ts
git commit -m "fix: recreate timed-out projection on retry"
```

### Task 4: Allow Close After Main Renderer Exit

**Files:**
- Modify: `src/main/windowManager.ts`
- Test: `src/main/__tests__/windowManager.test.ts`

**Interfaces:**
- Preserves: one-use `mainClosePermit` for healthy renderer confirmation
- Produces: unguarded close after `render-process-gone` for the current main window

- [ ] **Step 1: Write the failing crash-close test**

```ts
wm.createMainWindow()
const mainWindow = FakeBrowserWindow.instances[0]
mainWindow.emitWebContents('render-process-gone', {}, { reason: 'crashed' })
const closeEvent = { preventDefault: vi.fn() }

mainWindow.emit('close', closeEvent)

expect(closeEvent.preventDefault).not.toHaveBeenCalled()
expect(mainWindow.webContents.send).not.toHaveBeenCalledWith('app:close-requested')
```

- [ ] **Step 2: Run the WindowManager test and verify RED**

Run:

```bash
npx vitest run src/main/__tests__/windowManager.test.ts
```

Expected: FAIL because close is prevented and `app:close-requested` is sent.

- [ ] **Step 3: Implement the renderer-gone guard**

Add a private boolean initialized/reset when creating the main window. Set it in the current main
window’s `render-process-gone` handler. In the close handler, return without preventing close when
the boolean is true.

Reset it in `cleanup()` so tests and any future main-window recreation start healthy.

- [ ] **Step 4: Run WindowManager tests and verify GREEN**

Run:

```bash
npx vitest run src/main/__tests__/windowManager.test.ts
```

Expected: PASS, including the existing healthy close-permit test.

- [ ] **Step 5: Commit**

```bash
git add src/main/windowManager.ts src/main/__tests__/windowManager.test.ts
git commit -m "fix: allow shutdown after renderer crash"
```

### Task 5: Batch Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

```bash
npx vitest run \
  src/main/__tests__/windowManager.test.ts \
  src/renderer/src/lib/__tests__/editable-presentation.test.ts \
  src/renderer/src/lib/__tests__/editable-presentation-persistence.test.ts \
  src/renderer/src/lib/__tests__/presentation-save-coordinator.test.ts \
  src/renderer/src/lib/__tests__/presentation-editor-session.test.ts \
  src/renderer/src/contexts/__tests__/PresentationSessionRegistryContext.test.tsx
```

- [ ] **Step 2: Run static verification**

```bash
npm run typecheck
npm run lint
git diff --check
```

- [ ] **Step 3: Run the full suite and build**

```bash
npx vitest run
npm run build
```

- [ ] **Step 4: Inspect repository state**

```bash
git status --short --branch
git log --oneline -6
```

Expected: only intentional commits, no uncommitted production or test changes.
