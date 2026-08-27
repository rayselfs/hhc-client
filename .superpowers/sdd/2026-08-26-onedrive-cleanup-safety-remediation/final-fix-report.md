# Final whole-branch safety fix report

## Scope and constraints

- Worktree: `/Users/rayselfs/Projects/hhc/hhc-client-v2/.worktrees/fix-hhc-line-offline-policy`
- Branch: `fix/hhc-line-offline-policy` (unchanged)
- Starting head: `6b05e35f193d60077a89e9d308b7088f042906e0`
- Binding requirements: `final-fix-brief.md`
- No database schema, dependency, provider framework, build-budget, version, release, smoke, push, or remote changes.

## Root-cause verification

1. **OneDrive Trash safety**
   - `collectOneDriveRootScope()` used only records with `deletedAt == null` for local ownership.
   - A malformed Root A entry could therefore win on remote ancestry after its Root B local target entered Trash.
   - The resulting `removedFolderIds` / `removedItemIds` flowed through `applySyncRefreshPlan()` to `cleanupFileResources()`, which permanently deletes records, blobs, thumbnails, and derived resources instead of preserving the Trash retention path.

2. **Wrong-kind-only replay**
   - A wrong-kind reference made an entry ambiguous, but the final protection check only consulted remote ancestry and the kind-correct local field.
   - With no useful remote ancestry and only the wrong-kind selected-root reference left, removals were suppressed from scope without setting `protectRemovals`; the incremental `nextCursor` could then be persisted and consume the deletion.

3. **HHC derived-asset authorization fence**
   - `sync-download-queue` already supplied a live `canCommit` callback to `onDownloaded(result, canCommit)`.
   - `dispatchPlannedSyncDownloads()` discarded that callback, so source metadata, cover thumbnails, video-poster work/results, and ready events could commit after HHC account generation or root authorization changed.

## RED evidence

### OneDrive ownership and replay

Command:

```text
npx vitest run src/renderer/src/lib/__tests__/onedrive-connect.test.ts \
  -t "protects a deleted sibling|retains a deletion for replay"
```

Result before production changes: **5 failed, 35 skipped**.

- wrong-kind-only file entry persisted `cursor-next`
- wrong-kind-only folder entry persisted `cursor-next`
- deleted sibling item reported `removedItemCount: 1`
- deleted sibling folder reported `removedFolderCount: 1`
- deleted sibling root boundary reported one removed folder and one removed item

### HHC derived assets

The focused transfer/HHC/media/metadata/poster run failed in all five intended seams before production changes:

- dispatch callback did not receive the queue guard
- HHC media refresh did not receive the queue guard
- metadata probing never consulted the guard before persistence
- a revoked poster still queued
- a poster generated across authorization revocation still saved and emitted readiness

The exact metadata and poster regressions were also run separately to confirm their failures were at the persistent commit boundaries, rather than test setup or dispatcher behavior.

### Refactor safety RED

During the bounded ownership refactor, the 40-test OneDrive suite caught one regression: excluding a trashed sibling root from the protection boundary removed one folder and one item. The selected root remains required to be active, while all same-connection roots now remain available as protection evidence. The same suite then returned to 40/40 GREEN.

## GREEN implementation

### OneDrive

- Replaced duplicate descendant ownership graphs with cycle-safe bounded ancestor walks.
- Kind-correct active records remain the normal local-owner signal.
- Both local reference fields, including soft-deleted targets and a soft-deleted sibling root boundary, contribute fail-closed protection evidence.
- Ownership conflicts and wrong-kind references seed an unsafe remote ID; descendants inherit that protection through remote ancestry.
- Protected refreshes clear removal arrays and do not advance the cursor, preserving deletion replay.

### HHC derived media

