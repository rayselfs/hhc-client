# R2 Presentation Trust Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every editable presentation a route-independent session with document-only
Undo/Redo, serialized authoritative saving, explicit drafts, visible recovery state, lifecycle
guards, and projection output from the flushed revision.

**Architecture:** A control-window Context owns one non-serializable editor session per editable
document while Zustand holds serializable tab and status metadata. The File Explorer source Blob
and catalog item commit atomically as authority; derived JSON and thumbnails are repairable
mirrors. React views subscribe to sessions and lifecycle/projection commands must commit drafts and
flush before leaving or outputting.

**Tech Stack:** React 19, TypeScript, Zustand 5, IndexedDB through `idb`, React Router 7, Electron
39 IPC, HeroUI v3, Vitest

## Global Constraints

- No new dependency or storage database.
- Source Blob plus catalog item are authoritative; a derived presentation document never wins
  normal load reconciliation.
- At most one authoritative persistence write is in flight per editable document.
- History contains documents only; selection, tools, panels, and editing modes remain ephemeral.
- `activeSlideIdByItemId` is the only workspace active-slide truth.
- Browser `beforeunload` warns but never claims it awaited IndexedDB.
- Electron close uses a typed one-shot main/renderer permit and never changes projection-window
  close behavior.
- Editable rename and projection output must go through the open session.
- Reuse HeroUI v3 compound components and existing semantic variants; do not use HeroUI v2 APIs.
- Preserve browser/Electron dual mode and existing File Explorer soft-delete behavior.

---

### Task 1: Add Document History and the Serialized Save Coordinator

**Files:**
- Create: `src/renderer/src/lib/presentation-history.ts`
- Create: `src/renderer/src/lib/presentation-save-coordinator.ts`
- Create: `src/renderer/src/lib/__tests__/presentation-history.test.ts`
- Create: `src/renderer/src/lib/__tests__/presentation-save-coordinator.test.ts`

**Interfaces:**

```ts
export interface PresentationHistoryState {
  past: EditablePresentationDocument[]
  present: EditablePresentationDocument
  future: EditablePresentationDocument[]
}

export function commitPresentationDocument(
  state: PresentationHistoryState,
  next: EditablePresentationDocument
): PresentationHistoryState
export function undoPresentationDocument(
  state: PresentationHistoryState
): PresentationHistoryState
export function redoPresentationDocument(
  state: PresentationHistoryState
): PresentationHistoryState

export type PresentationSaveStatus = 'dirty' | 'saving' | 'saved' | 'error'
export type PresentationMirrorWarning = 'derived-document' | 'thumbnail'

export interface PresentationSaveState {
  status: PresentationSaveStatus
  scheduledRevision: number
  persistedRevision: number
  error: string | null
  mirrorWarnings: PresentationMirrorWarning[]
}

export interface PresentationSaveRequest {
  revision: number
  document: EditablePresentationDocument
  catalogName?: string
}

export type PersistPresentationRevision = (
  request: PresentationSaveRequest
) => Promise<{
  revision: number
  mirrorWarnings: PresentationMirrorWarning[]
}>

export interface PresentationSaveCoordinator {
  schedule(document: EditablePresentationDocument, catalogName?: string): number
  retry(): void
  flush(): Promise<void>
  discard(): Promise<void>
  subscribe(listener: (state: PresentationSaveState) => void): () => void
  getState(): PresentationSaveState
  getLastPersistedDocument(): EditablePresentationDocument
  dispose(): void
}

export function createPresentationSaveCoordinator(
  initialDocument: EditablePresentationDocument,
  persist: PersistPresentationRevision,
  debounceMs?: number
): PresentationSaveCoordinator
```

- [ ] **Step 1: Write RED document-history tests**

Cover identical commit, 30-entry limit, Undo/Redo, and redo invalidation:

```ts
it('clears future after a new commit following undo', () => {
  const first = createBlankEditablePresentationDocument('First', 'deck')
  const second = { ...first, name: 'Second' }
  const third = { ...first, name: 'Third' }
  const undone = undoPresentationDocument(
    commitPresentationDocument({ past: [], present: first, future: [] }, second)
  )

  const committed = commitPresentationDocument(undone, third)

  expect(committed.present.name).toBe('Third')
  expect(committed.future).toEqual([])
})
```

- [ ] **Step 2: Run history tests and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/presentation-history.test.ts
```

Expected: module import fails because `presentation-history.ts` does not exist.

- [ ] **Step 3: Implement pure document-only history**

Use JSON-stable document equality through direct identity first and `JSON.stringify` only for
different objects. Keep `past.slice(-29)` before appending the current document. Do not accept or
store selection/tool fields.

```ts
export function commitPresentationDocument(
  state: PresentationHistoryState,
  next: EditablePresentationDocument
): PresentationHistoryState {
  if (state.present === next || JSON.stringify(state.present) === JSON.stringify(next)) return state
  return {
    past: [...state.past.slice(-29), state.present],
    present: next,
    future: []
  }
}
```

- [ ] **Step 4: Run history tests and verify GREEN**

Run the Step 2 command. Expected: all history tests pass.

- [ ] **Step 5: Write RED save-coordinator tests with fake timers**

Use a controlled persistence function and `vi.useFakeTimers()`. Cover:

```ts
it('serializes writes and keeps only the newest pending revision', async () => {
  const firstWrite = Promise.withResolvers<{ revision: number; mirrorWarnings: [] }>()
  const persist = vi
    .fn()
    .mockImplementationOnce(() => firstWrite.promise)
    .mockResolvedValueOnce({ revision: 3, mirrorWarnings: [] })
  const coordinator = createPresentationSaveCoordinator(initialDocument, persist)

  coordinator.schedule({ ...initialDocument, name: 'One' })
  await vi.advanceTimersByTimeAsync(250)
  coordinator.schedule({ ...initialDocument, name: 'Two' })
  coordinator.schedule({ ...initialDocument, name: 'Three' })

  expect(persist).toHaveBeenCalledTimes(1)
  firstWrite.resolve({ revision: 1, mirrorWarnings: [] })
  await coordinator.flush()

  expect(persist).toHaveBeenCalledTimes(2)
  expect(persist.mock.calls[1][0].document.name).toBe('Three')
  expect(coordinator.getState()).toMatchObject({
    status: 'saved',
    scheduledRevision: 3,
    persistedRevision: 3
  })
})
```

Also test error retention, retry newest, flush bypass, discard waiting for an in-flight write,
generation-safe stale callbacks, mirror warnings, and timer/subscriber disposal.

- [ ] **Step 6: Run coordinator tests and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/presentation-save-coordinator.test.ts
```

