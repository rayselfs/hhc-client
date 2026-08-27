# HHC LINE Offline Policy Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HHC LINE media folders obey the Multimedia Offline Policy, download and thumbnail `always-offline` files in the background, and show warnings only for actionable sync failures.

**Architecture:** Keep `useSettingsStore.defaultSyncOfflinePolicy` as the single effective policy for cloud sync roots. Reuse the existing refresh planner, download queue, HHC access fences, native/IndexedDB storage, and thumbnail pipeline; route OneDrive and HHC transfer plans through one shared remote transfer dispatcher so future Google Drive support can reuse the same post-scan path. Existing roots converge to the selected policy during cloud refresh, and one shared provider-icon component renders approved provider branding without adding a plugin framework.

**Tech Stack:** Electron, React 19, TypeScript, Zustand, IndexedDB, Vitest, Electron Vite

**Spec:** `docs/roadmap/milestones/M2-media-library-sync.md`

## Global Constraints

- Change only `HallelujahHomeChurch/hhc-client-v2`; do not modify or deploy Asset API, Gateway, Account, Admin, or LINE helper services.
- Treat the Multimedia Offline Policy as authoritative for both HHC LINE and OneDrive cloud roots; local filesystem sync remains inherently `always-offline`.
- `always-offline` queues every supported remote file for background download, preserves downloaded bytes from ordinary cache cleanup, and generates the existing local thumbnail after download.
- `on-demand` and `online-only` may legitimately contain `remote-only` entries; that state must not produce a folder warning.
- Keep `outdated`, retryable download failures, fatal failures, insufficient storage, and access revocation visible through the existing sync health states.
- Preserve HHC account-generation and collection-authorization fences before committing downloaded bytes or thumbnails.
- A policy downgrade must not synchronously delete already downloaded media; the existing cleanup path may reclaim content according to its current safety rules.
- Add no dependencies and no new persistent database schema.
- Use the official unmodified LINE Brand Icon PNG from `https://www.line.me/en/logo`; render it at no less than 20px on desktop, preserve its isolation zone, and do not tint it or add backgrounds, shadows, masks, animation, or decoration.
- Do not implement Google Drive in this change. Preserve provider-specific OAuth/token, cursor/delta, HHC ACL/ticket, and local filesystem watcher logic; only the proven post-plan transfer and provider-icon duplication are shared.
- Follow RED-GREEN-REFACTOR for each behavior change.
- Execute implementation in an isolated worktree on a `fix/` branch created from latest `origin/main`; never commit directly to `main`.

---

### Task 1: Make the selected Multimedia policy authoritative

**Files:**

- Modify: `src/renderer/src/lib/hhc-line-connect.ts`
- Modify: `src/renderer/src/lib/onedrive-connect.ts`
- Modify: `src/renderer/src/lib/__tests__/hhc-line-connect.test.ts`
- Modify: `src/renderer/src/lib/__tests__/onedrive-connect.test.ts`

**Interfaces:**

- Consumes: `useSettingsStore.getState().defaultSyncOfflinePolicy: SyncOfflinePolicy`
- Produces: every cloud root refresh uses the selected policy and persists that value in `FolderRecord.syncLink.offlinePolicy`

- [ ] **Step 1: Replace the obsolete HHC expectation with failing policy tests**

  In `hhc-line-connect.test.ts`, mock the settings store using a mutable policy and replace the test that requires Electron to use `on-demand` with cases that prove:

  ```ts
  policy = 'always-offline'
  await importHhcLineCollection(auth(sessionRef), collection)
  expect(root.syncLink?.offlinePolicy).toBe('always-offline')
  expect(fileEntry.status).toBe('queued')
  ```

  Add a refresh case for a previously persisted HHC root whose `syncLink.offlinePolicy` is `on-demand`; after selecting `always-offline`, refresh must persist `always-offline` and plan the remote file as queued work without unlinking the root.

- [ ] **Step 2: Add the corresponding OneDrive regression test**

  In `onedrive-connect.test.ts`, persist a root with `on-demand`, set the current preference to `always-offline`, refresh, and assert the root and download plan use `always-offline`. This prevents the shared setting from remaining snapshot-only for one provider.

