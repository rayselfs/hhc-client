# Media Sync Slice 0: Multimedia Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the known projection, VLC, PDF, capability, responsive-layout, and sync-cancellation hazards before HHC account media synchronization is introduced.

**Architecture:** Keep all fixes inside existing shared runtime boundaries. Cancellation belongs in the shared download queue, replay belongs in the projection coordinator, VLC failures use typed projection IPC, and rendering fixes remain in the existing media surfaces.

**Tech Stack:** React 19, TypeScript, Zustand, Electron IPC, Vitest, Playwright, pdf.js, electron-vlc-player, Tailwind CSS.

## Global Constraints

- Repository: `/Users/rayselfs/Projects/hhc/hhc-client-v2`.
- Work on a feature branch; never commit directly to `main`.
- Electron and browser mode must remain behaviorally equivalent except for native VLC and filesystem capabilities.
- Projection content changes only on explicit projection actions.
- `DefaultProjection` remains an internal fallback, not a user-facing blank mode.
- Use existing dependencies and `WorkspacePrimitives`; add no auth, PDF, video, or layout package.
- Use `hhcPersistStorage` for persisted Zustand data; this slice does not add persisted state.
- Keep current bundle budgets green.
- Each task ends with its focused tests and one Conventional Commit.

---

## File Map

| File | Responsibility |
| --- | --- |
| `src/renderer/src/lib/sync-download-queue.ts` | Provider/root cancellation, active abort controllers, and pre-commit authorization |
| `src/renderer/src/lib/sync-provider.ts` | Commit-guard contract shared by downloadable providers |
| `src/renderer/src/lib/sync-unlink.ts` | Cancel work before unlink cleanup |
| `src/renderer/src/lib/projection-session-coordinator.ts` | Authoritative snapshot replay after unblank/blackout |
| `src/shared/ipc-channels.ts` | Typed VLC runtime failure contract |
| `src/main/ipc/projection-vlc.ts` | VLC failure classification and publication |
| `src/renderer/src/components/Projection/FileProjection.tsx` | VLC failure forwarding, bounded PDF rendering, and source-aspect layout |
| `src/renderer/src/contexts/ProjectionContext.tsx` | Operator-visible VLC failure state |
| `src/renderer/src/components/Control/ProjectionRecoveryNotice.tsx` | Recovery notice and retry action |
| `src/renderer/src/lib/media-capabilities.ts` | Correct TIFF/HEIC/HEIF capability declarations |
| `src/renderer/src/lib/media-import-policy.ts` | Capability-probe-aware import result |
| `src/renderer/src/pages/PresentationWorkspacePage.tsx` | Reuse responsive workspace primitives for read-only PPTX |

### Task 1: Add provider/root cancellation to the shared download queue

**Files:**
- Modify: `src/renderer/src/lib/sync-provider.ts`
- Modify: `src/renderer/src/lib/sync-download-queue.ts`
- Modify: `src/renderer/src/lib/sync-unlink.ts`
- Modify: `src/renderer/src/lib/onedrive-provider.ts`
- Modify: `src/renderer/src/lib/onedrive-connect.ts`
- Test: `src/renderer/src/lib/__tests__/sync-download-queue.test.ts`
- Test: `src/renderer/src/lib/__tests__/sync-unlink.test.ts`
- Test: `src/renderer/src/lib/__tests__/onedrive-provider.test.ts`

**Interfaces:**
- Produces: `SyncDownloadCommitGuard = () => boolean | Promise<boolean>`.
- Produces: `cancelSyncDownloads({ providerConnectionId, remoteItemId? }): number`.
- Changes: `ReadOnlySyncProvider.downloadContent(request, signal, canCommit)`.
- Invariant: a cancelled job resolves `null`, writes no failed entry, and cannot commit a late response.

- [ ] **Step 1: Write queue cancellation tests**

Add tests that enqueue one active and one queued job for the same connection, call `cancelSyncDownloads`, and prove both promises resolve `null`, the active signal is aborted, and `onDownloaded` is not called.