- [ ] **Step 7: Implement the coordinator state machine**

Use one `inFlight` Promise, one `pendingRequest`, one debounce timer, monotonic
`scheduledRevision`, and a `generation` counter. `discard()` cancels pending work, awaits the
current write with rejection converted to state, restores the last actually persisted document,
increments generation, and reports `saved`. Inside `createPresentationSaveCoordinator`, keep
`publish`, `armDebounce`, `clearDebounce`, and `drain` as private closures; `drain` loops until the
single in-flight write and newest pending request are both exhausted.

```ts
const schedule = (
  document: EditablePresentationDocument,
  catalogName?: string
): number => {
  scheduledRevision += 1
  pendingRequest = { revision: scheduledRevision, document, catalogName }
  publish({ ...state, status: 'dirty', scheduledRevision, error: null })
  armDebounce()
  return scheduledRevision
}

const flush = async (): Promise<void> => {
  clearDebounce()
  await drain()
  if (state.persistedRevision !== scheduledRevision) {
    throw new Error('Latest presentation revision was not persisted')
  }
}
```

- [ ] **Step 8: Run Task 1 tests and verify GREEN**

```bash
npx vitest run src/renderer/src/lib/__tests__/presentation-history.test.ts src/renderer/src/lib/__tests__/presentation-save-coordinator.test.ts
```

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/lib/presentation-history.ts src/renderer/src/lib/presentation-save-coordinator.ts src/renderer/src/lib/__tests__/presentation-history.test.ts src/renderer/src/lib/__tests__/presentation-save-coordinator.test.ts
git commit -m "feat: add presentation history and save coordinator"
```

---

### Task 2: Make Source Blob and Catalog the Authoritative Revision

**Files:**
- Modify: `src/renderer/src/lib/file-explorer-db.ts`
- Modify: `src/renderer/src/lib/media-work-db.ts`
- Modify: `src/renderer/src/lib/editable-presentation.ts`
- Create: `src/renderer/src/lib/editable-presentation-persistence.ts`
- Create: `src/renderer/src/lib/__tests__/editable-presentation-persistence.test.ts`
- Modify: `src/renderer/src/lib/__tests__/editable-presentation.test.ts`

**Interfaces:**

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
export async function refreshEditablePresentationThumbnail(
  document: EditablePresentationDocument
): Promise<void>
```

- [ ] **Step 1: Write RED authority and reconciliation tests**

Require:

```ts
it('commits source Blob and catalog rename in one transaction', async () => {
  const result = await persistEditablePresentationRevision({
    itemId: item.id,
    sourceBlobId: item.id,
    revision: 4,
    document: { ...document, name: 'Renamed' },
    catalogName: 'Renamed.lpdeck'
  })

  expect(result).toEqual({ revision: 4, mirrorWarnings: [] })
  await expect(db.get('file-blobs', item.id)).resolves.toMatchObject({ revision: 4 })
  await expect(db.get('folder-items', item.id)).resolves.toMatchObject({
    name: 'Renamed.lpdeck'
  })
})
```

Add cases proving an authoritative transaction failure leaves both records unchanged, derived
failure returns a warning after source commit, source JSON wins over a stale derived JSON, source
missing plus derived present rejects, and derived revision mismatch schedules repair without
blocking load.

- [ ] **Step 2: Run persistence tests and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/editable-presentation-persistence.test.ts src/renderer/src/lib/__tests__/editable-presentation.test.ts
```

- [ ] **Step 3: Add additive revision metadata**

Add `revision?: number` to `FileBlobRecord` and `presentationRevision?: number` to
`DerivedAssetMetadata`. Do not bump either database version.

```ts
export interface FileBlobRecord {
  id: string
  blob?: Blob
  storage?: 'indexed-db' | 'native-fs'
  size?: number
  refCount?: number
  revision?: number
}

export interface DerivedAssetMetadata {
  presentationDocumentJson?: string
  presentationRevision?: number
}
```

- [ ] **Step 4: Implement authoritative write and mirror warning**

Serialize once. In one `hhc-file-explorer` transaction update `file-blobs` and the existing
`folder-items` record. After `tx.done`, write the derived asset with the same body and revision.
Catch only the derived write and return `['derived-document']`; never catch the authoritative
transaction. Implement `putEditableDocumentMirror()` as a private helper in the new persistence
module, and `repairEditableDocumentMirror()` as a private source-to-derived helper beside
`loadEditablePresentation()`.

```ts
const tx = db.transaction(['file-blobs', 'folder-items'], 'readwrite')
await tx.objectStore('file-blobs').put({
  ...sourceRecord,
  blob,
  size: blob.size,
  revision: write.revision
})
await tx.objectStore('folder-items').put({
  ...item,
  name: write.catalogName ?? item.name,
  size: blob.size
})
await tx.done

try {
  await putEditableDocumentMirror(write, body, blob)
  return { revision: write.revision, mirrorWarnings: [] }
} catch {
  return { revision: write.revision, mirrorWarnings: ['derived-document'] }
}
```

- [ ] **Step 5: Reverse normal load precedence**

`loadEditablePresentation()` reads the source Blob first. After parsing, compare source revision
with the derived `presentationRevision`; invoke a narrow fire-and-forget repair that catches its own
failure. If source is absent, throw even when derived JSON exists.

```ts
const source = await db.get('file-blobs', sourceBlobId)
if (!source?.blob) {
  throw new Error(`Editable presentation source is missing: ${item.id}`)
}
const document = parseEditablePresentation(await readBlobText(source.blob))
if (derived?.metadata?.presentationRevision !== source.revision) {
  void repairEditableDocumentMirror(sourceBlobId, source, document).catch(() => undefined)
}
return document
```

- [ ] **Step 6: Split thumbnail refresh from document persistence**

Move generated-cover persistence behind `refreshEditablePresentationThumbnail(document)`.
Retain `saveEditablePresentation()` temporarily as a compatibility wrapper that calls revision
write then thumbnail refresh; remove the wrapper after all writers migrate in Task 6.

```ts
export async function refreshEditablePresentationThumbnail(
  document: EditablePresentationDocument
): Promise<void> {
  await saveThumbnail(document.id, generateEditablePresentationThumbnail(document))
}
```

- [ ] **Step 7: Run Task 2 tests, typecheck, and lint**

```bash
npx vitest run src/renderer/src/lib/__tests__/editable-presentation-persistence.test.ts src/renderer/src/lib/__tests__/editable-presentation.test.ts
npm run typecheck
npx eslint src/renderer/src/lib/file-explorer-db.ts src/renderer/src/lib/media-work-db.ts src/renderer/src/lib/editable-presentation.ts src/renderer/src/lib/editable-presentation-persistence.ts
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/lib/file-explorer-db.ts src/renderer/src/lib/media-work-db.ts src/renderer/src/lib/editable-presentation.ts src/renderer/src/lib/editable-presentation-persistence.ts src/renderer/src/lib/__tests__/editable-presentation-persistence.test.ts src/renderer/src/lib/__tests__/editable-presentation.test.ts
git commit -m "fix: make presentation source revisions authoritative"
```

---

### Task 3: Add the Route-Independent Editor Session

**Files:**
- Create: `src/renderer/src/lib/presentation-editor-session.ts`
- Create: `src/renderer/src/lib/__tests__/presentation-editor-session.test.ts`

**Interfaces:**

```ts
export type PresentationDraftKind = 'pointer' | 'text'