- [ ] **Step 3: Run the focused tests and verify the current behavior fails**

  Run:

  ```bash
  npx vitest run src/renderer/src/lib/__tests__/hhc-line-connect.test.ts src/renderer/src/lib/__tests__/onedrive-connect.test.ts
  ```

  Expected failures: HHC stores `on-demand`; refreshes continue using the root's stale policy.

- [ ] **Step 4: Use the current setting in HHC import and both cloud refresh paths**

  Import `useSettingsStore` where needed and resolve the policy at operation start:

  ```ts
  const offlinePolicy = useSettingsStore.getState().defaultSyncOfflinePolicy
  ```

  Use that value in `buildSyncRefreshPlan` / `buildSyncDeltaRefreshPlan`. When an existing root has another value, persist a copy with the current policy and publish the same copy to `useFileExplorerStore`; retain the existing root ID, cursor, ACL state, and provider connection.

- [ ] **Step 5: Run the focused tests until green**

  Run the Task 1 command again. Confirm all three policy values are covered and no test depends on Electron forcing `on-demand`.

- [ ] **Step 6: Commit the policy alignment**

  ```bash
  git add src/renderer/src/lib/hhc-line-connect.ts src/renderer/src/lib/onedrive-connect.ts src/renderer/src/lib/__tests__/hhc-line-connect.test.ts src/renderer/src/lib/__tests__/onedrive-connect.test.ts
  git commit -m "fix: align cloud folders with offline policy"
  ```

### Task 2: Dispatch remote always-offline downloads through one shared path

**Files:**

- Create: `src/renderer/src/lib/sync-transfer-dispatch.ts`
- Create: `src/renderer/src/lib/__tests__/sync-transfer-dispatch.test.ts`
- Modify: `src/renderer/src/lib/hhc-line-connect.ts`
- Modify: `src/renderer/src/lib/onedrive-connect.ts`
- Modify: `src/renderer/src/lib/__tests__/hhc-line-connect.test.ts`
- Modify: `src/renderer/src/lib/__tests__/onedrive-connect.test.ts`
- Test: `src/renderer/src/lib/__tests__/sync-download-queue.test.ts`
- Test: `src/renderer/src/lib/__tests__/sync-media-assets.test.ts`
- Test: `src/renderer/src/lib/__tests__/thumbnail-generator.test.ts`

**Interfaces:**

- Consumes: `SyncRefreshPlan.fileTransfers`, `ReadOnlySyncProvider`, `enqueueSyncDownload`, and provider-supplied commit/failure callbacks
- Produces: `dispatchPlannedSyncDownloads(input: DispatchPlannedSyncDownloadsInput): void`; supported remote files transition `queued -> downloading -> available-offline`, and successful downloads invoke existing JPG/PPTX thumbnail generation

- [ ] **Step 1: Add failing shared-dispatch tests**

  Create `sync-transfer-dispatch.test.ts` with one plan containing a JPG, one PPTX, and one unchanged available file. Define the exact shared input:

  ```ts
  export interface DispatchPlannedSyncDownloadsInput {
    provider: ReadOnlySyncProvider
    providerConnectionId: string
    rootRemoteFolderId: string
    offlinePolicy: SyncOfflinePolicy
    plan: Pick<SyncRefreshPlan, 'fileTransfers' | 'items'>
    remoteItems: RemoteSyncItem[]
    existingEntries: SyncEntryRecord[]
    canCommit?: (transfer: SyncFileTransfer) => boolean | Promise<boolean>
    onFailed?: (error: unknown, transfer: SyncFileTransfer) => void | Promise<void>
    onDownloaded?: (item: FileItemRecord) => void | Promise<void>
  }
  ```

  Assert `dispatchPlannedSyncDownloads()` queues only `plan.fileTransfers`, uses `priority: 'background'`, carries metadata/previous entry into `enqueueSyncDownload`, forwards commit/failure callbacks, and invokes `onDownloaded` with the matching local item.

- [ ] **Step 2: Run the shared-dispatch test and verify it fails because the module does not exist**

  ```bash
  npx vitest run src/renderer/src/lib/__tests__/sync-transfer-dispatch.test.ts
  ```

