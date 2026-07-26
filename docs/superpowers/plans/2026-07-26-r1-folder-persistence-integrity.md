# R1 Folder Persistence Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shared File Explorer and Bible folder persistence report load/write failures
truthfully without fabricating an empty library or reporting optimistic state as durable.

**Architecture:** IndexedDB operations propagate their original errors. A narrow per-store
serialized persistence queue keeps existing synchronous UI mutations responsive while exposing
pending, failed, and retry states through serializable Zustand fields. Failed operations stay at
the head of the queue until retry succeeds; later writes cannot overtake them.

**Tech Stack:** TypeScript, Zustand 5, IndexedDB through `idb`, Vitest, React 19

## Global Constraints

- Preserve File Explorer soft-delete/trash behavior and Bible hard-delete behavior.
- Do not use `localStorage`; persistence remains in IndexedDB and existing Zustand adapters.
- Do not introduce a generic command framework or new dependency.
- A failed database read must not create a replacement root library.
- A failed write must remain visibly pending/failed and retryable.
- All changes must work in Electron and browser renderer modes.

---

### Task 1: Propagate Folder Database Failures

**Files:**
- Modify: `src/renderer/src/lib/folder-db.ts`
- Test: `src/renderer/src/lib/__tests__/folder-db.test.ts`

**Interfaces:**
- Consumes: `createFolderDB(getDB, rootId)`
- Produces: Existing `FolderDB` methods with unchanged signatures and rejecting failure semantics

- [ ] **Step 1: Write failing read and write propagation tests**

Add cases that create a database mock whose `getAll` and `put` reject:

```ts
it('propagates folder load failures instead of returning an empty library', async () => {
  const failure = new Error('indexeddb unavailable')
  const ops = createFolderDB(
    async () => ({ getAll: vi.fn().mockRejectedValue(failure) }),
    'root'
  )

  await expect(ops.loadAllFolders()).rejects.toBe(failure)
})

it('propagates item write failures instead of reporting success', async () => {
  const failure = new Error('quota exceeded')
  const ops = createFolderDB(
    async () => ({ put: vi.fn().mockRejectedValue(failure) }),
    'root'
  )

  await expect(ops.saveItem(makeItem())).rejects.toBe(failure)
})
```

Add equivalent coverage for bulk/delete and trash helpers so no public operation still converts a
failure to `[]`, `{ folderIds: [], itemIds: [] }`, or fulfilled `void`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/folder-db.test.ts
```

Expected: failures show current empty/success fallbacks.

- [ ] **Step 3: Remove catch-and-success behavior**

Keep contextual logging only when rethrowing the original value:

```ts
async function loadAllFolders(): Promise<FolderRecord[]> {
  try {
    const db = await getDB()
    return await db.getAll('folder-records')
  } catch (error) {
    console.error('[folder-db] Failed to load folders:', error)
    throw error
  }
}
```

Apply the same behavior to every public operation. Preserve the inner `by-deleted-at` missing-index
fallback because it is a compatibility branch; if both the index and full scan fail, propagate the
full-scan error.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/folder-db.test.ts
```

Expected: all folder database tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/folder-db.ts src/renderer/src/lib/__tests__/folder-db.test.ts
git commit -m "fix: propagate folder persistence failures"
```

---

### Task 2: Add a Serialized Retryable Persistence Queue

**Files:**
- Create: `src/renderer/src/lib/persistence-operation-queue.ts`
- Create: `src/renderer/src/lib/__tests__/persistence-operation-queue.test.ts`

**Interfaces:**
- Produces:

```ts
export type PersistenceQueueSnapshot = {
  pendingCount: number
  status: 'idle' | 'saving' | 'failed'
  error: string | null
}

export type PersistenceOperationQueue = {
  enqueue: (operation: () => Promise<void>) => void
  retry: () => Promise<void>
  snapshot: () => PersistenceQueueSnapshot
  subscribe: (listener: (snapshot: PersistenceQueueSnapshot) => void) => () => void
}