export interface PresentationSessionSnapshot {
  history: PresentationHistoryState
  save: PresentationSaveState
  draftKind: PresentationDraftKind | null
  renderedDocument: EditablePresentationDocument
}

export interface PresentationEditorSession {
  getSnapshot(): PresentationSessionSnapshot
  subscribe(listener: () => void): () => void
  commit(next: EditablePresentationDocument): void
  undo(): void
  redo(): void
  beginDraft(kind: PresentationDraftKind): void
  previewDraft(next: EditablePresentationDocument): void
  commitDraft(): void
  cancelDraft(): void
  rename(nextName: string, catalogName: string): void
  flush(): Promise<void>
  retry(): void
  discard(): Promise<void>
  dispose(): void
}

export function createPresentationEditorSession(options: {
  initialDocument: EditablePresentationDocument
  persist: PersistPresentationRevision
  refreshThumbnail: (document: EditablePresentationDocument) => Promise<void>
}): PresentationEditorSession
```

- [ ] **Step 1: Write RED session transaction tests**

Test one pointer draft across 120 previews creates one history entry, pointer cancel creates none,
text draft commit creates one, discrete commit first commits text draft, Undo/Redo commit active
draft first, `flush()` commits an active draft before awaiting persistence, rename changes document
without adding history, and discard cancels a draft and restores the coordinator's last persisted
document.

```ts
it('commits 120 pointer previews as one document transaction', () => {
  const session = createPresentationEditorSession({
    initialDocument,
    persist: vi.fn().mockResolvedValue({ revision: 1, mirrorWarnings: [] }),
    refreshThumbnail: vi.fn().mockResolvedValue(undefined)
  })
  session.beginDraft('pointer')
  for (let index = 0; index < 120; index += 1) {
    session.previewDraft(moveFirstElement(session.getSnapshot().renderedDocument, index))
  }
  session.commitDraft()

  expect(session.getSnapshot().history.past).toHaveLength(1)
  expect(session.getSnapshot().save.scheduledRevision).toBe(1)
})
```

- [ ] **Step 2: Run session tests and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/presentation-editor-session.test.ts
```

- [ ] **Step 3: Implement session composition**

Compose Task 1 history and coordinator. `renderedDocument` is draft preview when present, otherwise
`history.present`. Emit one session subscription after each state transition. `commitDraft()` must
compare the draft against the pre-draft document before adding history.

```ts
const commitDraft = (): void => {
  if (!draft) return
  const next = draft.preview
  draft = null
  history = commitPresentationDocument(history, next)
  coordinator.schedule(history.present)
  emit()
}

const cancelDraft = (): void => {
  if (!draft) return
  draft = null
  emit()
}

const flush = async (): Promise<void> => {
  commitDraft()
  await coordinator.flush()
}

const discard = async (): Promise<void> => {
  cancelDraft()
  await coordinator.discard()
  const persisted = coordinator.getLastPersistedDocument()
  history = { past: [], present: persisted, future: [] }
  emit()
}
```

- [ ] **Step 4: Add latest-idle thumbnail scheduling**

After coordinator reports latest `saved`, schedule exactly one thumbnail refresh for that revision.
If a newer revision appears, retain a `thumbnail` warning until the later idle pass succeeds.

```ts
if (
  save.status === 'saved' &&
  save.persistedRevision === save.scheduledRevision &&
  thumbnailRevision < save.persistedRevision
) {
  void refreshThumbnail(history.present)
    .then(() => {
      thumbnailRevision = save.persistedRevision
      setThumbnailWarning(false)
    })
    .catch(() => setThumbnailWarning(true))
}
```

- [ ] **Step 5: Run Task 3 tests and verify GREEN**

Run the Step 2 command. Expected: all session tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/presentation-editor-session.ts src/renderer/src/lib/__tests__/presentation-editor-session.test.ts
git commit -m "feat: add presentation editor sessions"
```

---

### Task 4: Add the Session Registry and Stable Slide-ID Workspace State

**Files:**
- Create: `src/renderer/src/contexts/PresentationSessionRegistryContext.tsx`
- Create: `src/renderer/src/contexts/__tests__/PresentationSessionRegistryContext.test.tsx`
- Modify: `src/renderer/src/stores/presentation-workspace.ts`
- Modify: `src/renderer/src/stores/__tests__/presentation-workspace.test.ts`
- Modify: `src/renderer/src/components/Control/Layout.tsx`

**Interfaces:**

```ts
export type CloseDecision = 'keep-editing' | 'retry' | 'discard'