- [ ] **Step 3: Implement the minimal shared dispatcher**

  Add `dispatchPlannedSyncDownloads()` as a synchronous loop that indexes `remoteItems`, `existingEntries`, and `plan.items`, then calls the existing `enqueueSyncDownload`. Do not move scan, delta, authentication, persistence, retry classification, or provider API logic into this module.

- [ ] **Step 4: Add a failing HHC import test for background downloads**

  With policy `always-offline`, return one JPG and one PPTX from collection changes. Assert that import queues both using:

  ```ts
  expect(enqueueSyncDownload).toHaveBeenCalledTimes(2)
  expect(enqueueSyncDownload).toHaveBeenCalledWith(
    expect.objectContaining({
      request: expect.objectContaining({ offlinePolicy: 'always-offline' }),
      priority: 'background',
      canCommit: expect.any(Function),
      onFailed: expect.any(Function),
      onDownloaded: expect.any(Function)
    })
  )
  ```

  Invoke each `onDownloaded` callback and assert `refreshImportedMediaAssets` receives the matching local item.

- [ ] **Step 5: Add a failing HHC refresh test for new and updated files**

  Start with an active HHC root and one available file, return one new file and one changed ETag/source revision, then assert only those two transfers are queued. Verify unchanged available content is not downloaded again.

- [ ] **Step 6: Add HHC access-fence assertions**

  Exercise `canCommit` and `onFailed` from the queued request. Confirm an account change, inactive root, or scoped `403/404` prevents commit and routes through the existing HHC access handler instead of leaving an offline blob attached to the wrong user/root.

- [ ] **Step 7: Run the focused HHC test and confirm there is currently no background dispatch**

  ```bash
  npx vitest run src/renderer/src/lib/__tests__/hhc-line-connect.test.ts
  ```

  Expected failure: `plan.fileTransfers` may be populated, but HHC import/refresh never calls `enqueueSyncDownload`.

- [ ] **Step 8: Route HHC imports and refreshes through the shared dispatcher**

  In `hhc-line-connect.ts`, call `dispatchPlannedSyncDownloads()` after import/refresh records and the active root have been committed. Supply the existing provider instance, account-generation/root authorization guard, access-error handler, and `refreshImportedMediaAssets` callback already used by presentation-priority HHC downloads.

  Do not await the full downloads; the existing queue and sync-entry events remain responsible for progress and retries.

- [ ] **Step 9: Route OneDrive imports and refreshes through the same dispatcher**

  Replace the duplicated OneDrive `plan.fileTransfers` loops with `dispatchPlannedSyncDownloads()`. Preserve OneDrive token handling, Graph delta fallback, provider retry classification, and presentation-priority behavior. Add a regression assertion that OneDrive still queues the same files and invokes thumbnail refresh.

- [ ] **Step 10: Verify downloader and thumbnail contracts**

  Run:

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/sync-transfer-dispatch.test.ts \
    src/renderer/src/lib/__tests__/hhc-line-connect.test.ts \
    src/renderer/src/lib/__tests__/onedrive-connect.test.ts \
    src/renderer/src/lib/__tests__/sync-download-queue.test.ts \
    src/renderer/src/lib/__tests__/sync-media-assets.test.ts \
    src/renderer/src/lib/__tests__/thumbnail-generator.test.ts
  ```

  Expected: OneDrive and HHC use the same bounded transfer dispatcher; downloaded JPG and PPTX items reach the existing thumbnail generator without an Asset API derivative request.

- [ ] **Step 11: Commit the shared remote transfer path**

  ```bash
  git add src/renderer/src/lib/sync-transfer-dispatch.ts src/renderer/src/lib/__tests__/sync-transfer-dispatch.test.ts src/renderer/src/lib/hhc-line-connect.ts src/renderer/src/lib/onedrive-connect.ts src/renderer/src/lib/__tests__/hhc-line-connect.test.ts src/renderer/src/lib/__tests__/onedrive-connect.test.ts
  git commit -m "fix: share remote offline download dispatch"
  ```

### Task 3: Make sync health describe actionable conditions

**Files:**

- Modify: `src/renderer/src/lib/sync-folder-health.ts`
- Modify: `src/renderer/src/lib/__tests__/sync-folder-health.test.ts`
- Test: `src/renderer/src/components/Control/FileExplorer/FileBrowser.tsx`
- Test: `src/renderer/src/components/Control/FileExplorer/views/GridView.tsx`

**Interfaces:**

- Consumes: `SyncEntryStatus`
- Produces: `deriveSyncFolderHealth()` returns `ok` for stable `remote-only` files and retains warning/error precedence for actionable states

- [ ] **Step 1: Write the failing remote-only health cases**

  Add cases proving a folder containing only `remote-only` files returns:

  ```ts
  expect(health).toMatchObject({ status: 'ok', warningCount: 0 })
  ```

  Retain separate cases proving `outdated` and retryable failures return `warning`, fatal/insufficient-storage entries return `error`, queued/downloading entries return `syncing`, and access revocation returns `error`.

- [ ] **Step 2: Run the focused test and verify it fails with `warning`**

  ```bash
  npx vitest run src/renderer/src/lib/__tests__/sync-folder-health.test.ts
  ```

- [ ] **Step 3: Remove `remote-only` from the warning predicate**

  Keep unsupported/remote-only availability visible on the file itself. Folder health must aggregate only work or failures that require attention; do not special-case HHC provider IDs in the UI.

- [ ] **Step 4: Run the focused health and File Browser tests**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/sync-folder-health.test.ts \
    src/renderer/src/components/Control/FileExplorer/__tests__/FileBrowser.presentation-open.test.tsx
  ```

