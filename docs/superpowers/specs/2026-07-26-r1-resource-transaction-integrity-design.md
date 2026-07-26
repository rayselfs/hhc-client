# R1 Resource Transaction Integrity Design

## Status

Approved as the detailed design for the remaining R1 persistence-integrity work.

## Goal

Make cross-database Media and editable-presentation operations recoverable after partial failure or
application restart. A catalog item must never claim durable resources that do not exist, and
failed external cleanup must remain visible and retryable.

## Scope

This design covers:

- persistent cleanup work for native files, derived assets, and thumbnails;
- compensatable editable-presentation creation;
- reference-derived blob integrity reporting and repair.

It does not introduce a generic event framework, background service, or new dependency. Bible
folder deletion remains separate and does not use File Explorer trash or cleanup records.

## Chosen approach

Use a narrow cleanup journal in the existing File Explorer IndexedDB, plus explicit compensation
for editable-presentation creation.

The cleanup journal is preferable to reusing Media jobs because cleanup is a consistency boundary,
not an import/render task. A best-effort startup sweep is insufficient because it cannot explain
what failed or preserve the exact intended cleanup work.

## Cleanup journal

### Record

`resource-cleanup-journal` is added to the File Explorer database:

```ts
interface ResourceCleanupJournalRecord {
  id: string
  blobId: string
  storage: 'indexed-db' | 'native-fs' | undefined
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
```

One record represents cleanup for one source blob. `itemThumbnailIds` contains catalog-item
thumbnail keys that shared the source.

### Transaction boundary

When permanent deletion reduces a blob to zero references:

1. In one File Explorer IndexedDB transaction:
   - update or delete the blob record;
   - delete target folder/item catalog records;
   - write the cleanup journal record.
2. Commit that transaction.
3. Process journal records idempotently.
4. Remove a record only after every requested external cleanup succeeds.

If the resource is locked for active projection, retain the existing `refCount: 0` deferred
behavior. The journal is created when the lock releases and final catalog cleanup is committed.

Missing native files and already-deleted derived/thumbnail records count as successful idempotent
cleanup. Other errors update the journal to `failed`, increment `attempt`, preserve `lastError`,
and reject the caller.

### Recovery

Startup processing retries pending records once. Recovery Center also lists pending/failed cleanup
records and exposes a retry action. Repeated failure remains visible; it is never converted into
success.

## Editable-presentation creation

Creation uses a dedicated coordinator and does not publish optimistic Zustand state until durable
creation succeeds.

### Forward steps

1. Build the document and canonical blob in memory.
2. Atomically create `file-blobs` and `folder-items` records in File Explorer IndexedDB.
3. Write the editable document derived asset.
4. Write its thumbnail.
5. Publish the already-durable item into the File Explorer store.

The canonical document body is the blob record. The derived document remains a read-optimized
mirror and must contain the same serialized body.

### Compensation

If a step after the File Explorer transaction fails:

1. delete thumbnail if created;
2. delete derived editable-document asset if created;
3. delete the catalog item and blob in one File Explorer transaction;
4. remove any in-memory item if it was published.

If compensation of an external resource fails, create a cleanup journal record before returning
the original creation error. Conversion from PPTX follows the same coordinator after parsing.

## Reference-derived integrity

Integrity scanning computes expected references rather than trusting stored `refCount`:

- one reference for every File Explorer file item using the blob;
- one reference for every sync entry that owns a cached blob.

It reports:

- catalog item references missing blob;
- sync entry references missing blob;
- derived asset references missing source;
- blob has zero authoritative references;
- stored blob `refCount` differs from the computed count.

Repair corrects non-zero mismatched counts transactionally. Zero-reference blobs are routed through
the cleanup journal so their external resources are handled with the same retryable semantics.
Repair never fabricates a missing blob for a catalog or sync record.

## UI and diagnostics

Recovery Center maps cleanup failures to a storage-integrity issue that includes the blob ID,
latest error, attempt count, and retry action. Diagnostics export includes cleanup journal records
and expected-versus-stored reference counts without absolute native paths.

## Dual-mode behavior

- Browser mode journals and cleans IndexedDB/derived/thumbnail resources.
- Electron mode additionally deletes the managed native file through preload IPC.
- No renderer directly accesses a native path.

## Verification

- database-upgrade tests cover journal creation and migration;
- cleanup tests prove transaction-before-external-cleanup, retry retention, idempotency, and restart
  replay;
- presentation tests inject failure at catalog, derived, and thumbnail stages and prove no visible
  item or orphaned record remains;
- integrity tests prove zero-reference and ref-count mismatch detection from actual references;
- recovery tests prove cleanup issues and retry actions;
- Node/Web typechecks, focused ESLint, and production build pass.

## Completion conditions

R1 is complete only when:

- folder persistence progress already recorded in the roadmap remains green;
- cleanup failures survive restart and are retryable;
- editable-presentation creation cannot leave a partial catalog/blob/document/thumbnail set;
- integrity scan detects orphan and ref-count mismatch from authoritative references;
- the R1 acceptance gates and focused verification are recorded in the roadmap.