export interface PresentationSessionRegistry {
  open(item: FileItemRecord): Promise<PresentationEditorSession>
  get(itemId: string): PresentationEditorSession | undefined
  activate(itemId: string): Promise<boolean>
  close(itemId: string, decision?: CloseDecision): Promise<boolean>
  flushAll(): Promise<void>
  discardAll(): Promise<void>
  hasUnsafeWork(): boolean
  getUnsafeItemIds(): string[]
  subscribe(listener: () => void): () => void
}
```

- [ ] **Step 1: Write RED workspace-store migration tests**

Replace index assertions with:

```ts
usePresentationWorkspaceStore.getState().setActiveSlideId('deck-1', 'slide-b')
expect(usePresentationWorkspaceStore.getState().getActiveSlideId('deck-1')).toBe('slide-b')
```

Require `saveStatus`, `mirrorWarnings`, `canUndo`, and `canRedo` updates to touch only the target
document. Remove `activeSlideByItemId`, `setActiveSlide`, and `getActiveSlide`.

- [ ] **Step 2: Implement stable slide-ID metadata**

Add `activeSlideIdByItemId`, `setActiveSlideId`, `getActiveSlideId`, and
`updateEditorMetadata(itemId, patch)`. `closeDocument` removes the slide ID and editor metadata with
the tab.

```ts
setActiveSlideId: (itemId, slideId) =>
  set((state) => ({
    activeSlideIdByItemId: {
      ...state.activeSlideIdByItemId,
      [itemId]: slideId
    }
  })),
getActiveSlideId: (itemId) => get().activeSlideIdByItemId[itemId] ?? null
```

- [ ] **Step 3: Write RED registry lifecycle tests**

Use fake sessions to prove:

- opening the same item returns one session;
- activating flushes the previously active editable session before store activation;
- failed flush leaves the previous active tab unchanged;
- Undo/Redo stacks survive activation away from and back to a session;
- close without an error flushes then disposes;
- `discard` calls session discard then dispose;
- `flushAll` rejects if any unsafe session rejects;
- registry contents survive child routed-view unmount.

```tsx
it('retains a session when the routed child unmounts', async () => {
  let registry: PresentationSessionRegistry | null = null
  const RegistryProbe = ({ showChild }: { showChild: boolean }) => {
    registry = usePresentationSessionRegistry()
    return showChild ? <div>routed child</div> : null
  }
  const { rerender } = render(
    <PresentationSessionRegistryProvider>
      <RegistryProbe showChild />
    </PresentationSessionRegistryProvider>
  )
  expect(registry).not.toBeNull()
  const session = await registry!.open(editableItem)

  rerender(
    <PresentationSessionRegistryProvider>
      <RegistryProbe showChild={false} />
    </PresentationSessionRegistryProvider>
  )

  expect(registry!.get(editableItem.id)).toBe(session)
})
```

- [ ] **Step 4: Implement the Context registry**

Store sessions in a `Map<string, PresentationEditorSession>` held by the provider. Load documents
through source-first `loadEditablePresentation()`, create a coordinator using Task 2 persistence,
and publish session snapshot metadata into Zustand.

```ts
const open = async (item: FileItemRecord): Promise<PresentationEditorSession> => {
  const existing = sessions.get(item.id)
  if (existing) return existing
  const document = await loadEditablePresentation(item)
  const session = createPresentationEditorSession({
    initialDocument: document,
    persist: (request) =>
      persistEditablePresentationRevision({
        ...request,
        itemId: item.id,
        sourceBlobId: getBlobId(item)
      }),
    refreshThumbnail: refreshEditablePresentationThumbnail
  })
  sessions.set(item.id, session)
  return session
}
```

- [ ] **Step 5: Mount the provider above the Outlet**

In `Layout`, wrap the header and main Outlet inside `PresentationSessionRegistryProvider`. Keep it
inside the existing control-window providers; the projection route remains outside `Layout`.
Tasks 6–8 add the close-decision, navigation, and Electron-close children after their
implementations exist.

```tsx
<PresentationSessionRegistryProvider>
  {isPresentationWorkspace ? <PresentationWorkspaceHeader /> : <Header />}
  <main>
    <Outlet />
  </main>
</PresentationSessionRegistryProvider>
```

- [ ] **Step 6: Run Task 4 tests and static checks**

```bash
npx vitest run src/renderer/src/stores/__tests__/presentation-workspace.test.ts src/renderer/src/contexts/__tests__/PresentationSessionRegistryContext.test.tsx
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/contexts/PresentationSessionRegistryContext.tsx src/renderer/src/contexts/__tests__/PresentationSessionRegistryContext.test.tsx src/renderer/src/stores/presentation-workspace.ts src/renderer/src/stores/__tests__/presentation-workspace.test.ts src/renderer/src/components/Control/Layout.tsx
git commit -m "feat: retain presentation sessions across routes"
```

---

### Task 5: Route Canvas Edits Through Session Drafts and Transactions

**Files:**
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx`
- Modify: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx`
- Modify: `src/renderer/src/components/Common/EditableSlideSurface.tsx`
- Modify: `src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx`
- Create: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx`

- [ ] **Step 1: Write RED routed-session tests**

Require the page to render `session.getSnapshot().renderedDocument`, preserve edits across page
unmount/remount, derive the active index from `activeSlideId`, and avoid calling
`saveEditablePresentation()` directly.

```tsx
it('renders the registry session after routed view remount', async () => {
  const { unmount } = renderWorkspaceRoute('/presentations/deck-1')
  session.commit({ ...document, name: 'Unsaved local name' })
  unmount()

  renderWorkspaceRoute('/presentations/deck-1')

  expect(await screen.findByText('Unsaved local name')).toBeInTheDocument()
  expect(mocks.saveEditablePresentation).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Write RED pointer-draft tests**

Change `EditableSlideSurface` callbacks to:

```ts
onTransformStart(): void
onTransformPreview(elementId: string, updates: Partial<EditablePresentationElement>): void
onTransformCommit(): void
onTransformCancel(): void
```

Simulate pointerdown, 100 pointermoves, pointerup and assert one `onTransformStart`, 100 previews,
and one commit. Simulate pointercancel and assert cancel without commit.

- [ ] **Step 3: Run view tests and verify RED**

```bash
npx vitest run src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx
```

- [ ] **Step 4: Replace page-owned document and `past` state**

Use `useSyncExternalStore(session.subscribe, session.getSnapshot)` and route every discrete
document command through `session.commit()`. Delete `setPast`, page-owned `undo`, direct
`saveEditablePresentation`, and both `hhc:presentation-undo-*` event effects.

```ts
const session = registry.get(deck.itemId)
if (!session) throw new Error(`Presentation session is not open: ${deck.itemId}`)
const sessionSnapshot = useSyncExternalStore(
  session.subscribe,
  session.getSnapshot,
  session.getSnapshot
)
const document = sessionSnapshot.renderedDocument
const commitDocument = (next: EditablePresentationDocument): void => session.commit(next)
```

- [ ] **Step 5: Use stable slide IDs**

Read `activeSlideId` from the workspace store. When slide insert/delete changes availability,
select the intended stable ID and derive the visible index only for rail layout. Reconcile deleted
selection IDs after session document transitions.

```ts
const activeSlideId =
  getActiveSlideId(deck.itemId) ?? document.slideOrder[0] ?? null