- [ ] **Step 5: Commit the health correction**

  ```bash
  git add src/renderer/src/lib/sync-folder-health.ts src/renderer/src/lib/__tests__/sync-folder-health.test.ts
  git commit -m "fix: reserve sync warnings for actionable states"
  ```

### Task 4: Add compliant LINE branding and centralize provider icons

**Files:**

- Create: `src/renderer/src/assets/line-brand-icon.png`
- Create: `src/renderer/src/components/icons/LineBrandIcon.tsx`
- Create: `src/renderer/src/components/icons/SyncProviderIcon.tsx`
- Create: `src/renderer/src/components/icons/__tests__/SyncProviderIcon.test.tsx`
- Modify: `src/renderer/src/pages/FilesPage.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/FileExplorerFAB.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/views/GridView.tsx`
- Modify: `src/renderer/src/pages/__tests__/FilesPage.hhc-line.test.tsx`

**Interfaces:**

- Consumes: `SyncProviderType`
- Produces: `SyncProviderIcon({ providerType, className? })` as the single provider-icon mapping for local filesystem, OneDrive, and HHC LINE

- [ ] **Step 1: Acquire and verify the official asset**

  Download the official full-color LINE Brand Icon PNG linked from `https://www.line.me/en/logo` and save it unchanged as `src/renderer/src/assets/line-brand-icon.png`. Record the source URL in the component comment; do not redraw, optimize, recolor, crop, or convert the file.

- [ ] **Step 2: Write failing icon contract tests**

  Assert `SyncProviderIcon` renders the existing `OneDriveIcon` for `onedrive`, the official image with accessible name `LINE` and minimum 20px dimensions for `hhc-line`, and the existing `FolderSync` glyph for `local-fs`. Assert the LINE image receives no color, background, shadow, mask, animation, or decoration class.

- [ ] **Step 3: Implement the two minimal icon components**

  `LineBrandIcon` renders only the official PNG inside an isolation wrapper. `SyncProviderIcon` owns the three-way mapping. Do not create a general plugin manifest or move provider authentication/configuration into UI code.

- [ ] **Step 4: Replace scattered icon decisions**

  Use `SyncProviderIcon` in the cloud picker, File Explorer FAB, and root folder provider badge. Remove the HHC generic `Cloud`/`FolderSync` substitution. For the folder badge, remove the current colored circle and drop shadow around the LINE asset while preserving existing folder and health overlays.

- [ ] **Step 5: Run focused icon and FilesPage tests**

  ```bash
  npx vitest run \
    src/renderer/src/components/icons/__tests__/SyncProviderIcon.test.tsx \
    src/renderer/src/pages/__tests__/FilesPage.hhc-line.test.tsx \
    src/renderer/src/components/Control/FileExplorer/__tests__/FileBrowser.presentation-open.test.tsx
  ```