~~~ts
const active = enqueueSyncDownload(job('connection-a', 'remote-a', canCommit))
const queued = enqueueSyncDownload(job('connection-a', 'remote-b', canCommit))

expect(cancelSyncDownloads({ providerConnectionId: 'connection-a' })).toBe(2)
await expect(Promise.all([active, queued])).resolves.toEqual([null, null])
expect(onDownloaded).not.toHaveBeenCalled()
~~~

- [ ] **Step 2: Run the focused tests and confirm the missing API failure**

Run:

~~~bash
npx vitest run src/renderer/src/lib/__tests__/sync-download-queue.test.ts src/renderer/src/lib/__tests__/sync-unlink.test.ts
~~~

Expected: TypeScript/test failure because `cancelSyncDownloads` and the commit guard do not exist.

- [ ] **Step 3: Implement cancellation and commit guards**

Store one `AbortController` and `cancelled` flag on each queue job. Remove queued matching jobs immediately. Abort active matching jobs. Call `canCommit` immediately before provider storage commit and again before `onDownloaded`. Treat the internal cancellation error separately from provider errors so no retry/failure state is written.

~~~ts
export type SyncDownloadCommitGuard = () => boolean | Promise<boolean>

export function cancelSyncDownloads(scope: {
  providerConnectionId: string
  remoteItemId?: string
}): number
~~~

Update OneDrive save paths to execute:

~~~ts
if (!(await canCommit())) throw new SyncDownloadCancelledError()
return saveDownloadedContent(request, response, metadata)
~~~

Call `cancelSyncDownloads` before tombstones or local resource cleanup in both unlink functions.

- [ ] **Step 4: Run the queue/provider regression set**

Run:

~~~bash
npx vitest run src/renderer/src/lib/__tests__/sync-download-queue.test.ts src/renderer/src/lib/__tests__/sync-unlink.test.ts src/renderer/src/lib/__tests__/onedrive-provider.test.ts src/renderer/src/lib/__tests__/onedrive-connect.test.ts
~~~

Expected: all tests pass; no cancelled job is classified as retryable or fatal.

- [ ] **Step 5: Commit**

~~~bash
git add src/renderer/src/lib/sync-provider.ts src/renderer/src/lib/sync-download-queue.ts src/renderer/src/lib/sync-unlink.ts src/renderer/src/lib/onedrive-provider.ts src/renderer/src/lib/onedrive-connect.ts src/renderer/src/lib/__tests__
git commit -m "fix: cancel stale sync downloads before commit"
~~~

### Task 2: Replay authoritative media state when output is restored

**Files:**
- Modify: `src/renderer/src/lib/projection-session-coordinator.ts`
- Test: `src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts`
- Test: `src/renderer/src/pages/__tests__/ProjectionPage.test.tsx`

**Interfaces:**
- Consumes: existing `ProjectionSessionSnapshot` and `__system:replay`.
- Produces: restoring blank or blackout sends one replay snapshot after the visibility flag changes.
- Invariant: replay uses the latest playback position recorded by `recordPlayback`.

- [ ] **Step 1: Write restoration replay tests**

Cover both transitions:

~~~ts
coordinator.blackout(true)
coordinator.recordPlayback(7, playback({ currentTime: 42, isPlaying: true }))
coordinator.blackout(false)

expect(send).toHaveBeenLastCalledWith('__system:replay', {
  generation: 7,
  snapshot: expect.objectContaining({
    isBlackout: false,
    media: expect.objectContaining({
      state: expect.objectContaining({ positionSeconds: 42, isPlaying: true })
    })
  })
})
~~~

Repeat for `blank(true)` followed by `blank(false)`. Assert enabling blank/blackout does not replay.

- [ ] **Step 2: Run the tests and confirm the missing replay**

Run:

~~~bash
npx vitest run src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts src/renderer/src/pages/__tests__/ProjectionPage.test.tsx
~~~

Expected: the final call is only `__system:blackout` or `__system:blank`.

- [ ] **Step 3: Send replay only on restore transitions**

In `blank` and `blackout`, capture the previous flag, update the snapshot, send the visibility message, then send `__system:replay` only when changing from hidden to visible and the generation is ready.