const activeSlideIndex = Math.max(0, document.slideOrder.indexOf(activeSlideId ?? ''))
```

- [ ] **Step 6: Implement pointer drafts**

On transform start call `session.beginDraft('pointer')`. Preview applies updates to the current
draft document. Pointerup calls `session.commitDraft()` and pointercancel/Escape calls
`session.cancelDraft()`.

```tsx
<EditableSlideSurface
  onTransformStart={() => session.beginDraft('pointer')}
  onTransformPreview={(elementId, updates) => {
    if (!activeSlideId) return
    const preview = session.getSnapshot().renderedDocument
    session.previewDraft(updateElementInSlide(preview, activeSlideId, elementId, updates))
  }}
  onTransformCommit={() => session.commitDraft()}
  onTransformCancel={() => session.cancelDraft()}
/>
```

- [ ] **Step 7: Implement text drafts and IME boundaries**

Begin on first text input, preview during input/composition, reset a 750 ms idle timer only outside
active composition, commit on idle/blur/slide-selection/session command, and cancel on Escape.
Clear the timer on unmount without disposing the registry session.

```ts
const previewText = (next: EditablePresentationDocument): void => {
  if (session.getSnapshot().draftKind !== 'text') session.beginDraft('text')
  session.previewDraft(next)
  if (!isComposingRef.current) {
    window.clearTimeout(textCommitTimerRef.current)
    textCommitTimerRef.current = window.setTimeout(() => session.commitDraft(), 750)
  }
}
```

- [ ] **Step 8: Run Task 5 tests and commit**

```bash
npx vitest run src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx
git add src/renderer/src/pages/PresentationWorkspacePage.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx src/renderer/src/components/Common/EditableSlideSurface.tsx src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx
git commit -m "feat: transact presentation canvas edits"
```

---

### Task 6: Add Header Save State, Undo/Redo, Rename, and Close Decisions

**Files:**
- Modify: `src/renderer/src/components/Control/Header/PresentationWorkspaceHeader.tsx`
- Create: `src/renderer/src/contexts/PresentationCloseDecisionContext.tsx`
- Create: `src/renderer/src/components/Control/Header/PresentationCloseDecisionDialog.tsx`
- Create: `src/renderer/src/components/Control/Header/__tests__/PresentationCloseDecisionDialog.test.tsx`
- Create: `src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx`
- Modify: `src/renderer/src/components/Control/Layout.tsx`
- Modify: `src/renderer/src/config/shortcuts.ts`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`

**Interface:**

```ts
export function usePresentationCloseDecision(): (
  itemIds: string[]
) => Promise<CloseDecision>
```

- [ ] **Step 1: Fetch current HeroUI v3 AlertDialog and Button documentation**

```bash
node .agents/skills/heroui-react/scripts/get_component_docs.mjs AlertDialog Button
```

Confirm the docs use `AlertDialog.Backdrop`, `.Container`, `.Dialog`, `.Header`, `.Body`,
`.Footer`, and Button `onPress`.

- [ ] **Step 2: Write RED header command and status tests**

Cover Undo, Redo, disabled state, Saving/Saved/Unsaved/Save failed labels, Retry, activation gate,
close gate, editable rename through `session.rename()` plus `flush()`, and read-only PPTX rename
through the File Explorer store queue.

```tsx
it('shows failed save state and retries the active session', async () => {
  const user = userEvent.setup()
  render(<PresentationWorkspaceHeader />)
  await user.click(screen.getByRole('button', { name: /retry save/i }))

  expect(activeSession.retry).toHaveBeenCalledTimes(1)
  expect(screen.getByText(/save failed/i)).toBeInTheDocument()
})
```

- [ ] **Step 3: Write RED three-choice dialog tests**

Require exactly `keep-editing`, `retry`, and `discard` outcomes. The dialog uses HeroUI v3 compound
AlertDialog, `tertiary` for Keep editing, `primary` for Retry, and `danger` for Close without saving.
`PresentationCloseDecisionProvider` owns the single pending Promise and is mounted inside
`PresentationSessionRegistryProvider`.

```tsx
it.each([
  ['Keep editing', 'keep-editing'],
  ['Retry save', 'retry'],
  ['Close without saving', 'discard']
])('resolves %s as %s', async (label, expected) => {
  const user = userEvent.setup()
  const decision = openPresentationCloseDecision(['deck-1'])
  await user.click(screen.getByRole('button', { name: label }))
  await expect(decision).resolves.toBe(expected)
})
```

- [ ] **Step 4: Implement and mount the close-decision provider**

Mount the decision provider inside the session registry. It owns at most one unresolved request;
the dialog resolves and clears that request before accepting another.

```tsx
<PresentationSessionRegistryProvider>
  <PresentationCloseDecisionProvider>
    {isPresentationWorkspace ? <PresentationWorkspaceHeader /> : <Header />}
    <main>
      <Outlet />
    </main>
    <PresentationCloseDecisionDialog />
  </PresentationCloseDecisionProvider>
</PresentationSessionRegistryProvider>
```

- [ ] **Step 5: Implement serializable header metadata and registry commands**

Read `canUndo`, `canRedo`, save status, and warnings from the active workspace document. Call
session methods directly through the registry; remove custom DOM event listeners/dispatches.

```tsx
const canUndo = activeDocument?.canUndo === true
const canRedo = activeDocument?.canRedo === true
const session = activeItemId ? registry.get(activeItemId) : undefined

<Button isDisabled={!canUndo} onPress={() => session?.undo()} aria-label={t('presentationWorkspace.undo')}>
  <Undo2 size={18} />
</Button>
<Button isDisabled={!canRedo} onPress={() => session?.redo()} aria-label={t('presentationWorkspace.redo')}>
  <Redo2 size={18} />
</Button>
```

- [ ] **Step 6: Implement rename through the session**

After existing validation, editable rename calls:

```ts
session.commitDraft()
session.rename(nextDocumentName, nextCatalogName)
await session.flush()
```

Only then update visible File Explorer/workspace names. Do not call
`loadEditablePresentation()`/`saveEditablePresentation()` from the header.

- [ ] **Step 7: Register scoped Undo/Redo shortcuts**