export function createPersistenceOperationQueue(): PersistenceOperationQueue
```

- [ ] **Step 1: Write failing queue behavior tests**

Cover serialization, failure retention, retry, and ordering:

```ts
it('retains a failed operation and blocks later writes until retry succeeds', async () => {
  let shouldFail = true
  const calls: string[] = []
  const queue = createPersistenceOperationQueue()

  queue.enqueue(async () => {
    calls.push('first')
    if (shouldFail) throw new Error('quota exceeded')
  })
  queue.enqueue(async () => {
    calls.push('second')
  })

  await vi.waitFor(() => expect(queue.snapshot().status).toBe('failed'))
  expect(calls).toEqual(['first'])
  expect(queue.snapshot()).toMatchObject({ pendingCount: 2, error: 'quota exceeded' })

  shouldFail = false
  await queue.retry()

  expect(calls).toEqual(['first', 'first', 'second'])
  expect(queue.snapshot()).toEqual({ pendingCount: 0, status: 'idle', error: null })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/persistence-operation-queue.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement the minimal queue**

Use one in-memory FIFO of operation closures, a single drain promise, and snapshot subscribers.
`enqueue()` starts draining only when not already saving or failed. Remove an operation only after
it fulfills. `retry()` clears the failure state and awaits the next drain. Convert unknown errors
with `error instanceof Error ? error.message : String(error)`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/persistence-operation-queue.test.ts
```

Expected: all queue tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/persistence-operation-queue.ts \
  src/renderer/src/lib/__tests__/persistence-operation-queue.test.ts
git commit -m "feat: add retryable persistence queue"
```

---

### Task 3: Make Folder Initialization Truthful and Retryable

**Files:**
- Modify: `src/renderer/src/stores/folder.ts`
- Test: `src/renderer/src/stores/__tests__/folder.test.ts`
- Test: `src/renderer/src/__tests__/file-explorer/file-explorer-store.test.ts`

**Interfaces:**
- Adds to `FolderStoreState`:

```ts
persistenceStatus: 'initializing' | 'ready' | 'saving' | 'degraded'
persistenceError: string | null
pendingPersistenceCount: number
retryPersistence: () => Promise<void>
retryInitialization: () => Promise<void>
```

- [ ] **Step 1: Write a failing initialization test**

Configure `loadAllFolders` to reject and assert:

```ts
await useBibleFolderStore.getState().initialize()

expect(useBibleFolderStore.getState()).toMatchObject({
  isInitialized: false,
  isLoading: false,
  persistenceStatus: 'degraded',
  persistenceError: 'indexeddb unavailable'
})
expect(mockSaveFolder).not.toHaveBeenCalled()
expect(useBibleFolderStore.getState().folders).toEqual({})
```

Then make the mock succeed, call `retryInitialization()`, and assert the root is created exactly
once and status becomes `ready`.

- [ ] **Step 2: Run store tests and verify RED**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/folder.test.ts \
  src/renderer/src/__tests__/file-explorer/file-explorer-store.test.ts
```

Expected: new persistence fields/actions are missing and current initialization swallows failure.

- [ ] **Step 3: Implement explicit initialization state**

Initialize with:

```ts
persistenceStatus: 'initializing',
persistenceError: null,
pendingPersistenceCount: 0
```

Extract the current initialization body into an internal `initializeStore()` function used by
`initialize()` and `retryInitialization()`. On read failure, keep existing in-memory data
unchanged, do not create root state, and set degraded status. On successful root/item load, set
`ready`.

- [ ] **Step 4: Run store tests and verify GREEN**

Run the same focused Vitest command. Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/stores/folder.ts \
  src/renderer/src/stores/__tests__/folder.test.ts \
  src/renderer/src/__tests__/file-explorer/file-explorer-store.test.ts
git commit -m "feat: expose folder initialization failures"
```

---

### Task 4: Route Folder Writes Through the Queue

**Files:**
- Modify: `src/renderer/src/stores/folder.ts`
- Test: `src/renderer/src/stores/__tests__/folder.test.ts`

**Interfaces:**
- Consumes: `createPersistenceOperationQueue()`
- Preserves existing synchronous mutation action signatures
- Produces truthful `persistenceStatus`, `persistenceError`, and `pendingPersistenceCount`

- [ ] **Step 1: Write a failing optimistic-write failure test**

```ts
it('marks a failed rename dirty and retries it before later writes', async () => {
  mockSaveFolder.mockRejectedValueOnce(new Error('quota exceeded'))
  const folderId = useBibleFolderStore.getState().addFolder('Before')
  useBibleFolderStore.getState().updateFolder(folderId, { name: 'After' })

  await vi.waitFor(() =>
    expect(useBibleFolderStore.getState().persistenceStatus).toBe('degraded')
  )
  expect(useBibleFolderStore.getState()).toMatchObject({
    persistenceError: 'quota exceeded',
    pendingPersistenceCount: 2
  })

  mockSaveFolder.mockResolvedValue(undefined)
  await useBibleFolderStore.getState().retryPersistence()

  expect(useBibleFolderStore.getState()).toMatchObject({
    persistenceStatus: 'ready',
    persistenceError: null,
    pendingPersistenceCount: 0
  })
  expect(mockSaveFolder).toHaveBeenLastCalledWith(
    expect.objectContaining({ id: folderId, name: 'After' })
  )
})
```

Use an initialized persisted folder for a second case proving a failed delete remains dirty instead
of being reported as durable.

- [ ] **Step 2: Run the focused store test and verify RED**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/folder.test.ts
```

Expected: writes are fire-and-forget and no dirty/error state exists.

- [ ] **Step 3: Integrate one queue per store**

Create the queue inside `createFolderStore`. Subscribe once and translate snapshots:

```ts
const persistenceStatus =
  snapshot.status === 'failed'
    ? 'degraded'
    : snapshot.status === 'saving'
      ? 'saving'
      : 'ready'

set({
  persistenceStatus,
  persistenceError: snapshot.error,
  pendingPersistenceCount: snapshot.pendingCount
})
```

Replace every unawaited `ops.save*` and `ops.delete*` call with `queue.enqueue(() => ops.method(...))`.
For multi-call logical mutations, enqueue one closure that awaits all required database calls in
their original order. `retryPersistence()` delegates to `queue.retry()`.

- [ ] **Step 4: Cover every mutation family**

Add parameterized tests for add/update/remove/move/reorder/favorite/soft-delete/restore. Each test
makes the relevant database operation reject, waits for degraded status, then verifies retry calls
the same durable operation and clears pending state.

- [ ] **Step 5: Run store tests and verify GREEN**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/folder.test.ts \
  src/renderer/src/__tests__/file-explorer/file-explorer-store.test.ts
```

Expected: all shared-store and File Explorer tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/stores/folder.ts \
  src/renderer/src/stores/__tests__/folder.test.ts \
  src/renderer/src/__tests__/file-explorer/file-explorer-store.test.ts
git commit -m "feat: retain retryable folder writes"
```

---

### Task 5: Keep Lazy Parent Loads Retryable

**Files:**
- Modify: `src/renderer/src/stores/folder.ts`
- Test: `src/renderer/src/stores/__tests__/folder.test.ts`

**Interfaces:**
- Preserves: `ensureItemsLoaded(parentId): Promise<void>`
- Guarantees: failed parents are not added to `loadedParents`

- [ ] **Step 1: Write the failing test**

```ts
it('does not mark a parent loaded when IndexedDB loading fails', async () => {
  mockLoadItemsByParent.mockRejectedValueOnce(new Error('read failed'))

  await expect(
    useBibleFolderStore.getState().ensureItemsLoaded('child')
  ).rejects.toThrow('read failed')

  expect(useBibleFolderStore.getState().loadedParents.has('child')).toBe(false)
  expect(useBibleFolderStore.getState().persistenceStatus).toBe('degraded')
})
```

Retry with a successful mock and assert the parent is then loaded.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npx vitest run src/renderer/src/stores/__tests__/folder.test.ts
```

Expected: error state is not updated.

- [ ] **Step 3: Implement load error state without poisoning the cache**

Add a rejection branch that records the error, leaves `loadedParents` unchanged, rethrows, and
always clears `itemsLoadPromises` in `finally`. A later call must start a fresh read.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same command. Expected: all folder store tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/stores/folder.ts src/renderer/src/stores/__tests__/folder.test.ts
git commit -m "fix: keep failed folder loads retryable"
```

---

### Task 6: Add Operator-visible Degraded Storage State

**Files:**
- Create: `src/renderer/src/components/Common/FolderPersistenceStatus.tsx`
- Modify: `src/renderer/src/pages/FilesPage.tsx`
- Modify: `src/renderer/src/components/Control/Bible/CustomFolderTab.tsx`
- Test: `src/renderer/src/pages/__tests__/FilesPage.persistence.test.tsx`
- Test: `src/renderer/src/components/Control/Bible/__tests__/CustomFolderTab.test.tsx`

**Interfaces:**
- Consumes: folder store persistence fields and retry actions
- Produces: compact storage status banner with Retry action

- [ ] **Step 1: Write a failing File Explorer UI test**

Render Files with store state:

```ts
useFileExplorerStore.setState({
  persistenceStatus: 'degraded',
  persistenceError: 'quota exceeded',
  pendingPersistenceCount: 1
})
```

Assert an alert identifies unsaved local changes and Retry calls `retryPersistence()`. Add a loading
case proving an initialization failure is not rendered as an empty library.

- [ ] **Step 2: Run the focused UI test and verify RED**

Run:

```bash
npx vitest run src/renderer/src/pages/__tests__/FilesPage.persistence.test.tsx
```

Expected: alert and Retry action are absent.

- [ ] **Step 3: Implement the compact status banner**

Use existing HeroUI/Button patterns. The message must distinguish:

- load failure: library unavailable, Retry reload;
- write failure: changes not saved, Retry save;
- saving: local changes saving.

Do not block navigation or replace content with an empty state after load failure.

- [ ] **Step 4: Run focused UI and store tests**

Run:

```bash
npx vitest run src/renderer/src/pages/__tests__/FilesPage.persistence.test.tsx \
  src/renderer/src/stores/__tests__/folder.test.ts \
  src/renderer/src/__tests__/file-explorer/file-explorer-store.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/pages/FilesPage.tsx \
  src/renderer/src/pages/__tests__/FilesPage.persistence.test.tsx \
  src/renderer/src/components/Common/FolderPersistenceStatus.tsx \
  src/renderer/src/components/Control/Bible/CustomFolderTab.tsx \
  src/renderer/src/components/Control/Bible/__tests__/CustomFolderTab.test.tsx
git commit -m "feat: surface degraded folder persistence"
```

---

### Task 7: Verify the R1 Folder Persistence Slice

**Files:**
- Modify: `docs/roadmap/librepresenter-optimization-roadmap.md`

**Interfaces:**
- Produces: evidence for the first R1 subproject; does not mark all R1 complete

- [ ] **Step 1: Run focused tests**

```bash
npx vitest run src/renderer/src/lib/__tests__/folder-db.test.ts \
  src/renderer/src/lib/__tests__/persistence-operation-queue.test.ts \
  src/renderer/src/stores/__tests__/folder.test.ts \
  src/renderer/src/__tests__/file-explorer/file-explorer-store.test.ts \
  src/renderer/src/pages/__tests__/FilesPage.persistence.test.tsx
```

- [ ] **Step 2: Run typecheck and lint on touched files**

```bash
npm run typecheck
npx eslint src/renderer/src/lib/folder-db.ts \
  src/renderer/src/lib/persistence-operation-queue.ts \
  src/renderer/src/stores/folder.ts \
  src/renderer/src/pages/FilesPage.tsx
```

- [ ] **Step 3: Record evidence without marking R1 complete**

Add a dated R1 progress checklist covering truthful folder DB reads/writes, retryable store writes,
lazy-load retries, and visible degraded status. Leave cleanup journal, presentation compensation,
and reference audit unchecked.

- [ ] **Step 4: Commit**

```bash
git add docs/roadmap/librepresenter-optimization-roadmap.md
git commit -m "docs: record R1 folder persistence progress"
```
