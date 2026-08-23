# Media Projection Controls Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the full-window Media controls and projection window one reliable lifecycle, including close failure and owner-drift recovery.

**Architecture:** Keep serializable lifecycle state in the existing Media Zustand store. Reuse `closeProjectionAndMediaSession` for all operator-initiated exits, extend the existing single navigation blocker for browser history, and let the existing projection sync observe a minimal monotonic session revision. Do not add a second blocker, context, coordinator, or global projection UI.

**Tech Stack:** React 19, TypeScript, React Router, Zustand, Vitest/Testing Library, Playwright, Electron Vite

**Spec:** `docs/superpowers/specs/2026-08-23-media-projection-controls-reliability.md`

## Global Constraints

- Preserve Electron/browser dual-mode behavior.
- Keep `NowProjectingBar` removed.
- Do not change non-Media projection ownership rules.
- Follow RED-GREEN-REFACTOR for each behavioral change.
- Stop before merge, tag, release, or deployment.

---

### Task 1: Make Media workspace close transactional

**Files:**

- Modify: `src/renderer/src/pages/MediaWorkspacePage.tsx`
- Modify: `src/renderer/src/pages/__tests__/MediaWorkspacePage.test.tsx`
- Modify: `src/renderer/src/contexts/ProjectionContext.tsx`
- Modify: `src/renderer/src/contexts/__tests__/ProjectionContext.test.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/MediaPresenter.tsx`
- Modify: `src/renderer/src/components/Control/FileExplorer/Presenter/Preview/MediaPreview.tsx`
- Test: `src/renderer/src/components/Control/FileExplorer/Presenter/Preview/__tests__/MediaPreview.test.tsx`
- Modify: `src/renderer/src/stores/media-projection.ts`
- Modify: `src/renderer/src/stores/__tests__/media-projection.test.ts`
- Modify: `src/renderer/src/lib/media-projection-sync.ts`
- Modify: `src/renderer/src/lib/__tests__/media-projection-sync.test.ts`

1. Add tests proving close is awaited before state clearing and failure retains `/media`, playlist,
   and live state while showing `toast.projectionCloseFailed`.
2. Run the focused page test and confirm the failure is caused by immediate `endLiveSession()`.
3. Route `MediaWorkspacePage` exits through the existing `closeProjectionAndMediaSession` helper;
   suppress duplicate clicks while it is pending and handle rejection locally.
4. Pass the same exit callback into `MediaPreview`; make an ended `next()` a no-op and remove the
   sync subscriber that closes projection after state was already cleared.
5. Keep the projection coordinator snapshot until Electron native close succeeds so a rejected
   close does not discard the replayable session.
6. Run the focused page, context, preview, store, presenter, and sync tests until green.

### Task 2: Protect browser navigation away from live Media controls

**Files:**

- Modify: `src/renderer/src/components/Control/PresentationNavigationGuard.tsx`
- Modify: `src/renderer/src/components/Control/__tests__/PresentationNavigationGuard.test.tsx`

1. Add router tests proving navigation from live `/media` waits for projection close and resets the
   blocked navigation on close failure without clearing Media state.
2. Run the focused guard test and confirm navigation currently bypasses the close transaction.
3. Extend the existing blocker predicate to cover an active `/media` route. Reuse the close helper
   after any unsafe presentation work is resolved, then proceed or reset the same blocker.
4. Re-run the guard and page tests until green; do not add a second `useBlocker`.

### Task 3: Reclaim Media projection ownership on every explicit start

**Files:**

- Modify: `src/renderer/src/stores/media-projection.ts`
- Modify: `src/renderer/src/stores/__tests__/media-projection.test.ts`
- Modify: `src/renderer/src/lib/media-projection-sync.ts`
- Modify: `src/renderer/src/lib/__tests__/media-projection-sync.test.ts`

1. Add store tests proving successful starts increment a session revision while an all-unready
   start does not.
2. Add a sync test that switches the active owner away from Media, explicitly starts Media again,
   and expects `startProjection('media', ...)` with foregrounding.
3. Run both focused tests and confirm the missing revision/restart detection causes the failures.
4. Add one numeric `sessionRevision` field, increment it atomically on successful starts, and treat
   revision changes as starts in the existing sync subscriber.
5. Re-run the focused store and sync tests until green.

### Task 4: Correct the roadmap contract

**Files:**

- Modify: `docs/roadmap/librepresenter-optimization-roadmap.md`

1. Replace R4's obsolete background-browsing, `Now Projecting`, blackout, and resume contract with
   the authoritative full-window Media-controls lifecycle.
2. Record only verification actually observed in this branch; do not claim packaged smoke.

### Task 5: Verify and open the PR

**Files:**

- Review all changed files against the spec and `origin/main`.

1. Run focused Media lifecycle tests.
2. Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
3. Run the existing browser Media-controls Playwright E2E.
4. Inspect the final diff for unrelated changes and stale `NowProjectingBar` references.
5. Commit with a conventional message, push `fix/media-projection-controls`, open one PR against
   `main`, and report CI as pending or observed. Do not merge.