Add `SHORTCUTS.PRESENTATION.UNDO` and `.REDO`, with the macOS Redo override nested under `.REDO`.
Before invoking the session, reject events whose target is input, textarea, contenteditable, or the
active presentation text editor. Use the existing presentation shortcut scope so browser-native
text Undo remains intact.

```ts
PRESENTATION: {
  UNDO: { code: 'KeyZ', metaOrCtrl: true },
  REDO: {
    code: 'KeyY',
    metaOrCtrl: true,
    mac: { code: 'KeyZ', meta: true, shift: true }
  }
}
```

- [ ] **Step 8: Add localized status, warning, and decision copy**

Add equivalent keys for English, Traditional Chinese, and Simplified Chinese. Do not expose raw
save errors in the tab label; keep details in the inline error region/toast.

- [ ] **Step 9: Run Task 6 tests and commit**

```bash
npx vitest run src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx src/renderer/src/components/Control/Header/__tests__/PresentationCloseDecisionDialog.test.tsx
git add src/renderer/src/components/Control/Header/PresentationWorkspaceHeader.tsx src/renderer/src/contexts/PresentationCloseDecisionContext.tsx src/renderer/src/components/Control/Header/PresentationCloseDecisionDialog.tsx src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx src/renderer/src/components/Control/Header/__tests__/PresentationCloseDecisionDialog.test.tsx src/renderer/src/components/Control/Layout.tsx src/renderer/src/config/shortcuts.ts src/renderer/src/locales/en.json src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json
git commit -m "feat: expose presentation save recovery"
```

---

### Task 7: Guard Tab, Route, Browser Reload, and In-App Close

**Files:**
- Create: `src/renderer/src/components/Control/PresentationNavigationGuard.tsx`
- Create: `src/renderer/src/components/Control/__tests__/PresentationNavigationGuard.test.tsx`
- Modify: `src/renderer/src/components/Control/Layout.tsx`
- Modify: `src/renderer/src/components/Control/Sidebar.tsx`
- Modify: `src/renderer/src/components/Control/UserMenu/UserMenu.tsx`

- [ ] **Step 1: Write RED React Router blocker tests**

Use a memory data router. Prove leaving `/presentations/deck-1` calls `registry.flushAll()` before
`blocker.proceed()`, rejection keeps the route unchanged and opens the decision dialog, Retry
re-runs flush, and Discard calls `discardAll()` before proceeding.

```tsx
it('keeps the route when flush fails', async () => {
  registry.flushAll.mockRejectedValue(new Error('quota exceeded'))
  const router = createMemoryRouter(
    [{ path: '*', element: <PresentationNavigationGuard /> }],
    { initialEntries: ['/presentations/deck-1'] }
  )
  render(
    <PresentationSessionRegistryTestProvider value={registry}>
      <PresentationCloseDecisionTestProvider value={openCloseDecision}>
        <RouterProvider router={router} />
      </PresentationCloseDecisionTestProvider>
    </PresentationSessionRegistryTestProvider>
  )

  void router.navigate('/files')
  await waitFor(() => expect(openCloseDecision).toHaveBeenCalledTimes(1))

  expect(router.state.location.pathname).toBe('/presentations/deck-1')
})
```

The two test providers above are file-local harnesses that return the supplied mocked hook values;
they are not production exports.

- [ ] **Step 2: Write RED `beforeunload` tests**

When `registry.hasUnsafeWork()` is true, dispatch `BeforeUnloadEvent`, assert
`defaultPrevented === true`, and verify no test claims `flushAll()` was awaited. When false, the
event is untouched.

```ts
it('warns before browser unload without pretending to flush', () => {
  registry.hasUnsafeWork.mockReturnValue(true)
  const event = new Event('beforeunload', { cancelable: true })

  window.dispatchEvent(event)

  expect(event.defaultPrevented).toBe(true)
  expect(registry.flushAll).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Implement `PresentationNavigationGuard`**

Use React Router 7 `useBlocker` and `useBeforeUnload`. When the registry has unsafe work, block any
pathname change; a successful registry-driven tab activation has already flushed the old session
and therefore passes without a second prompt. Ensure only one decision promise is active so
repeated Back events do not open duplicate dialogs.

```ts
const blocker = useBlocker(
  ({ currentLocation, nextLocation }) =>
    registry.hasUnsafeWork() && currentLocation.pathname !== nextLocation.pathname
)
useBeforeUnload((event) => {
  if (!registry.hasUnsafeWork()) return
  event.preventDefault()
  event.returnValue = ''
})
```

Handle a blocked transition in one effect. Commit/flush first; Retry repeats the flush, Discard
awaits `discardAll()`, and Keep editing resets the blocker. Only call `proceed()` after the chosen
durable action succeeds.

```ts
useEffect(() => {
  if (blocker.state !== 'blocked') return
  void (async () => {
    try {
      await registry.flushAll()
      blocker.proceed()
    } catch {
      const decision = await openCloseDecision(registry.getUnsafeItemIds())
      if (decision === 'keep-editing') {
        blocker.reset()
      } else if (decision === 'retry') {
        await registry.flushAll()
        blocker.proceed()
      } else {
        await registry.discardAll()
        blocker.proceed()
      }
    }
  })().catch(() => blocker.reset())
}, [blocker, registry, openCloseDecision])
```

- [ ] **Step 4: Route explicit navigation through the same gate**

Header Home, Sidebar destinations, tab activation, and User Menu close request call registry
commands before `navigate()`/`window.close()`. The route blocker remains the final defense for
browser Back/Forward and unknown callers.

```ts
const leaveWorkspace = async (path: string): Promise<void> => {
  try {
    await registry.flushAll()
  } catch {
    const decision = await openCloseDecision(registry.getUnsafeItemIds())
    if (decision === 'keep-editing') return
    if (decision === 'retry') {
      await registry.flushAll()
    } else {
      await registry.discardAll()
    }
  }
  navigate(path)
}
```

- [ ] **Step 5: Run Task 7 tests and commit**

```bash
npx vitest run src/renderer/src/components/Control/__tests__/PresentationNavigationGuard.test.tsx src/renderer/src/components/Control/UserMenu/__tests__/UserMenu.test.tsx
git add src/renderer/src/components/Control/PresentationNavigationGuard.tsx src/renderer/src/components/Control/__tests__/PresentationNavigationGuard.test.tsx src/renderer/src/components/Control/Layout.tsx src/renderer/src/components/Control/Sidebar.tsx src/renderer/src/components/Control/UserMenu/UserMenu.tsx
git commit -m "feat: guard presentation navigation"
```

---

### Task 8: Add the Electron One-Shot Close Permit

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/main/ipc/app.ts`
- Modify: `src/main/windowManager.ts`
- Modify: `src/main/__tests__/windowManager.test.ts`
- Create: `src/renderer/src/contexts/PresentationElectronCloseBridge.tsx`
- Create: `src/renderer/src/contexts/__tests__/PresentationElectronCloseBridge.test.tsx`
- Modify: `src/renderer/src/components/Control/Layout.tsx`