Do not add a second snapshot store and do not keep VLC alive behind blackout.

- [ ] **Step 4: Run projection regression tests**

Run:

~~~bash
npx vitest run src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts src/renderer/src/pages/__tests__/ProjectionPage.test.tsx src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx
~~~

Expected: all pass; restored video/PDF receives the latest replay state.

- [ ] **Step 5: Commit**

~~~bash
git add src/renderer/src/lib/projection-session-coordinator.ts src/renderer/src/lib/__tests__/projection-session-coordinator.test.ts src/renderer/src/pages/__tests__/ProjectionPage.test.tsx
git commit -m "fix: replay media state after restoring output"
~~~

### Task 3: Surface typed VLC start and runtime failures

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/main/ipc/projection-vlc.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/preload/index.d.ts`
- Modify: `src/renderer/src/contexts/ProjectionContext.tsx`
- Modify: `src/renderer/src/components/Control/ProjectionRecoveryNotice.tsx`
- Test: `src/main/__tests__/ipc/projection-vlc.test.ts`
- Test: `src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx`
- Test: `src/renderer/src/components/Control/__tests__/ProjectionRecoveryNotice.test.tsx`

**Interfaces:**
- Produces:

~~~ts
type ProjectionVlcFailureCode =
  | 'runtime-missing'
  | 'binding-unavailable'
  | 'media-open-failed'
  | 'playback-failed'

interface ProjectionVlcFailure {
  itemId?: string
  code: ProjectionVlcFailureCode
  recoverable: boolean
  message: string
}
~~~

- Produces preload subscription `window.api.projectionVlc.onFailure(listener)`.
- Invariant: diagnostics contain no local file path.

- [ ] **Step 1: Write IPC and UI failure tests**

Test a rejected VLC start, a runtime error event, cleanup of the listener, sanitized message text, and a recovery notice with one retry action.

- [ ] **Step 2: Run the focused tests and confirm the contract is absent**

Run:

~~~bash
npx vitest run src/main/__tests__/ipc/projection-vlc.test.ts src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx src/renderer/src/components/Control/__tests__/ProjectionRecoveryNotice.test.tsx
~~~

Expected: failures because `projection-vlc:failure` and `onFailure` are undefined.

- [ ] **Step 3: Publish and consume typed failures**

Add `projection-vlc:failure` to `IpcMainToRendererMap`. In the VLC handler, map known startup/runtime errors to the four codes, send the sanitized value to the main renderer through `WindowManager.sendToMain`, then preserve the original rejection for the projection renderer.

Projection context stores only the latest failure in runtime state and clears it after a successful explicit media reprojection. Recovery notice calls the existing projection retry/reproject action; it does not initialize a second VLC runtime.

- [ ] **Step 4: Run VLC and projection tests**

Run:

~~~bash
npx vitest run src/main/__tests__/ipc/projection-vlc.test.ts src/main/__tests__/vlc-player-runtime.test.ts src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx src/renderer/src/components/Control/__tests__/ProjectionRecoveryNotice.test.tsx
~~~

Expected: all pass and no assertion exposes a native path.

- [ ] **Step 5: Commit**

~~~bash
git add src/shared/ipc-channels.ts src/main/ipc/projection-vlc.ts src/preload/index.ts src/preload/index.d.ts src/renderer/src/contexts/ProjectionContext.tsx src/renderer/src/components/Control/ProjectionRecoveryNotice.tsx src/main/__tests__ src/renderer/src/contexts/__tests__ src/renderer/src/components/Control/__tests__
git commit -m "fix: expose recoverable VLC projection failures"
~~~

### Task 4: Bound PDF projection canvas work

**Files:**
- Modify: `src/renderer/src/components/Projection/FileProjection.tsx`
- Test: `src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx`

**Interfaces:**
- Produces constant `PDF_CONTINUOUS_CANVAS_RADIUS = 2`.
- Invariant: single mode owns one canvas; continuous mode owns at most five rendered canvases.

- [ ] **Step 1: Write canvas-bound tests**

Create a synthetic 100-page PDF state. In single mode assert one `getPage` call for the current page. In continuous mode scroll to page 50 and assert rendered page numbers stay within 48–52 and old canvas nodes are removed.

- [ ] **Step 2: Run the PDF projection test and confirm over-rendering**

Run:

~~~bash
npx vitest run src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx
~~~

Expected: the existing continuous renderer creates one canvas per page.

- [ ] **Step 3: Render a bounded window**

Replace the full `pdfState.canvases.map` surface with a five-page window centered on the replay/current page. Reuse the existing page-float scroll contract by adding top/bottom spacer heights derived from measured page sizes. Cancel pdf.js render tasks when pages leave the window.

Keep `PdfPreview` unchanged; it already lazy-renders operator canvases with `IntersectionObserver`.

- [ ] **Step 4: Run projection PDF regressions**

Run:

~~~bash
npx vitest run src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/PdfPreview.test.tsx
~~~

Expected: all pass and the continuous projection never owns more than five canvases.

- [ ] **Step 5: Commit**

~~~bash
git add src/renderer/src/components/Projection/FileProjection.tsx src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx
git commit -m "perf: bound PDF projection canvas rendering"
~~~

### Task 5: Correct media capability declarations

**Files:**
- Modify: `src/renderer/src/lib/media-capabilities.ts`
- Modify: `src/renderer/src/lib/media-import-policy.ts`
- Test: `src/renderer/src/lib/__tests__/media-capabilities.test.ts`
- Test: `src/renderer/src/lib/__tests__/media-import-policy.test.ts`

**Interfaces:**
- Produces: TIFF, HEIC, and HEIF support mode `unsupported` in both platforms unless a real decoder probe is later added.
- Invariant: unsupported files remain visible as disabled synced metadata but are not presented as native.

- [ ] **Step 1: Write classification tests**

Assert `classifyMediaImport` returns `platform-unsupported` for TIFF, HEIC, and HEIF on web and Electron, while PNG/JPEG remain native.

- [ ] **Step 2: Run tests and confirm the false-native declarations**

Run:

~~~bash
npx vitest run src/renderer/src/lib/__tests__/media-capabilities.test.ts src/renderer/src/lib/__tests__/media-import-policy.test.ts
~~~

Expected: current assertions report native support for all three formats.

- [ ] **Step 3: Change only the three capability records**

Set `web` and `electron` to `unsupported` for TIFF, HEIC, and HEIF. Do not add a decoder package or extension-specific fallback.

- [ ] **Step 4: Run import/readiness tests**

Run:

~~~bash
npx vitest run src/renderer/src/lib/__tests__/media-capabilities.test.ts src/renderer/src/lib/__tests__/media-import-policy.test.ts src/renderer/src/lib/__tests__/presentation-readiness.test.ts
~~~

Expected: all pass and affected files are disabled before projection.

- [ ] **Step 5: Commit**

~~~bash
git add src/renderer/src/lib/media-capabilities.ts src/renderer/src/lib/media-import-policy.ts src/renderer/src/lib/__tests__/media-capabilities.test.ts src/renderer/src/lib/__tests__/media-import-policy.test.ts
git commit -m "fix: stop advertising unsupported image codecs"
~~~

### Task 6: Remove the hard-coded projection aspect ratio

**Files:**
- Modify: `src/renderer/src/components/Projection/FileProjection.tsx`
- Test: `src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx`
- Test: `src/renderer/src/components/Projection/__tests__/FileProjection.editable-payload.test.tsx`

**Interfaces:**
- Produces source-aspect containment for image, native video, PDF, PPTX, and LPDeck.
- Invariant: the outer projection viewport is always `100vw × 100vh` with black letterboxing as needed.

- [ ] **Step 1: Write non-16:9 projection tests**

Cover a portrait image, 4:3 PDF page, 4:3 PPTX slide, and editable presentation dimensions. Assert no surface has `aspectRatio: '16 / 9'` and each content frame uses its source dimensions or `object-fit: contain`.

- [ ] **Step 2: Run tests and confirm the fixed wrapper**

Run:

~~~bash
npx vitest run src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx src/renderer/src/components/Projection/__tests__/FileProjection.editable-payload.test.tsx
~~~

Expected: image/video/PDF branches still render the fixed aspect ratio.

- [ ] **Step 3: Use the full viewport and source dimensions**

Remove the three inline `aspectRatio: '16 / 9'` wrappers. Keep image/video at full viewport with `objectFit: 'contain'`. Size PDF from its actual viewport. Keep PPTX and editable decks on their existing deck width/height ratio.

- [ ] **Step 4: Run media projection regressions**

Run:

~~~bash
npx vitest run src/renderer/src/components/Projection/__tests__/FileProjection.test.tsx src/renderer/src/components/Projection/__tests__/FileProjection.editable-payload.test.tsx src/renderer/src/lib/__tests__/media-projection-payload.test.ts
~~~

Expected: all pass for landscape and portrait sources.

- [ ] **Step 5: Commit**

~~~bash
git add src/renderer/src/components/Projection/FileProjection.tsx src/renderer/src/components/Projection/__tests__
git commit -m "fix: preserve source aspect ratio in projection"
~~~

### Task 7: Put the presentation workspace on existing responsive primitives

**Files:**
- Modify: `src/renderer/src/pages/PresentationWorkspacePage.tsx`
- Modify: `src/renderer/src/assets/main.css`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx`
- Test: `src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx`
- Test: `e2e/browser-projection.spec.ts`

