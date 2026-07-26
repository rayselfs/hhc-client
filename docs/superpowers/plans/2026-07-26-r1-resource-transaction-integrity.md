# R1 Resource Transaction Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this
> plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make permanent media cleanup, editable-presentation creation, and Blob reference repair
recoverable across IndexedDB, Electron native storage, derived assets, and thumbnails.

**Architecture:** The File Explorer database remains authoritative for file items and source Blob
references. A small cleanup journal is written in the same transaction that removes the final Blob
reference, then drives idempotent cleanup in the other storage domains. Editable-presentation
creation uses a narrow coordinator that publishes Zustand state only after every durable write
succeeds and compensates completed writes in reverse order on failure. Integrity scans derive
reference counts from authoritative file items and sync entries instead of trusting stored
`refCount`.

**Tech Stack:** TypeScript, React 19, Zustand 5, IndexedDB through `idb`, Electron preload API,
Vitest

## Global Constraints

- Preserve File Explorer soft-delete/trash semantics and active projection resource locks.
- Preserve dual-mode operation: browser cleanup skips native files; Electron cleanup includes them.
- Missing external resources count as successful idempotent cleanup.
- Never swallow a failed cleanup or compensation; retain it in the cleanup journal.
- Do not add a generic transaction/event-sourcing framework or a new dependency.
- The source Blob remains the canonical editable-presentation document; the derived document is a
  same-body read-optimized mirror.
- Do not publish a new presentation item to Zustand until all durable resources exist.

---

### Task 1: Add the Persistent Resource Cleanup Journal

**Files:**
- Modify: `src/renderer/src/lib/file-explorer-db.ts`
- Create: `src/renderer/src/lib/resource-cleanup-journal.ts`
- Create: `src/renderer/src/lib/__tests__/resource-cleanup-journal.test.ts`
- Modify: `src/renderer/src/lib/__tests__/file-explorer-db.test.ts`

**Interfaces:**

```ts
export interface ResourceCleanupJournalRecord {
  id: string
  blobId: string
  storage?: 'indexed-db' | 'native-fs'
  deleteNativeFile: boolean
  deleteDerivedAssets: boolean
  deletePdfPageThumbs: boolean
  itemThumbnailIds: string[]
  status: 'pending' | 'failed'
  attempt: number
  lastError?: string
  createdAt: number
  updatedAt: number
}

export async function listResourceCleanupRecords(): Promise<ResourceCleanupJournalRecord[]>
export async function retryResourceCleanup(id: string): Promise<void>
export async function retryPendingResourceCleanups(): Promise<void>
```

- [ ] **Step 1: Write RED schema and journal processing tests**

Add tests that require database version 5 to create `resource-cleanup-journal`, list its records,
delete native/derived/PDF/item-thumbnail resources, remove a successful record, and retain a failed
record with incremented `attempt`, `status: 'failed'`, and a sanitized `lastError`.

```ts
it('retains a failed cleanup so the exact work can be retried', async () => {
  mockDeleteDerivedAssets.mockRejectedValueOnce(new Error('quota exceeded'))
  await putResourceCleanupRecord(makeCleanupRecord({ id: 'cleanup-1' }))

  await expect(retryResourceCleanup('cleanup-1')).rejects.toThrow('quota exceeded')

  await expect(getResourceCleanupRecord('cleanup-1')).resolves.toMatchObject({
    status: 'failed',
    attempt: 1,
    lastError: 'quota exceeded'
  })
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npx vitest run src/renderer/src/lib/__tests__/file-explorer-db.test.ts src/renderer/src/lib/__tests__/resource-cleanup-journal.test.ts
```

Expected: the cleanup store and processor exports do not exist.

- [ ] **Step 3: Add the database schema and narrow CRUD/processor**

Bump `DB_VERSION` from 4 to 5 and create the key-path store during upgrade. Implement journal
processing in the order native file, derived assets, PDF page thumbnails, and item thumbnails.
Repeat the whole sequence after partial failure; all deletes are idempotent. In browser mode, mark
native deletion as satisfied without invoking preload.