**IPC contract:**

```ts
IpcInvokeMap['app:confirm-close'] = { args: []; result: { closing: boolean } }
IpcMainToRendererMap['app:close-requested'] = []

window.api.app.onCloseRequested(callback: () => void): () => void
window.api.app.confirmClose(): Promise<{ closing: boolean }>
```

- [ ] **Step 1: Write RED main-window close tests**

Create a BrowserWindow mock with captured `close` listener. First close must `preventDefault()` and
send `app:close-requested`. `confirmMainWindowClose()` sets one permit and calls close. The next
close consumes the permit without preventing. A third close is blocked again. Projection-window
close never sends the request.

```ts
it('consumes exactly one main-window close permit', () => {
  manager.createMainWindow()
  const first = emitMainClose()
  expect(first.preventDefault).toHaveBeenCalledTimes(1)
  expect(mainWebContents.send).toHaveBeenCalledWith('app:close-requested')

  expect(manager.confirmMainWindowClose()).toBe(true)
  const permitted = emitMainClose()
  expect(permitted.preventDefault).not.toHaveBeenCalled()
  const third = emitMainClose()
  expect(third.preventDefault).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Implement permit ownership in `WindowManager`**

Keep `mainClosePermit = false`. Attach the guarded close listener only to `mainWindow`. Expose
`confirmMainWindowClose(): boolean`; validate the IPC sender is the current main window before
granting.

```ts
private mainClosePermit = false

private handleMainWindowClose = (event: Electron.Event): void => {
  if (this.mainClosePermit) {
    this.mainClosePermit = false
    return
  }
  event.preventDefault()
  this.sendToMain('app:close-requested')
}

