# LibrePresenter media import and status implementation plan

> Execute in `.worktrees/media-import-status-auth` from current `origin/main`.

**Goal:** Fix packaged PDFs, localize file processing/status UI, preserve provider metadata in
Favorites, render account avatars, and keep native auth/MKV state safe.

## Task 1: Package and verify the PDF.js worker

**Files:**

- Modify: `src/renderer/src/lib/pdfjs-loader.ts`
- Modify: `scripts/check-packaged-runtime.mjs`
- Modify/Create: focused tests under `src/renderer/src/lib/__tests__/` and `scripts/`

Write a failing check for a worker emitted as raw TypeScript/non-JavaScript. Import the existing
polyfill worker with Vite's worker URL query and set `GlobalWorkerOptions.workerSrc` to that output.
Run the focused tests, `npm run build`, and inspect the emitted worker.

## Task 2: Replace the global recovery count with one item status view

**Files:**

- Delete: `src/renderer/src/components/Control/RecoveryCenter/RecoveryIndicator.tsx`
- Delete/Modify: its focused tests
- Modify: `src/renderer/src/components/Control/UserMenu/UserMenu.tsx`
- Create: `src/renderer/src/components/Control/FileExplorer/FileItemStatus.tsx`
- Create: focused status component tests
- Modify: `src/renderer/src/components/Control/FileExplorer/views/GridView.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/views/ListView.tsx`

Remove only the sidebar indicator, not recovery data/actions. Adapt sync-root health and ordinary
media processing to a shared view model/component. Keep `sync-db`, media jobs, and upload state
separate. Render identical status semantics in grid and list layouts.

## Task 3: Move upload thumbnail work behind the existing media queue

**Files:**

- Modify: `src/renderer/src/lib/upload-utils.ts`
- Create/Modify: the smallest executor module for existing `cover-thumbnail` jobs
- Modify: upload/media-job tests

Use the already-defined `cover-thumbnail` job instead of synchronously generating image/PDF covers
inside folder upload. Keep the current concurrency limits and completion event. This removes the
brief renderer stall and gives ordinary uploads a real processing status without inventing another
store.

## Task 4: Preserve provider/status metadata in Favorites

**Files:**

- Modify: `src/renderer/src/pages/FavoritesPage.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/FileBrowser.tsx`
- Modify/Create: Favorites and list/grid tests

Reuse one item projection helper so Files and Favorites retain `syncProviderType`, while Files adds
root health, processing status, progress, and tooltip to that same item shape. Verify Local,
OneDrive, and LINE roots in both grid and list layouts.

## Task 5: Render the authenticated avatar

**Files:**

- Modify: `src/renderer/src/components/Control/UserMenu/UserMenu.tsx`
- Create/Modify: `src/renderer/src/components/Control/UserMenu/UserMenu.test.tsx`

Render `Avatar.Image` only when `session.avatarUrl` exists and retain the existing fallback. Test both
remote avatar and no-avatar sessions.

## Task 6: Verify safe native-auth completion

**Files:**

- Inspect: `src/main/ipc/hhc-auth.ts`
- Inspect: `src/shared/hhc-auth.ts`
- Verify: existing HHC auth callback tests

Keep the existing exact custom-protocol and PKCE/state/TTL validation unchanged. Route the browser
through the Account FE completion page; no desktop callback contract change is required.

## Task 7: Verify MKV failure synchronization

**Files:**

- Modify only if required by failing assertions: `src/main/ipc/projection-vlc.ts`
- Modify only if required: shared VLC failure types and projection notice translations
- Modify: `src/main/__tests__/ipc/projection-vlc.test.ts`
- Modify: renderer projection-context tests if the typed contract changes

Run the valid and truncated `Desktop/test` MKV fixtures through current probe/playback smoke. Assert a
premature end leaves control and projection in the same stopped/error generation. Do not add an
import-time full decode. Add a damaged-media failure code/message only if current generic handling is
the remaining gap.

## Task 8: Full verification, PR, CI, and merge without release

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run build:unpack
```

Perform packaged smoke for both PDFs, folder upload responsiveness/status, provider icons in Files
and Favorites, avatar, valid MKV seek, and damaged MKV failure synchronization. Push, open the PR,
wait for required CI, address review, and merge. Do not bump version, tag, create a GitHub release, or
dispatch the release workflow.