Use a transaction-local helper for callers that must atomically add a journal record with catalog
changes:

```ts
export function createResourceCleanupRecord(
  input: Omit<ResourceCleanupJournalRecord, 'id' | 'status' | 'attempt' | 'createdAt' | 'updatedAt'>
): ResourceCleanupJournalRecord
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/file-explorer-db.ts src/renderer/src/lib/resource-cleanup-journal.ts src/renderer/src/lib/__tests__/file-explorer-db.test.ts src/renderer/src/lib/__tests__/resource-cleanup-journal.test.ts
git commit -m "feat: add persistent media cleanup journal"
```

---

### Task 2: Journal Permanent File Resource Cleanup Atomically

**Files:**
- Modify: `src/renderer/src/lib/file-resource-cleanup.ts`
- Modify: `src/renderer/src/lib/__tests__/file-resource-cleanup.test.ts`

**Behavior:**

- Final unlocked Blob deletion removes the catalog Blob and creates one cleanup record in the same
  File Explorer transaction.
- Item thumbnail identifiers are attached to the relevant source-Blob record.
- A locked Blob remains at `refCount: 0`; release finalization transactionally deletes it and adds
  the journal record.
- After the transaction commits, the journal processor performs external cleanup.
- A failed processor rejects the caller while preserving the already-committed cleanup record.

- [ ] **Step 1: Write RED cleanup tests**

Cover:

1. native deletion failure is no longer swallowed;
2. the item and Blob are removed but a failed journal entry remains;
3. retry removes the failed journal entry;
4. deferred locked cleanup creates the journal only when the lock is released;
5. shared Blob deletion journals external cleanup only for the final reference;
6. item-only thumbnail cleanup is represented even while a shared Blob remains.

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/file-resource-cleanup.test.ts
```

- [ ] **Step 3: Replace direct external cleanup with journal creation and processing**

Include `resource-cleanup-journal` in the read-write transaction. Group item thumbnail IDs by source
Blob. When references remain, create a thumbnail-only record so removing one copy never deletes the
shared source assets. When the final reference is removed, create one record that includes the
source resources and all affected item thumbnails.

Do not catch-and-ignore `nativeFs.delete`. Let `retryResourceCleanup()` persist the failure and
reject.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: all file cleanup tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/file-resource-cleanup.ts src/renderer/src/lib/__tests__/file-resource-cleanup.test.ts
git commit -m "fix: retain failed media resource cleanup"
```

---

### Task 3: Replay and Surface Cleanup Failures

**Files:**
- Modify: `src/renderer/src/lib/app-init.ts`
- Modify: `src/renderer/src/lib/recovery-center.ts`
- Modify: `src/renderer/src/types/recovery-center.ts`
- Modify: `src/renderer/src/lib/media-storage-diagnostics.ts`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`
- Modify: `src/renderer/src/lib/__tests__/app-init.test.ts`
- Modify: `src/renderer/src/lib/__tests__/recovery-center.test.ts`
- Modify: `src/renderer/src/lib/__tests__/media-storage-diagnostics.test.ts`

**Interfaces:**

```ts
type RecoveryIssueKind =
  | 'job-failed'
  | 'media-missing'
  | 'asset-failed'
  | 'sync-auth'
  | 'sync-download'
  | 'storage-integrity'
  | 'projection-health'
  | 'resource-cleanup-failed'

type RecoveryActionType =
  | 'retry-job'
  | 'cancel-job'
  | 'retry-sync-download'
  | 'run-integrity-repair'
  | 'reopen-projection'
  | 'export-diagnostics'
  | 'retry-resource-cleanup'
```

- [ ] **Step 1: Write RED startup, Recovery Center, and diagnostics tests**

Require initialization to make one bounded retry pass after File Explorer initialization. A
remaining pending/failed journal record must appear as a storage Recovery Center issue with a retry
action. Diagnostics expose only aggregate status/count/attempt data, never native paths or raw
errors.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/app-init.test.ts src/renderer/src/lib/__tests__/recovery-center.test.ts src/renderer/src/lib/__tests__/media-storage-diagnostics.test.ts
```