- Preserved the queue's live guard through `dispatchPlannedSyncDownloads()` and all three HHC download call sites.
- Checked the live guard immediately before source-metadata persistence, thumbnail persistence, and ready-event dispatch.
- Video-poster enqueue/retry stores the live ownership guard in the smallest in-memory state needed by the existing media-job executor.
- The executor checks before generation and immediately before poster persistence and readiness, then clears the guard in `finally`; revocation blocks the job with the existing `authentication` reason.
- OneDrive and local imports omit the optional guard and retain their existing behavior.

## Verification

### Focused safety suite

```text
npx vitest run \
  src/renderer/src/lib/__tests__/onedrive-connect.test.ts \
  src/renderer/src/lib/__tests__/sync-refresh.test.ts \
  src/renderer/src/lib/__tests__/file-resource-cleanup.test.ts \
  src/renderer/src/lib/__tests__/hhc-line-connect.test.ts \
  src/renderer/src/lib/__tests__/hhc-line-access.test.ts \
  src/renderer/src/lib/__tests__/sync-transfer-dispatch.test.ts \
  src/renderer/src/lib/__tests__/sync-download-queue.test.ts \
  src/renderer/src/lib/__tests__/sync-media-assets.test.ts \
  src/renderer/src/lib/__tests__/media-metadata-authorization.test.ts \
  src/renderer/src/lib/__tests__/media-job-queue.test.ts \
  src/renderer/src/lib/__tests__/video-poster-jobs-authorization.test.ts \
  src/renderer/src/lib/__tests__/thumbnail-generator.test.ts \
  src/main/__tests__/ipc/video-poster.test.ts
```

Result: **13 files passed, 157 tests passed**.

### Full repository gates

- `npm test`: **238 files passed, 2710 tests passed**
- `npm run lint`: passed
- `npm run typecheck`: node and web passed
- `npm run build`: main, preload, renderer, PWA, and bundle-budget checks passed
  - exact PWA precache: **5,242,865 / 5,242,880 bytes** (15 bytes remaining)
  - no build-budget or precache-contract change
- `git diff --check`: passed

An earlier full run had one unrelated asynchronous `Layout` initialization timeout. The exact test passed in isolation and a fresh full run passed all 2,710 tests; no production change was made for that unrelated flake.

## Complete file scope

Production:

- `src/renderer/src/lib/hhc-line-connect.ts`
- `src/renderer/src/lib/local-sync-import.ts`
- `src/renderer/src/lib/media-metadata.ts`
- `src/renderer/src/lib/onedrive-connect.ts`
- `src/renderer/src/lib/sync-transfer-dispatch.ts`
- `src/renderer/src/lib/video-poster-jobs.ts`

Tests:

- `src/renderer/src/lib/__tests__/hhc-line-connect.test.ts`
- `src/renderer/src/lib/__tests__/media-metadata-authorization.test.ts`
- `src/renderer/src/lib/__tests__/onedrive-connect.test.ts`
- `src/renderer/src/lib/__tests__/sync-media-assets.test.ts`
- `src/renderer/src/lib/__tests__/sync-transfer-dispatch.test.ts`
- `src/renderer/src/lib/__tests__/video-poster-jobs-authorization.test.ts`

Report:

- `.superpowers/sdd/2026-08-26-onedrive-cleanup-safety-remediation/final-fix-report.md`

## Self-review

- Traced every destructive OneDrive output back to the scoped entry set and verified protected refreshes cannot produce cleanup IDs or cursor advancement.
- Verified ancestor walks are bounded for corrupt cycles and preserve ordinary Root A deletion behavior.
- Verified guard checks sit at metadata, thumbnail, poster-job/result, and ready-event boundaries; guard state is removed on poster completion, block, configuration failure, or generation failure.
- Verified unguarded OneDrive/local callers preserve their previous contracts.
- Verified no `as any`, new TypeScript suppression, schema, dependency, build configuration, version, or unrelated provider change was introduced.
- No Electron smoke, versioning, push, PR, merge, or release action was performed, as required.