- [ ] **Step 6: Commit provider branding**

  ```bash
  git add src/renderer/src/assets/line-brand-icon.png src/renderer/src/components/icons/LineBrandIcon.tsx src/renderer/src/components/icons/SyncProviderIcon.tsx src/renderer/src/components/icons/__tests__/SyncProviderIcon.test.tsx src/renderer/src/pages/FilesPage.tsx src/renderer/src/components/Control/FileExplorer/FileExplorerFAB.tsx src/renderer/src/components/Control/FileExplorer/views/GridView.tsx src/renderer/src/pages/__tests__/FilesPage.hhc-line.test.tsx
  git commit -m "fix: use official LINE provider branding"
  ```

### Task 5: Apply policy changes without requiring rebind

**Files:**

- Modify: `src/renderer/src/lib/sync-runtime.ts`
- Modify: `src/renderer/src/lib/__tests__/sync-runtime.test.ts`
- Modify: `src/renderer/src/components/Control/UserMenu/MediaSettings.tsx`
- Modify: `src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx`
- Modify: `src/renderer/src/locales/en.json`
- Modify: `src/renderer/src/locales/zh-TW.json`
- Modify: `src/renderer/src/locales/zh-CN.json`

**Interfaces:**

- Consumes: Zustand `useSettingsStore.subscribe` and the existing cloud refresh loop
- Produces: changing `defaultSyncOfflinePolicy` schedules one immediate cloud refresh; existing roots converge without unlink/rebind

- [ ] **Step 1: Add a failing runtime test for a policy transition**

  Start the sync runtime with existing HHC and OneDrive roots, change the policy from `on-demand` to `always-offline`, and assert one cloud refresh is scheduled without restarting the app. Use fake timers and verify repeated selection of the same value does not create another refresh.