- [ ] **Step 3: Add startup replay, recovery action, and localized copy**

Call `retryPendingResourceCleanups()` once after File Explorer has completed initialization. Use
`Promise.allSettled` inside the bounded replay so one failed record does not block others and the
failure remains visible. Recovery action retries the selected record ID. Add localized labels and
details for all three supported locales.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the Step 2 command. Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/lib/app-init.ts src/renderer/src/lib/recovery-center.ts src/renderer/src/types/recovery-center.ts src/renderer/src/lib/media-storage-diagnostics.ts src/renderer/src/locales/en.json src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json src/renderer/src/lib/__tests__/app-init.test.ts src/renderer/src/lib/__tests__/recovery-center.test.ts src/renderer/src/lib/__tests__/media-storage-diagnostics.test.ts
git commit -m "feat: surface retryable media cleanup failures"
```

---

### Task 4: Make Editable Presentation Creation Compensatable

**Files:**
- Modify: `src/renderer/src/lib/editable-presentation.ts`
- Modify: `src/renderer/src/lib/media-work-db.ts`
- Modify: `src/renderer/src/lib/__tests__/editable-presentation.test.ts`

**Creation order:**

1. Build one JSON body and source Blob.
2. In one File Explorer transaction, put `file-blobs` and `folder-items`.
3. Put the derived editable-document mirror with the same body.
4. Save the generated thumbnail.
5. Publish the already-durable item into Zustand without scheduling another database write.

**Compensation order:** thumbnail, derived document, File Explorer item and Blob. A failed external
compensation creates a cleanup-journal record before rethrowing the original creation failure.

- [ ] **Step 1: Add a store hydration helper without an extra persistence write**

Add the smallest store API needed to publish an already-persisted item:

```ts
export function publishPersistedFileItem(item: FileItemRecord): void
```

It updates the same Zustand indexes as `addItem`, but performs no queued database operation.
Unit-test that it publishes the exact durable record and does not enqueue a second write.

- [ ] **Step 2: Write RED failure-stage creation tests**

Inject failures at:

1. File Explorer transaction;
2. derived-document write;
3. thumbnail write;
4. Zustand publication.

After each failure assert that no `folder-items`, `file-blobs`, derived document, thumbnail, or
in-memory item remains. Also assert the source Blob and derived mirror contain identical document
JSON on success.

- [ ] **Step 3: Run the focused tests and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/editable-presentation.test.ts src/renderer/src/__tests__/file-explorer/file-explorer-store.test.ts
```

- [ ] **Step 4: Implement the creation coordinator and narrow derived delete**

Export/reuse `deleteDerivedAsset(sourceBlobId, EDITABLE_PRESENTATION_DOCUMENT_KIND, variant)` for
compensation. Construct the final `FileItemRecord` before the database transaction, including
`sortIndex`, `createdAt`, and `expiresAt`. Both blank creation and PPTX conversion continue through
`createEditablePresentationItem`, so they receive identical guarantees.

Do not change regular edit autosave behavior in this task; only initial creation is coordinated.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Step 3 command. Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/editable-presentation.ts src/renderer/src/lib/media-work-db.ts src/renderer/src/stores/file-explorer.ts src/renderer/src/lib/__tests__/editable-presentation.test.ts src/renderer/src/stores/__tests__
git commit -m "fix: compensate incomplete presentation creation"
```

---

### Task 5: Audit and Repair Authoritative Blob Reference Counts

**Files:**
- Modify: `src/renderer/src/lib/media-storage-integrity.ts`
- Modify: `src/renderer/src/lib/recovery-center.ts`
- Modify: `src/renderer/src/lib/__tests__/media-storage-integrity.test.ts`
- Modify: `src/renderer/src/lib/__tests__/recovery-center.test.ts`

**Interfaces:**

```ts
type MediaStorageIntegrityIssueKind =
  | 'file-item-missing-blob'
  | 'file-blob-unreferenced'
  | 'derived-asset-missing-source'
  | 'sync-entry-missing-blob'
  | 'file-blob-ref-count-mismatch'

