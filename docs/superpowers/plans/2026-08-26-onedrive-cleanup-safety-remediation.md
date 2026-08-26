# OneDrive Cleanup Safety Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two remaining OneDrive destructive-cleanup safety gaps before resuming the HHC LINE offline-policy Electron smoke and release.

**Architecture:** Keep the existing root-ownership resolver and fail-closed removal gate. Treat wrong-kind local references as malformed ambiguity, and when destructive removals are suppressed, retain the previous cursor so the provider deletion delta can replay after ownership is repaired.

**Tech Stack:** Electron, TypeScript, IndexedDB, Vitest

**Spec:** `docs/superpowers/plans/2026-08-26-hhc-line-offline-policy-alignment.md`

## Global Constraints

- Change only `src/renderer/src/lib/onedrive-connect.ts` and `src/renderer/src/lib/__tests__/onedrive-connect.test.ts`, plus this remediation plan.
- Add no dependency, schema, provider framework, global repair sweep, or new persistent state.
- Preserve OneDrive token, cursor-fetch, expired-cursor fallback, download dispatch, and normal unambiguous deletion behavior.
- Never create a tombstone or cleanup request containing the selected root ID because of a malformed non-root entry.
- A fail-closed refresh may apply non-destructive updates/downloads, but it must not consume the cursor representing suppressed deletions.
- Follow RED-GREEN-REFACTOR.

---

### Task 1: Harden malformed ownership and deletion replay

**Files:**

- Modify: `src/renderer/src/lib/onedrive-connect.ts`
- Modify: `src/renderer/src/lib/__tests__/onedrive-connect.test.ts`

**Interfaces:**

- Consumes: `collectOneDriveRootScope(...): { entries, protectRemovals }`, `SyncEntryRecord`, `scan.nextCursor`, `putSyncCursor()`
- Produces: wrong-kind local references seed fail-closed protection; protected refreshes retain the previous cursor and replay suppressed deletion events

- [ ] **Step 1: Add failing wrong-kind reference tests**

  Add root-specific full-refresh tests for:

  - a malformed `kind: 'file'` entry whose `folderId` equals the selected root ID;
  - a malformed `kind: 'folder'` entry carrying an `itemId` owned under the selected root.

  In both cases, assert the refresh emits no tombstone, no folder/item cleanup ID, and never includes the selected root ID in cleanup. Keep one ordinary unambiguous remote deletion assertion proving cleanup still occurs.

- [ ] **Step 2: Verify the wrong-kind tests fail**

  Run:

  ```bash
  npx vitest run src/renderer/src/lib/__tests__/onedrive-connect.test.ts
  ```

  Expected: the malformed file entry can currently pass ownership and expose its wrong-kind `folderId` to tombstone/recovery cleanup.

- [ ] **Step 3: Implement the minimum malformed-entry guard**

  In the existing ownership loop, treat either wrong-kind field as ambiguity:

  ```ts
  const hasWrongKindLocalReference =
    (entry.kind === 'file' && Boolean(entry.folderId)) ||
    (entry.kind === 'folder' && Boolean(entry.itemId))
  ```

  Include it in the existing `ambiguous` predicate. Do not add a new ownership resolver or mutate stored records.

- [ ] **Step 4: Add failing cursor replay tests**

  For a refresh where ambiguity makes `protectRemovals` true and `scan.nextCursor` is present, assert `putSyncCursor` is not called with that cursor. Add the paired normal-refresh assertion proving an unprotected refresh still persists `scan.nextCursor`.

- [ ] **Step 5: Verify the cursor test fails**

  Run the focused test command again.

  Expected: the protected refresh currently clears removal arrays but still calls `putSyncCursor()`.

- [ ] **Step 6: Preserve the previous cursor on fail-closed refresh**

  Guard the existing cursor write:

  ```ts
  if (!rootScope.protectRemovals && scan.nextCursor) {
    await putSyncCursor(...)
  }
  ```

  Do not delete the existing cursor. Reusing it is the minimal replay contract and keeps provider delta semantics unchanged.

- [ ] **Step 7: Run focused and repository gates**

  Run:

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/onedrive-connect.test.ts \
    src/renderer/src/lib/__tests__/sync-refresh.test.ts \
    src/renderer/src/lib/__tests__/hhc-line-connect.test.ts \
    src/renderer/src/lib/__tests__/file-resource-cleanup.test.ts
  npm test
  npm run lint
  npm run typecheck
  npm run build
  git diff --check
  ```

  Expected: wrong-kind entries fail closed without root cleanup, suppressed deletion cursors replay, normal cursor/deletion behavior remains unchanged, and all repository gates pass.

- [ ] **Step 8: Commit the remediation**

  ```bash
  git add docs/superpowers/plans/2026-08-26-onedrive-cleanup-safety-remediation.md src/renderer/src/lib/onedrive-connect.ts src/renderer/src/lib/__tests__/onedrive-connect.test.ts
  git commit -m "fix: harden OneDrive cleanup replay"
  ```

## Stop Conditions

- Stop before Electron smoke if any wrong-kind entry can create a selected-root tombstone or cleanup ID.
- Stop before Electron smoke if a protected refresh advances the cursor.
- Stop before version, PR, or release if any focused/full test, lint, typecheck, or build fails.