confirmMainWindowClose(): boolean {
  if (!this.mainWindow || this.mainWindow.isDestroyed()) return false
  this.mainClosePermit = true
  this.mainWindow.close()
  return true
}
```

- [ ] **Step 3: Add typed IPC and preload methods**

Register `app:confirm-close` with the existing app IPC handlers or a focused close handler. Extend
the shared maps and `AppAPI` declaration. Do not add a fire-and-forget untyped channel.

```ts
ipcMain.handle('app:confirm-close', (event) => {
  if (!isMainWindow(windowManager, event)) return { closing: false }
  return { closing: windowManager.confirmMainWindowClose() }
})
```

- [ ] **Step 4: Write RED renderer bridge tests**

When Electron close is requested, successful `flushAll()` calls `confirmClose()`. Failure keeps the
window open and shows the decision dialog. Discard awaits `discardAll()` then confirms. Browser
mode registers no preload listener.

```tsx
it('confirms Electron close only after every presentation flushes', async () => {
  render(<PresentationElectronCloseBridge />)
  closeRequestedListener()

  await waitFor(() => expect(registry.flushAll).toHaveBeenCalledTimes(1))
  expect(window.api.app.confirmClose).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 5: Implement and mount the Electron bridge**

Mount beside `PresentationNavigationGuard` inside the session provider. Catch all async listener
errors so no `unhandledRejection` reaches the main JavaScript error handler.

```ts
useEffect(() => {
  if (!isElectron()) return
  return window.api.app.onCloseRequested(() => {
    void (async () => {
      try {
        await registry.flushAll()
      } catch {
        const decision = await openCloseDecision(registry.getUnsafeItemIds())
        if (decision === 'keep-editing') return
        if (decision === 'retry') {
          await registry.flushAll()
        } else {
          await registry.discardAll()
        }
      }
      await window.api.app.confirmClose()
    })().catch(() => undefined)
  })
}, [registry, openCloseDecision])
```

- [ ] **Step 6: Run Task 8 tests and static checks**

```bash
npx vitest run src/main/__tests__/windowManager.test.ts src/renderer/src/contexts/__tests__/PresentationElectronCloseBridge.test.tsx
npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
git add src/shared/ipc-channels.ts src/preload/index.ts src/preload/index.d.ts src/main/ipc/app.ts src/main/windowManager.ts src/main/__tests__/windowManager.test.ts src/renderer/src/contexts/PresentationElectronCloseBridge.tsx src/renderer/src/contexts/__tests__/PresentationElectronCloseBridge.test.tsx src/renderer/src/components/Control/Layout.tsx
git commit -m "feat: guard Electron presentation close"
```

---

### Task 9: Flush the Exact Session Revision Before Projection

**Files:**
- Modify: `src/renderer/src/lib/media-projection-payload.ts`
- Modify: `src/renderer/src/lib/__tests__/media-projection-payload.test.ts`
- Modify: `src/renderer/src/components/Control/Header/PresentationWorkspaceHeader.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/Preview/PresentationPreview.tsx`
- Modify: `src/renderer/src/stores/media-projection.ts`
- Modify: `src/renderer/src/stores/__tests__/media-projection.test.ts`

**Interface:**

```ts
export function buildEditableSlideProjectionPayload(
  base: ProjectionPayload<'file:show'>,
  document: EditablePresentationDocument,
  activeSlideId: string
): ProjectionPayload<'file:show'>

export async function buildEditableProjectionPayloadForSession(
  base: ProjectionPayload<'file:show'>,
  session: PresentationEditorSession,
  activeSlideId: string
): Promise<ProjectionPayload<'file:show'>>
```

- [ ] **Step 1: Write RED pure payload tests**

Build a three-slide document, insert a slide before the active ID, and prove the payload still
chooses the same slide while its derived `slideIndex` changes. Missing active ID selects the first
slide deterministically.

```ts
it('keeps the active slide by ID after an earlier insertion', () => {
  const activeSlideId = document.slideOrder[1]
  const inserted = insertBlankEditableSlide(document, 0).document

  const payload = buildEditableSlideProjectionPayload(basePayload, inserted, activeSlideId)

  expect(payload.presentation?.slideIndex).toBe(2)
  expect(payload.editablePresentation?.slide.id).toBe(activeSlideId)
})
```

- [ ] **Step 2: Write RED projection-command tests**

Require editable Present to call `session.commitDraft()`, await `session.flush()`, use
`session.getSnapshot().history.present`, and only then call projection. A flush rejection must not
change `useMediaProjectionStore` or send a payload.

```ts
it('leaves projection unchanged when the active session cannot flush', async () => {
  session.flush.mockRejectedValue(new Error('quota exceeded'))

  await expect(
    buildEditableProjectionPayloadForSession(basePayload, session, activeSlideId)
  ).rejects.toThrow('quota exceeded')

  expect(session.commitDraft).toHaveBeenCalledTimes(1)
  expect(session.getSnapshot).not.toHaveBeenCalled()
})
```

Add a header/preview integration assertion that a rejected builder call does not invoke
`projectionAdapter.send()` and leaves `useMediaProjectionStore` at its initial state.

- [ ] **Step 3: Split pure document payload from durable fallback loading**

Open sessions use `buildEditableSlideProjectionPayload()` directly. File Explorer projection for a
closed editable document may use source-first `loadEditablePresentation()` as the durable fallback.
Never load the derived mirror ahead of an open session.

```ts
const openSession = registry.get(item.id)
if (openSession) {
  return buildEditableProjectionPayloadForSession(payload, openSession, activeSlideId)
}
return buildFileProjectionPayloadWithEditableSlide(input)
```

Implement the session helper in the same module so the order is explicit and independently
testable:

```ts
export async function buildEditableProjectionPayloadForSession(
  base: ProjectionPayload<'file:show'>,
  session: PresentationEditorSession,
  activeSlideId: string
): Promise<ProjectionPayload<'file:show'>> {
  session.commitDraft()
  await session.flush()
  return buildEditableSlideProjectionPayload(
    base,
    session.getSnapshot().history.present,
    activeSlideId
  )
}
```

- [ ] **Step 4: Convert media presentation state at the adapter boundary**

Workspace keeps active slide ID. The outgoing `presentation` payload and existing projection store
continue receiving the derived numeric index because the projection protocol remains unchanged in
R2.

```ts
const buildEditableSlide = (
  document: EditablePresentationDocument,
  slideIndex: number
): NonNullable<ProjectionPayload<'file:show'>['editablePresentation']> => {
  const slideId = document.slideOrder[slideIndex]
  const slide = document.slides[slideId]
  const assets: Record<string, EditablePresentationAsset> = {}
  for (const elementId of slide.elementOrder) {
    const element = slide.elements[elementId]
    if (element?.type !== 'image') continue
    const asset = document.assets[element.assetId]
    if (asset) assets[asset.id] = asset
  }
  return { width: document.width, height: document.height, slide, assets }
}

const slideIndex = Math.max(0, document.slideOrder.indexOf(activeSlideId))
return {
  ...base,
  presentation: { slideIndex, slideCount: document.slideOrder.length },
  editablePresentation: buildEditableSlide(document, slideIndex)
}
```

- [ ] **Step 5: Run Task 9 tests and commit**

```bash
npx vitest run src/renderer/src/lib/__tests__/media-projection-payload.test.ts src/renderer/src/stores/__tests__/media-projection.test.ts src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/PresentationPreview.test.tsx
git add src/renderer/src/lib/media-projection-payload.ts src/renderer/src/lib/__tests__/media-projection-payload.test.ts src/renderer/src/components/Control/Header/PresentationWorkspaceHeader.tsx src/renderer/src/components/Control/FileExplorer/Presenter/Preview/PresentationPreview.tsx src/renderer/src/stores/media-projection.ts src/renderer/src/stores/__tests__/media-projection.test.ts
git commit -m "fix: project flushed presentation revisions"
```

---

### Task 10: Remove Bypasses and Close R2

**Files:**
- Modify: `src/renderer/src/lib/editable-presentation.ts`
- Modify: `docs/roadmap/librepresenter-optimization-roadmap.md`

- [ ] **Step 1: Search for forbidden writers and obsolete state**

```bash
rg -n "saveEditablePresentation|hhc:presentation-undo|activeSlideByItemId|setActiveSlide\\(|getActiveSlide\\(" src/renderer/src
```

Expected after cleanup:

- no editor/header direct `saveEditablePresentation` call;
- no presentation Undo DOM events;
- no workspace active-slide index API;
- compatibility save wrapper used only by migration tests or removed completely.

- [ ] **Step 2: Run the complete R2 focused suite**

```bash
npx vitest run src/renderer/src/lib/__tests__/presentation-history.test.ts src/renderer/src/lib/__tests__/presentation-save-coordinator.test.ts src/renderer/src/lib/__tests__/editable-presentation-persistence.test.ts src/renderer/src/lib/__tests__/presentation-editor-session.test.ts src/renderer/src/contexts/__tests__/PresentationSessionRegistryContext.test.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx src/renderer/src/components/Common/__tests__/EditableSlideSurface.test.tsx src/renderer/src/components/Control/Header/__tests__/PresentationWorkspaceHeader.test.tsx src/renderer/src/components/Control/Header/__tests__/PresentationCloseDecisionDialog.test.tsx src/renderer/src/components/Control/__tests__/PresentationNavigationGuard.test.tsx src/renderer/src/contexts/__tests__/PresentationElectronCloseBridge.test.tsx src/main/__tests__/windowManager.test.ts src/renderer/src/lib/__tests__/media-projection-payload.test.ts
```

- [ ] **Step 3: Run broad regression gates**

```bash
npm run typecheck
npm run lint
npx vitest run
npm run build
npm run test:e2e:browser
```

Run the Windows packaged smoke when renderer, preload, and main close-handshake changes have passed
the deterministic suite:

```bash
npm run build:unpack
npm run test:e2e:packaged
```

- [ ] **Step 4: Audit every R2 acceptance criterion**

Record evidence for route-independent sessions, one-entry drafts, document-only Undo/Redo, stable
slide ID, one in-flight save, source-first reconciliation, rename routing, browser warning,
Electron permit, and flushed projection. Treat any untested criterion as incomplete.

- [ ] **Step 5: Update the roadmap with exact evidence**

Mark R2 Complete only after the focused, static, build, browser, and packaged gates pass. Record
full-suite failures separately with exact file/test names; do not convert a narrow focused pass into
a broad completion claim.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/editable-presentation.ts docs/roadmap/librepresenter-optimization-roadmap.md
git commit -m "docs: complete R2 presentation trust foundation"
```