export interface MediaStorageIntegrityRepairResult {
  correctedRefCounts: string[]
  cleanupJournalIds: string[]
}

export async function repairMediaStorageIntegrity(): Promise<MediaStorageIntegrityRepairResult>
```

- [ ] **Step 1: Write RED authoritative-reference tests**

Require exactly one reference for every File Explorer file item and one for every sync entry that
owns a cached `blobId`, including multiple entries pointing to the same Blob. Cover:

- stored `refCount: 9`, expected 1;
- stored `refCount: 1`, expected 2;
- stored positive `refCount`, expected 0;
- missing Blob referenced by both a file item and sync entry;
- derived asset whose source is missing.

- [ ] **Step 2: Write RED repair tests**

Repair must update nonzero expected counts in one File Explorer transaction. An expected count of
zero must delete the Blob and create a cleanup journal entry in the same transaction; external
cleanup then runs through the standard journal processor. Re-scanning after a successful repair
must not report ref-count mismatch or unreferenced Blob issues.

- [ ] **Step 3: Run the focused tests and verify RED**

```bash
npx vitest run src/renderer/src/lib/__tests__/media-storage-integrity.test.ts src/renderer/src/lib/__tests__/recovery-center.test.ts
```

- [ ] **Step 4: Implement count derivation and repair**

Replace the reference `Set` with `Map<string, number>`. Do not mutate missing referenced resources.
`run-integrity-repair` invokes `repairMediaStorageIntegrity()`, not a scan-only no-op.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the Step 3 command. Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/lib/media-storage-integrity.ts src/renderer/src/lib/recovery-center.ts src/renderer/src/lib/__tests__/media-storage-integrity.test.ts src/renderer/src/lib/__tests__/recovery-center.test.ts
git commit -m "fix: repair authoritative media references"
```

---

### Task 6: Verify and Close R1

**Files:**
- Modify: `docs/roadmaps/2026-07-26-media-presentation-roadmap.md`

- [ ] **Step 1: Run the complete R1 focused suite**

```bash
npx vitest run src/renderer/src/lib/__tests__/file-explorer-db.test.ts src/renderer/src/lib/__tests__/resource-cleanup-journal.test.ts src/renderer/src/lib/__tests__/file-resource-cleanup.test.ts src/renderer/src/lib/__tests__/app-init.test.ts src/renderer/src/lib/__tests__/recovery-center.test.ts src/renderer/src/lib/__tests__/media-storage-diagnostics.test.ts src/renderer/src/lib/__tests__/editable-presentation.test.ts src/renderer/src/lib/__tests__/media-storage-integrity.test.ts
```

- [ ] **Step 2: Run static gates**

```bash
npm run typecheck
npx eslint src/renderer/src/lib/file-explorer-db.ts src/renderer/src/lib/resource-cleanup-journal.ts src/renderer/src/lib/file-resource-cleanup.ts src/renderer/src/lib/app-init.ts src/renderer/src/lib/recovery-center.ts src/renderer/src/lib/media-storage-diagnostics.ts src/renderer/src/lib/editable-presentation.ts src/renderer/src/lib/media-storage-integrity.ts src/renderer/src/stores/file-explorer.ts
npm run build
```

- [ ] **Step 3: Audit the written design against implementation**

Confirm:

- database deletion and journal creation share one transaction;
- cleanup errors remain retryable and visible after restart;
- projection locks still defer final source deletion;
- presentation failure leaves no untracked partial resource;
- ref counts derive from file items and sync entries;
- browser code never requires Electron native APIs.

- [ ] **Step 4: Update the roadmap with exact evidence**

Mark R1 complete only after the focused suite, typecheck, touched-file lint, and build pass. Record
test counts and any unrelated pre-existing full-suite failures separately.

- [ ] **Step 5: Commit**

```bash
git add -f docs/roadmaps/2026-07-26-media-presentation-roadmap.md
git commit -m "docs: complete R1 resource integrity"
```