**Interfaces:**
- Consumes: `WorkspacePanelGroup`, `WorkspaceNavigator`, `WorkspaceStage`, and `WorkspaceInspector` from `components/Common/WorkspacePrimitives.tsx`.
- Invariant: read-only imported PPTX and editable LPDeck share the same responsive shell without changing editor commands.

- [ ] **Step 1: Add compact-layout tests**

Render at 900 px width and assert the slide navigator becomes the existing overlay trigger, the stage remains visible, and ribbon content scrolls horizontally without expanding the viewport.

- [ ] **Step 2: Run the workspace tests and confirm fixed-grid behavior**

Run:

~~~bash
npx vitest run src/renderer/src/pages/__tests__/PresentationWorkspacePage.session.test.tsx src/renderer/src/pages/__tests__/PresentationWorkspacePage.edit-copy.test.tsx
~~~

Expected: the fixed `grid-cols-[220px_minmax(0,1fr)]` layout does not expose the primitive behavior.

- [ ] **Step 3: Replace only the outer workspace grid**

Wrap the existing navigator, stage, and inspector JSX in `WorkspacePanelGroup`. Preserve ribbon and editor implementation. Remove redundant local breakpoint CSS after the primitive owns it.

- [ ] **Step 4: Run full Slice 0 validation**