- [ ] **Step 2: Run the focused runtime/settings tests**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/sync-runtime.test.ts \
    src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx
  ```

  Expected failure: the persisted setting changes, but the running sync runtime is not notified.

- [ ] **Step 3: Subscribe the existing runtime to policy changes**

  Add one `useSettingsStore.subscribe` listener inside `startSyncRuntime`. When the policy value changes, cancel the pending cloud timeout and schedule the existing cloud refresh path immediately. If a cloud refresh is already running, set one coalesced rerun flag and execute exactly one follow-up refresh after it finishes. Reuse the current provider guards, unsubscribe in the returned disposer, and do not introduce a second timer or event bus.

- [ ] **Step 4: Clarify the UI contract**

  Keep the existing three choices and add concise localized helper text stating that the selected policy applies to HHC LINE and OneDrive folders. Do not add per-provider or per-folder controls.

- [ ] **Step 5: Run the focused tests until green**

  Run the Task 5 Step 2 command again and confirm runtime disposal removes the settings subscription.

- [ ] **Step 6: Commit live policy reconciliation**

  ```bash
  git add src/renderer/src/lib/sync-runtime.ts src/renderer/src/lib/__tests__/sync-runtime.test.ts src/renderer/src/components/Control/UserMenu/MediaSettings.tsx src/renderer/src/components/Control/UserMenu/__tests__/PreferencesDialog.test.tsx src/renderer/src/locales/en.json src/renderer/src/locales/zh-TW.json src/renderer/src/locales/zh-CN.json
  git commit -m "fix: apply offline policy changes to cloud folders"
  ```

### Task 6: Verify, deliver, and release

**Files:**

- Modify only if release is authorized: `package.json`, lockfile, and updater/release metadata required by the existing workflow
- Review: every changed file against `origin/main`

**Interfaces:**

- Produces: one reviewable PR, passing CI, immutable desktop packages, and observed device acceptance

- [ ] **Step 1: Run focused acceptance tests**

  ```bash
  npx vitest run \
    src/renderer/src/lib/__tests__/hhc-line-connect.test.ts \
    src/renderer/src/lib/__tests__/onedrive-connect.test.ts \
    src/renderer/src/lib/__tests__/sync-transfer-dispatch.test.ts \
    src/renderer/src/lib/__tests__/sync-download-queue.test.ts \
    src/renderer/src/lib/__tests__/sync-folder-health.test.ts \
    src/renderer/src/lib/__tests__/sync-media-assets.test.ts \
    src/renderer/src/lib/__tests__/thumbnail-generator.test.ts \
    src/renderer/src/lib/__tests__/sync-runtime.test.ts \
    src/renderer/src/components/icons/__tests__/SyncProviderIcon.test.tsx
  ```

- [ ] **Step 2: Run repository quality gates**

  ```bash
  npm test
  npm run lint
  npm run typecheck
  npm run build
  ```

- [ ] **Step 3: Perform the local Electron smoke with synthetic media**

  Set the policy to `always-offline`, bind an authorized HHC LINE collection containing one JPG and one PPTX, and verify:

  1. Both entries progress from queued/downloading to available offline.
  2. The folder icon progresses from syncing to OK, with no persistent warning.
  3. Both thumbnails appear after download.
  4. After restarting without network, both files remain locally usable according to their supported presentation flow.
  5. Returning online and adding a new file triggers background download on refresh.
  6. Changing to `on-demand` leaves remote-only entries non-warning and does not synchronously delete already downloaded files.

  Record only pass/fail, app version, commit SHA, and timestamps; do not record account IDs, collection IDs, tickets, or media contents.

- [ ] **Step 4: Inspect scope and security boundaries**

  Confirm the diff contains no Asset API request-contract change, no token/ticket logging, no bypass of `isHhcLineRootAuthorized`, no new dependency, no Google Drive implementation, no provider plugin framework, no modified LINE artwork, and no unrelated media/projection behavior.

- [ ] **Step 5: Prepare the release version only when release is authorized**

  Before opening the PR, resolve the next non-colliding patch version from current tags. Update the version and lockfile on the same feature branch so the release commit is reviewed and merged through the PR. If release is not authorized, leave version files unchanged and stop after PR validation.

- [ ] **Step 6: Open the PR and wait for CI**

  Push the `fix/hhc-line-offline-policy` branch, open one PR against `main`, and wait for all required checks. Do not bypass or merge around a failure.

- [ ] **Step 7: Merge and release only after approval**

  After PR approval and green CI, squash merge. If the reviewed PR contains an authorized version bump, tag the merged `main` commit and let `build-release.yml` publish the immutable macOS and Windows artifacts. Never create an unreviewed version commit directly on `main`.

- [ ] **Step 8: Verify the published release contract**

  Verify tag/head alignment, release workflow success, DMG/ZIP/Windows installer assets, blockmaps, `latest.yml`, `latest-mac.yml`, and `SHA256SUMS`. Perform one installed-device updater or installer smoke; do not call the release complete from CI alone.

## Rollback and Stop Conditions

- Preserve the last healthy desktop release and updater manifests until the new package smoke passes.
- Stop before merge if any focused/full test, lint, typecheck, build, authorization-fence test, or Electron smoke fails.
- Stop release if the tag is not the merged `main` head, updater manifests reference missing assets, checksums differ, or the installed app cannot complete the always-offline JPG/PPTX smoke.
- A desktop client already updated to a faulty build is not downgraded automatically; stop rollout and publish a corrected patch from the last healthy `main` lineage.
- Do not compensate for a Client failure by modifying production ACLs, downloading assets through unscoped URLs, or enabling Asset API derivatives for `line.group.media-sync`.

## Acceptance Contract

- Selecting `always-offline` before binding causes HHC LINE JPG and PPTX items to download automatically and generate local thumbnails.
- Changing an existing installation from `on-demand` to `always-offline` does not require unlink/rebind or app restart.
- Stable `remote-only` entries under `on-demand` or `online-only` do not show a folder warning.
- Queued/downloading work, outdated content, retryable/fatal failures, insufficient storage, and revoked access remain distinguishable.
- OneDrive and HHC LINE use the same remote transfer dispatcher while retaining provider-specific authentication, cursor, and authorization behavior.
- Picker, add-source action, and root folder badge render the official unmodified LINE Brand Icon at a compliant desktop size.
- The existing provider interfaces remain the extension point for future Google Drive support; this change does not implement Google Drive or a speculative plugin framework.
- No server repository, production database, ACL, queue, or derivative worker changes are required.