Run:

~~~bash
npm run lint
npm run typecheck
npx vitest run
npm run build
npm run test:e2e:browser
~~~

Expected: all commands pass and `npm run check:bundle` remains within budget as part of build.

- [ ] **Step 5: Commit**

~~~bash
git add src/renderer/src/pages/PresentationWorkspacePage.tsx src/renderer/src/assets/main.css src/renderer/src/pages/__tests__ e2e/browser-projection.spec.ts
git commit -m "refactor: reuse responsive presentation workspace shell"
~~~

## Slice 0 Gate

Do not begin HHC auth implementation until:

- the shared queue cancellation tests prove late download responses cannot commit;
- blackout and blank restore replay the latest video/PDF state;
- VLC failures reach operator UI without paths or raw native errors;
- continuous PDF projection is bounded to five canvases;
- TIFF/HEIC/HEIF are no longer marked native;
- source aspect ratios are preserved;
- browser E2E, full Vitest, typecheck, lint, and build pass.

## Rollback

- Revert the focused task commit that introduced the regression; the tasks share existing boundaries
  but do not depend on new schemas or external services.
- Do not restore native TIFF/HEIC/HEIF declarations unless the corresponding runtime decoder is
  added and proved in both Electron and browser mode.
- If projection replay is rolled back, keep the typed VLC error path so native failures remain
  operator-visible.
